'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { createFileLifecycle, RETENTION } = require('./file-lifecycle.cjs');
const { ProcessingQueue } = require('./processing-queue.cjs');
const { ActivityStore } = require('./activity-store.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-delete-')), owner = crypto.randomUUID(), id = crypto.randomUUID();
  const uploads = path.join(root, 'uploads'), exports = path.join(root, 'exports'), previews = path.join(root, 'previews');
  for (const base of [uploads, exports, previews]) fs.mkdirSync(path.join(base, owner), { recursive: true });
  const file = path.join(uploads, owner, id + '-source.wav'); fs.writeFileSync(file, 'source');
  const activity = new ActivityStore(path.join(root, 'activity.sqlite'));
  const queue = new ProcessingQueue({ file: path.join(root, 'queue.json'), retention: Infinity, onChange: job => activity.record(job) });
  const sessions = new Map(), options = { uploads, exports, previews, queue, activity, sessions, username: () => 'testuser', journal: path.join(root, 'pending.json') };
  const service = createFileLifecycle(options);
  t.after(() => { activity.close(); fs.rmSync(root, { recursive: true, force: true }); });
  function job(kind, result, status = 'succeeded', extra = {}) {
    const j = { id: crypto.randomUUID(), owner, fileId: id, kind, result, status, queuedAt: Date.now() - 100, finishedAt: Date.now(), ...extra };
    queue.jobs.set(j.id, j); queue.save(); activity.record(j); return j;
  }
  function output() { const out = crypto.randomUUID(), dir = path.join(exports, owner, out); fs.mkdirSync(dir); fs.writeFileSync(path.join(dir, 'track.wav'), 'output'); return out; }
  return { ...options, root, owner, id, file, service, job, output };
}
test('Source cascade removes preview temporary files and failed-worker outputs, keeps audit', t => {
  const f = fixture(t), out = f.output();
  f.job('export', undefined, 'failed', { outputId: out }); f.job('qc');
  fs.writeFileSync(path.join(f.previews, f.owner, f.id + '.flac.part'), 'partial');
  f.service.removeFile(f.owner, f.id, 'manual-delete', { id: f.owner, username: 'testuser' });
  assert.ok(!fs.existsSync(f.file)); assert.equal(fs.readdirSync(path.join(f.previews, f.owner)).length, 0);
  assert.ok(!fs.existsSync(path.join(f.exports, f.owner, out))); assert.equal(f.activity.list(f.owner).length, 0);
  const events = f.activity.audit({ limit: 100 }).entries;
  assert.ok(events.some(e => e.kind === 'qc' && e.type !== 'delete'));
  assert.ok(events.some(e => e.type === 'delete' && e.source === 'user-remove' && e.actorUsername === 'testuser' && e.resourceId === f.id && e.result === 'success'));
  assert.throws(() => f.service.removeFile(f.owner, f.id, 'manual-delete'), { status: 404 });
});
test('Invalid types/IDs and upload, preview, owner/export/nested junction escapes are rejected before source deletion', t => {
  const f = fixture(t);
  for (const id of ['../secret', 'C:\\secret', f.id + '/..', [f.id], {}, null]) assert.throws(() => f.service.removeFile(f.owner, id, 'manual-delete'), { status: 400 });
  const outside = path.join(f.root, 'outside'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'keep'), 'protected');
  const out = f.output(); f.job('export', { jobId: out });
  const nested = path.join(f.exports, f.owner, out, 'escape'); fs.symlinkSync(outside, nested, 'junction');
  assert.throws(() => f.service.removeFile(f.owner, f.id, 'manual-delete'), { status: 400 });
  assert.ok(fs.existsSync(f.file)); fs.unlinkSync(nested);
  for (const base of [f.previews, f.exports, f.uploads]) {
    const original = path.join(base, f.owner), backup = original + '.saved'; fs.renameSync(original, backup); fs.symlinkSync(outside, original, 'junction');
    assert.throws(() => base === f.exports ? f.service.removeExport(f.owner, out, 'manual-delete') : f.service.removeFile(f.owner, f.id, 'manual-delete'), { status: 400 });
    fs.unlinkSync(original); fs.renameSync(backup, original);
  }
  assert.equal(fs.readFileSync(path.join(outside, 'keep'), 'utf8'), 'protected'); assert.ok(fs.existsSync(f.file));
});
test('Queued/running jobs and unknown worker output prevent manual deletion and cleanup', t => {
  const f = fixture(t), out = f.output();
  const running = f.job('merge', undefined, 'running', { fileIds: [f.id, crypto.randomUUID()] });
  assert.throws(() => f.service.removeExport(f.owner, out, 'manual-delete'), { status: 409 });
  assert.throws(() => f.service.removeFile(f.owner, f.id, 'manual-delete'), { status: 409 });
  const old = new Date(Date.now() - RETENTION - 1000); fs.utimesSync(f.file, old, old); f.service.cleanup(); assert.ok(fs.existsSync(f.file));
  running.status = 'failed'; f.service.cleanup(); assert.ok(!fs.existsSync(f.file));
});
test('Incomplete upload can be removed; writing is a conflict; exact 59 minute boundary is retained', t => {
  const f = fixture(t), partId = crypto.randomUUID(), part = path.join(f.uploads, f.owner, partId + '.part');
  fs.writeFileSync(part, 'partial'); f.sessions.set(partId, { owner: f.owner, writing: true, updated: Date.now(), file: part });
  assert.throws(() => f.service.removeFile(f.owner, partId, 'manual-delete'), { status: 409 });
  f.sessions.get(partId).writing = false; f.service.removeFile(f.owner, partId, 'manual-delete');
  assert.ok(!fs.existsSync(part)); assert.ok(!f.sessions.has(partId));
  const now = Date.now(), original = Date.now; Date.now = () => now;
  try {
    fs.utimesSync(f.file, new Date(now - RETENTION + 1000), new Date(now - RETENTION + 1000)); f.service.cleanup(); assert.ok(fs.existsSync(f.file));
    fs.utimesSync(f.file, new Date(now - RETENTION), new Date(now - RETENTION)); f.service.cleanup(); assert.ok(!fs.existsSync(f.file));
  } finally { Date.now = original; }
});
test('Disk failure is reported, resource stays locked, journal retries after restart without losing or duplicating audit', t => {
  const f = fixture(t); f.job('analyze');
  const rm = fs.rmSync;
  fs.rmSync = () => { throw Object.assign(new Error('disk busy'), { code: 'EBUSY' }); };
  try { assert.throws(() => f.service.removeFile(f.owner, f.id, 'manual-delete', { source: 'admin-delete', id: f.owner, username: 'admin' }), /disk busy/); }
  finally { fs.rmSync = rm; }
  assert.ok(fs.existsSync(f.file)); assert.throws(() => f.service.assertAvailable(f.owner, f.id), { status: 409 });
  createFileLifecycle(f).cleanup(); assert.ok(!fs.existsSync(f.file)); assert.equal(f.activity.list(f.owner).length, 0);
  createFileLifecycle(f).cleanup();
  const events = f.activity.audit({ type: 'delete' }).entries;
  assert.equal(events.filter(e => e.result === 'failure').length, 1); assert.equal(events.filter(e => e.result === 'success').length, 1);
  assert.equal(events.find(e => e.result === 'success').source, 'admin-delete');
});
test('SQLite failure after disk deletion rolls back history/audit and recovers from journal', t => {
  const f = fixture(t); f.job('qc');
  f.activity.db.exec("CREATE TRIGGER fail_delete BEFORE INSERT ON audit WHEN json_extract(NEW.data,'$.result')='success' BEGIN SELECT RAISE(FAIL, 'injected'); END;");
  assert.throws(() => f.service.removeFile(f.owner, f.id, 'manual-delete'), /injected/);
  assert.ok(!fs.existsSync(f.file)); assert.equal(f.activity.list(f.owner).length, 1);
  f.activity.db.exec('DROP TRIGGER fail_delete'); createFileLifecycle(f).cleanup();
  assert.equal(f.activity.list(f.owner).length, 0); assert.equal(f.activity.audit({ type: 'delete' }).entries.filter(e => e.result === 'success').length, 1);
});
test('Orphan export history and expired preview reconcile independently of retained source', t => {
  const f = fixture(t), out = f.output(); const a = f.job('analyze'); f.job('export', { jobId: out }); f.job('preview');
  fs.rmSync(path.join(f.exports, f.owner, out), { recursive: true });
  const preview = path.join(f.previews, f.owner, f.id + '.flac'); fs.writeFileSync(preview, 'fLaC');
  const old = new Date(Date.now() - RETENTION - 1000); fs.utimesSync(preview, old, old);
  f.service.cleanup(); assert.ok(fs.existsSync(f.file)); assert.ok(!fs.existsSync(preview));
  assert.deepEqual(f.activity.list(f.owner).map(j => j.jobId), [a.id]);
});
