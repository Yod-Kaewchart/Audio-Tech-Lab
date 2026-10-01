'use strict';
const fs = require('node:fs'), path = require('node:path');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RETENTION = 59 * 60 * 1000;
const fail = (status, message) => Object.assign(new Error(message), { status });
function createFileLifecycle({ uploads, exports, previews, sessions, queue, activity, username }) {
  function uploadFiles(owner, id) {
    const directory = path.join(uploads, owner);
    return fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.startsWith(id + '-') && !e.name.endsWith('.part')).map(e => path.join(directory, e.name)) : [];
  }
  function removeExport(owner, id, reason, actor, required = true) {
    if (!UUID.test(owner) || !UUID.test(id)) throw fail(400, 'Invalid storage item');
    const jobs = [...queue.jobs.values()].filter(j => j.owner === owner && j.result?.jobId === id);
    if (jobs.some(j => queue.isBusy(owner, j.fileId))) throw fail(409, 'File has a queued or running job');
    const target = path.join(exports, owner, id), exists = fs.existsSync(target);
    if (required && !exists) throw fail(404, 'Export job not found');
    let size = 0;
    if (exists) {
      if (!fs.statSync(target).isDirectory() || fs.lstatSync(target).isSymbolicLink()) throw fail(400, 'Invalid storage item');
      size = fs.readdirSync(target, { withFileTypes: true }).filter(e => e.isFile()).reduce((sum, e) => sum + fs.statSync(path.join(target, e.name)).size, 0);
      fs.rmSync(target, { recursive: true, force: true });
    }
    const removed = queue.forgetExport(owner, id); activity.forget(removed);
    if (exists || removed.length) activity.deletion({ ownerId: owner, username: username(owner), fileId: jobs[0]?.fileId || null, filename: id, size, kind: 'export', reason, actorId: actor?.id, actorUsername: actor?.username });
  }
  function removeFile(owner, id, reason, actor, required = true) {
    if (!UUID.test(owner) || !UUID.test(id)) throw fail(400, 'Invalid storage item');
    if (queue.isBusy(owner, id) || sessions.get(id)?.writing) throw fail(409, 'File has a queued or running job');
    const files = uploadFiles(owner, id);
    if (required && files.length !== 1) throw fail(404, 'Uploaded file not found');
    const related = [...queue.jobs.values()].filter(j => j.owner === owner && (j.fileIds || [j.fileId]).includes(id));
    const outputs = new Set(related.map(j => j.result?.jobId).filter(v => UUID.test(String(v))));
    for (const output of outputs) removeExport(owner, output, reason, actor, false);
    const filename = files[0] ? path.basename(files[0]).slice(37) : related[0]?.filename || '';
    const size = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
    for (const file of files) fs.unlinkSync(file);
    fs.rmSync(path.join(previews, owner, id + '.flac'), { force: true });
    const session = sessions.get(id);
    if (session?.owner === owner) { fs.rmSync(session.file, { force: true }); sessions.delete(id); }
    const removed = queue.forgetFile(owner, id); activity.forget(removed);
    if (files.length || removed.length || session) activity.deletion({ ownerId: owner, username: username(owner), fileId: id, filename, size, kind: 'upload', reason, actorId: actor?.id, actorUsername: actor?.username });
  }
  function cleanup() {
    const now = Date.now();
    for (const owner of fs.readdirSync(uploads, { withFileTypes: true })) {
      if (!owner.isDirectory() || !UUID.test(owner.name)) continue;
      for (const entry of fs.readdirSync(path.join(uploads, owner.name), { withFileTypes: true })) {
        const id = entry.name.slice(0, 36), file = path.join(uploads, owner.name, entry.name);
        if (!entry.isFile() || !UUID.test(id) || sessions.has(id) || queue.isBusy(owner.name, id)) continue;
        if (entry.name.endsWith('.part')) {
          if (now - fs.statSync(file).mtimeMs >= RETENTION) { fs.unlinkSync(file); activity.deletion({ ownerId: owner.name, username: username(owner.name), fileId: id, filename: '', size: 0, kind: 'incomplete-upload', reason: 'auto-cleanup' }); }
        } else if (now - fs.statSync(file).mtimeMs >= RETENTION) removeFile(owner.name, id, 'auto-cleanup', null);
      }
    }
    for (const [id, session] of sessions) if (!session.writing && now - session.updated >= RETENTION)
      removeFile(session.owner, id, 'auto-cleanup', null, false);
    // Reconcile legacy/orphan histories after restart without dropping active jobs.
    const missing = new Map();
    for (const job of queue.jobs.values()) for (const id of job.fileIds || [job.fileId])
      if (UUID.test(job.owner) && UUID.test(String(id)) && !queue.isBusy(job.owner, id) && !uploadFiles(job.owner, id).length)
        missing.set(job.owner + ':' + id, [job.owner, id]);
    for (const [owner, id] of missing.values()) removeFile(owner, id, 'auto-cleanup', null, false);
    for (const owner of fs.readdirSync(previews, { withFileTypes: true })) {
      if (!owner.isDirectory() || !UUID.test(owner.name)) continue;
      for (const entry of fs.readdirSync(path.join(previews, owner.name), { withFileTypes: true })) {
        const id = entry.name.slice(0, 36);
        if (entry.isFile() && UUID.test(id) && !queue.isBusy(owner.name, id) && !uploadFiles(owner.name, id).length)
          fs.rmSync(path.join(previews, owner.name, entry.name), { force: true });
      }
    }
    for (const owner of fs.readdirSync(exports, { withFileTypes: true })) {
      if (!owner.isDirectory() || !UUID.test(owner.name)) continue;
      // The worker chooses the output ID; protect all exports of this owner while it is writing one.
      if ([...queue.jobs.values()].some(j => j.owner === owner.name && ['export', 'merge'].includes(j.kind) && ['queued', 'running'].includes(j.status))) continue;
      for (const entry of fs.readdirSync(path.join(exports, owner.name), { withFileTypes: true })) {
        if (!entry.isDirectory() || !UUID.test(entry.name)) continue;
        if ([...queue.jobs.values()].some(j => j.owner === owner.name && j.result?.jobId === entry.name && queue.isBusy(owner.name, j.fileId))) continue;
        const target = path.join(exports, owner.name, entry.name);
        const newest = Math.max(fs.statSync(target).mtimeMs, ...fs.readdirSync(target).map(name => fs.statSync(path.join(target, name)).mtimeMs));
        if (now - newest >= RETENTION) removeExport(owner.name, entry.name, 'auto-cleanup', null);
      }
    }
    activity.reconcile([...queue.jobs.keys()]);
  }
  return { removeFile, removeExport, cleanup };
}
module.exports = { createFileLifecycle, RETENTION };
