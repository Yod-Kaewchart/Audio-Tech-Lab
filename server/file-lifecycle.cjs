'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { validId, storagePath, treeSize, fail } = require('./storage-path.cjs');
const RETENTION = 59 * 60 * 1000;
function createFileLifecycle({ uploads, exports, previews, sessions, queue, activity, username, journal }) {
  const pending = new Map(journal && fs.existsSync(journal) ? JSON.parse(fs.readFileSync(journal, 'utf8')) : []);
  let lastCleanupError = 0;
  const entries = directory => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }) : [];
  const key = (owner, id, kind) => [owner, id, kind].join(':');
  const outputId = job => job.result?.jobId || job.outputId;
  function save() {
    if (!journal) return;
    fs.writeFileSync(journal + '.tmp', JSON.stringify([...pending])); fs.renameSync(journal + '.tmp', journal);
  }
  function uploadFiles(owner, id) {
    const directory = storagePath(uploads, owner);
    return entries(directory).filter(e => e.name.startsWith(id + '-') && !e.name.endsWith('.part')).map(e => {
      const file = storagePath(uploads, owner, e.name);
      if (!e.isFile()) throw fail(400, 'Invalid uploaded file');
      return file;
    });
  }
  function exportBusy(owner, id) {
    // Legacy workers choose an output ID only after starting.
    return [...queue.jobs.values()].some(j => j.owner === owner &&
      ((['export', 'merge'].includes(j.kind) && ['queued', 'running'].includes(j.status)) ||
       (outputId(j) === id && (j.fileIds || [j.fileId]).some(file => queue.isBusy(owner, file)))));
  }
  function assertAvailable(owner, id) {
    if ([...pending.values()].some(p => p.owner === owner && (p.id === id || p.fileIds.includes(id) || p.outputs.includes(id)))) throw fail(409, 'Resource deletion is pending; retry after cleanup');
  }
  function execute(plan) {
    const { owner, id, kind } = plan;
    if (!validId(owner) || !validId(id)) throw fail(400, 'Invalid storage item');
    if (plan.uploadNames.some(name => path.basename(name) !== name || !(name.startsWith(id + '-') || name === id + '.part')) ||
        plan.previewNames.some(name => ![id + '.flac', id + '.flac.part'].includes(name))) throw fail(400, 'Invalid deletion plan');
    if (plan.fileIds.some(file => queue.isBusy(owner, file)) || sessions.get(id)?.writing || plan.outputs.some(out => exportBusy(owner, out))) throw fail(409, 'File has a queued or running job');
    const targets = [
      ...plan.uploadNames.map(name => storagePath(uploads, owner, name)),
      ...plan.previewNames.map(name => storagePath(previews, owner, name)),
      ...plan.outputs.map(out => { if (!validId(out)) throw fail(400, 'Invalid storage item'); return storagePath(exports, owner, out); })
    ];
    // Validate the entire cascade before deleting the first byte.
    for (const target of targets) if (fs.existsSync(target)) treeSize(target);
    for (const target of targets) if (fs.existsSync(target)) fs.rmSync(target, { recursive: fs.lstatSync(target).isDirectory(), force: true });
    if (kind === 'upload' && sessions.get(id)?.owner === owner) sessions.delete(id);
    queue.forgetJobs(plan.jobs);
    activity.completeDeletion(plan.jobs, plan.events);
    pending.delete(key(owner, id, kind));
    try { save(); } catch (error) { pending.set(key(owner, id, kind), plan); throw error; }
  }
  function remove(owner, id, kind, reason, actor, required = true) {
    if (!validId(owner) || !validId(id)) throw fail(400, 'Invalid storage item');
    try {
      const existing = pending.get(key(owner, id, kind));
      if (existing) return execute(existing);
      if ((kind === 'upload' || kind === 'preview') && (queue.isBusy(owner, id) || sessions.get(id)?.writing)) throw fail(409, 'File has a queued or running job');
      if (kind === 'export' && exportBusy(owner, id)) throw fail(409, 'File has a queued or running job');
      const jobs = [...queue.jobs.values()].filter(j => j.owner === owner && (kind === 'export' ? outputId(j) === id :
        (j.fileIds || [j.fileId]).includes(id) && (kind !== 'preview' || j.kind === 'preview')));
      const files = kind === 'upload' ? uploadFiles(owner, id) : [];
      const part = storagePath(uploads, owner, id + '.part');
      if (kind === 'upload' && fs.existsSync(part)) files.push(part);
      const previewNames = kind === 'export' ? [] : [id + '.flac', id + '.flac.part'];
      const outputs = kind === 'export' ? [id] : [...new Set(jobs.map(outputId).filter(validId))];
      const exists = kind === 'upload' ? files.length : kind === 'export' ? fs.existsSync(storagePath(exports, owner, id)) : previewNames.some(name => fs.existsSync(storagePath(previews, owner, name)));
      if (required && !exists && !jobs.length) throw fail(404, 'Resource not found');
      const fileIds = [...new Set(jobs.flatMap(j => j.fileIds || [j.fileId]).filter(validId))];
      if (kind !== 'export') fileIds.push(id);
      const events = [];
      function event(resource, resourceId, filename, size, fileId) {
        events.push({ eventId: crypto.randomUUID(), ownerId: owner, username: username(owner), fileId, resourceId,
          filename, size, kind: resource, reason, actorId: actor?.id, actorUsername: actor?.username,
          source: reason === 'auto-cleanup' ? 'auto-cleanup' : actor?.source || 'user-remove' });
      }
      for (const out of outputs) {
        if (exportBusy(owner, out)) throw fail(409, 'File has a queued or running job');
        const target = storagePath(exports, owner, out);
        if (fs.existsSync(target) && !fs.lstatSync(target).isDirectory()) throw fail(400, 'Invalid export directory');
        if (fs.existsSync(target) || jobs.some(j => outputId(j) === out)) event('export', out, out, fs.existsSync(target) ? treeSize(target) : 0, jobs.find(j => outputId(j) === out)?.fileId || null);
      }
      for (const name of previewNames) { const target = storagePath(previews, owner, name); if (fs.existsSync(target)) treeSize(target); }
      if (kind !== 'export' && (exists || jobs.length)) event(kind, id, files[0] ? path.basename(files[0]).slice(37) : jobs[0]?.filename || '', files.reduce((n, f) => n + treeSize(f), 0), id);
      const plan = { owner, id, kind, fileIds, uploadNames: files.map(f => path.basename(f)), previewNames, outputs, jobs: jobs.map(j => j.id), events };
      pending.set(key(owner, id, kind), plan);
      try { save(); } catch (error) { pending.delete(key(owner, id, kind)); throw error; }
      execute(plan);
    } catch (error) {
      if (reason !== 'auto-cleanup') activity.deletion({ ownerId: owner, username: username(owner), fileId: kind === 'export' ? null : id,
        resourceId: id, kind, reason, source: actor?.source || 'user-remove', actorId: actor?.id, actorUsername: actor?.username, result: 'failure', errorCode: error.status || 500 });
      throw error;
    }
  }
  const removeFile = (owner, id, reason, actor, required) => remove(owner, id, 'upload', reason, actor, required);
  const removeExport = (owner, id, reason, actor, required) => remove(owner, id, 'export', reason, actor, required);
  function cleanup() {
    const now = Date.now();
    // An unsafe/locked item must not stop other owners' cleanup or API requests.
    const attempt = fn => { try { fn(); } catch (error) {
      if (error.status !== 409 && now - lastCleanupError >= 60000) {
        lastCleanupError = now; console.error('Cleanup retained an unsafe or unavailable resource for retry');
      }
    } };
    for (const plan of [...pending.values()]) attempt(() => execute(plan));
    for (const owner of entries(uploads)) {
      if (!owner.isDirectory() || !validId(owner.name)) continue;
      attempt(() => { for (const entry of entries(storagePath(uploads, owner.name))) {
        const id = entry.name.slice(0, 36);
        if (!entry.isFile() || !validId(id) || sessions.has(id) || queue.isBusy(owner.name, id)) continue;
        attempt(() => { if (now - fs.statSync(storagePath(uploads, owner.name, entry.name)).mtimeMs >= RETENTION) removeFile(owner.name, id, 'auto-cleanup', null, false); });
      } });
    }
    for (const [id, session] of sessions) if (!session.writing && now - session.updated >= RETENTION) attempt(() => removeFile(session.owner, id, 'auto-cleanup', null, false));
    for (const job of [...queue.jobs.values()]) {
      for (const id of job.fileIds || [job.fileId]) if (validId(job.owner) && validId(id) && !queue.isBusy(job.owner, id)) attempt(() => {
        if (!uploadFiles(job.owner, id).length) removeFile(job.owner, id, 'auto-cleanup', null, false);
      });
      if (validId(job.result?.jobId)) attempt(() => { if (!fs.existsSync(storagePath(exports, job.owner, outputId(job)))) removeExport(job.owner, outputId(job), 'auto-cleanup', null, false); });
      if (job.kind === 'preview' && job.status === 'succeeded') attempt(() => {
        if (!fs.existsSync(storagePath(previews, job.owner, job.fileId + '.flac'))) remove(job.owner, job.fileId, 'preview', 'auto-cleanup', null, false);
      });
    }
    for (const owner of entries(previews)) {
      if (!owner.isDirectory() || !validId(owner.name)) continue;
      attempt(() => { for (const entry of entries(storagePath(previews, owner.name))) {
        const id = entry.name.slice(0, 36);
        if (!entry.isFile() || !validId(id) || ![id + '.flac', id + '.flac.part'].includes(entry.name)) continue;
        attempt(() => { if (!uploadFiles(owner.name, id).length || now - fs.statSync(storagePath(previews, owner.name, entry.name)).mtimeMs >= RETENTION) remove(owner.name, id, 'preview', 'auto-cleanup', null, false); });
      } });
    }
    for (const owner of entries(exports)) {
      if (!owner.isDirectory() || !validId(owner.name)) continue;
      attempt(() => { for (const entry of entries(storagePath(exports, owner.name))) {
        if (!entry.isDirectory() || !validId(entry.name) || exportBusy(owner.name, entry.name)) continue;
        attempt(() => {
          const target = storagePath(exports, owner.name, entry.name); treeSize(target);
          const newest = Math.max(fs.statSync(target).mtimeMs, ...fs.readdirSync(target).map(name => fs.statSync(path.join(target, name)).mtimeMs));
          if (now - newest >= RETENTION) removeExport(owner.name, entry.name, 'auto-cleanup', null);
        });
      } });
    }
    activity.reconcile([...queue.jobs.keys()]);
  }
  return { removeFile, removeExport, cleanup, assertAvailable, exportBusy };
}
module.exports = { createFileLifecycle, RETENTION };
