'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { EventEmitter } = require('node:events'), { PassThrough } = require('node:stream');
const { createProcessRunner } = require('./process-runner.cjs');
const { ProcessingQueue } = require('./processing-queue.cjs');

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-runner-unit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const marker = path.join(root, 'worker.json'), child = new EventEmitter();
  child.pid = 12345; child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough(); child.kill = () => { calls.push({ type: 'late-kill' }); return true; };
  const calls = [];
  const ops = {
    spawn: (_python, args) => { calls.push({ type: 'spawn', args }); if (options.delaySpawn) options.delaySpawn(child); else queueMicrotask(() => child.emit('spawn')); return child; },
    execFile: (exe, args, opts, callback) => { calls.push({ type: 'stop', exe, args, callback }); return options.onStop?.(callback); },
    execFileSync: (...args) => options.onInspect ? options.onInspect(...args) : (() => { throw new Error('Unexpected recovery'); })()
  };
  const runner = createProcessRunner({ marker, python: 'python.exe', cwd: root, worker: 'worker.py', timeout: options.timeout || 10000, stopTimeout: options.stopTimeout || 100, processOps: ops });
  const start = signal => runner('bridge.py', ['source.wav'], undefined, { signal });
  const close = code => { child.emit('exit', code); child.emit('close', code); };
  return { root, marker, child, calls, runner, start, close };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('normal exit returns output and removes only its own marker', async t => {
  const f = fixture(t), result = f.start(); await tick();
  assert.ok(fs.existsSync(f.marker)); assert.match(f.calls[0].args[1], /^atl_worker=/);
  f.child.stdout.write('ok'); f.close(0);
  assert.equal(await result, 'ok'); assert.equal(fs.existsSync(f.marker), false);
  assert.equal(f.calls.filter(x => x.type === 'stop').length, 0);
});
test('cancellation reports success only after stop callback and child close', async t => {
  const f = fixture(t), controller = new AbortController(), result = f.start(controller.signal); await tick();
  controller.abort(); const call = f.calls.find(x => x.type === 'stop'); assert.ok(call);
  f.close(1); assert.ok(fs.existsSync(f.marker)); call.callback(null);
  await assert.rejects(result, e => e.cancelled === true && e.safeCode === 'USER_CANCELLED');
  assert.equal(fs.existsSync(f.marker), false);
});
test('timeout stops worker and returns original timeout after confirmation', async t => {
  const f = fixture(t, { timeout: 10, onStop: cb => { cb(null); } }), result = f.start();
  await new Promise(resolve => setTimeout(resolve, 25)); f.close(1);
  await assert.rejects(result, /exceeded/); assert.equal(fs.existsSync(f.marker), false);
});
test('taskkill failure rejects promptly, preserves marker, blocks new work and reports queue failure', async t => {
  const f = fixture(t, { onStop: cb => cb(Object.assign(new Error('simulated failure'), { code: 12 })) });
  const queue = new ProcessingQueue(), job = queue.submit({ owner: 'x', fileId: 'f', cancellable: true, execute: ({ signal }) => f.start(signal) });
  await tick(); queue.cancel('x', job.jobId); await tick();
  const state = queue.get('x', job.jobId);
  assert.equal(state.status, 'failed'); assert.equal(state.errorCode, 'WORKER_CLEANUP_UNCONFIRMED');
  assert.equal(queue.recoveryFailed, true);
  assert.equal(queue.isBusy('x', 'f'), true);
  assert.throws(() => queue.forgetJobs([job.jobId]), /queued or running/);
  assert.ok(fs.existsSync(f.marker)); assert.equal(f.child.listenerCount('close'), 1);
  await assert.rejects(f.start(), e => e.cleanupUnconfirmed === true);
  f.close(1); assert.ok(fs.existsSync(f.marker)); queue.close();
});
test('unconfirmed resources survive pruning and restart until recovery is confirmed', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-runner-queue-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'jobs.json');
  const queue = new ProcessingQueue({ file, retention: 0, historyLimit: 0 });
  const job = queue.submit({ owner: 'x', fileId: 'f', execute: async () => { throw Object.assign(new Error('uncertain'), { cleanupUnconfirmed: true, safeCode: 'WORKER_CLEANUP_UNCONFIRMED' }); } });
  await tick(); assert.equal(queue.isBusy('x', 'f'), true); queue.prune(); queue.close();
  const unresolved = new ProcessingQueue({ file, retention: Infinity });
  assert.equal(unresolved.get('x', job.jobId).status, 'failed'); assert.equal(unresolved.isBusy('x', 'f'), true); unresolved.close();
  const recovered = new ProcessingQueue({ file, retention: Infinity, resolveUnconfirmedOnStart: true });
  assert.equal(recovered.isBusy('x', 'f'), false); assert.equal(recovered.get('x', job.jobId).errorCode, 'WORKER_CLEANUP_UNCONFIRMED'); recovered.close();
});
test('missing taskkill callback and child close have a bounded deadline', async t => {
  let unref = 0, killed = 0;
  const f = fixture(t, { stopTimeout: 40, onStop: () => ({ unref: () => unref++, kill: () => killed++ }) }), controller = new AbortController(), result = f.start(controller.signal); await tick();
  controller.abort(); await assert.rejects(result, e => e.cleanupUnconfirmed === true && /deadline/.test(e.cause.message) && e.cause.pidState === 'inspection-failed');
  await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(unref, 1); assert.equal(killed, 0);
  assert.ok(fs.existsSync(f.marker)); f.close(1); assert.ok(fs.existsSync(f.marker));
});
test('already exited worker does not invoke taskkill and waits for close', async t => {
  const f = fixture(t), controller = new AbortController(), result = f.start(controller.signal); await tick();
  f.child.emit('exit', 0); controller.abort(); f.child.emit('close', 0);
  await assert.rejects(result, e => e.cancelled === true); assert.equal(f.calls.filter(x => x.type === 'stop').length, 0);
});
test('helper already-exited result still requires child close', async t => {
  const f = fixture(t, { onStop: cb => cb(Object.assign(new Error('already exited'), { code: 10 })) });
  const controller = new AbortController(), result = f.start(controller.signal); await tick(); controller.abort();
  assert.ok(fs.existsSync(f.marker)); f.close(0); await assert.rejects(result, e => e.cancelled === true);
  assert.equal(fs.existsSync(f.marker), false);
});
test('concurrent stops issue only one termination and marker changes are retained', async t => {
  const f = fixture(t), controller = new AbortController(), result = f.start(controller.signal); await tick();
  controller.abort(); f.runner.close(); controller.abort();
  assert.equal(f.calls.filter(x => x.type === 'stop').length, 1);
  fs.writeFileSync(f.marker, JSON.stringify({ pid: 2, token: 'other' }));
  f.calls.find(x => x.type === 'stop').callback(null); f.close(1);
  await assert.rejects(result, e => e.cleanupUnconfirmed === true); assert.equal(JSON.parse(fs.readFileSync(f.marker)).pid, 2);
});
test('recovery refuses a reused PID or a legacy marker without touching it', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-runner-recovery-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const marker = path.join(root, 'worker.json'), token = '12345678-1234-1234-1234-123456789abc';
  const record = { pid: 99, token, worker: 'worker.py', script: 'bridge.py', source: 'source.wav', startedAt: Date.now() };
  let calls = 0;
  const ops = { execFileSync: () => { calls++; return JSON.stringify({ Executable: 'python.exe', Command: 'python.exe -X atl_worker=different worker.py bridge.py source.wav', Created: new Date(record.startedAt).toISOString() }); } };
  for (const value of [record, { ...record, token: undefined }]) {
    fs.writeFileSync(marker, JSON.stringify(value));
    assert.throws(() => createProcessRunner({ marker, python: 'python.exe', worker: 'worker.py', processOps: ops }), /Cannot safely recover/);
    assert.deepEqual(JSON.parse(fs.readFileSync(marker)), JSON.parse(JSON.stringify(value)));
  }
  assert.equal(calls, 2);
});
test('an incomplete marker blocks recovery without deleting its contents', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-runner-partial-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const marker = path.join(root, 'worker.json'); fs.writeFileSync(marker + '.tmp', 'recovery evidence');
  assert.throws(() => createProcessRunner({ marker, python: 'python.exe', worker: 'worker.py' }), /Incomplete worker marker/);
  assert.equal(fs.readFileSync(marker + '.tmp', 'utf8'), 'recovery evidence');
});
test('a competing marker cannot be overwritten during worker startup', async t => {
  const f = fixture(t, { onStop: cb => cb(null) }), result = f.start();
  fs.writeFileSync(f.marker, 'existing recovery evidence');
  await assert.rejects(result, e => e.cleanupUnconfirmed === true);
  assert.equal(fs.readFileSync(f.marker, 'utf8'), 'existing recovery evidence');
  assert.ok(fs.existsSync(f.marker + '.tmp')); f.close(1);
});
test('recovery failure preserves marker and rejects later jobs with the cleanup error', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-runner-recovery-fail-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const marker = path.join(root, 'worker.json'), token = '12345678-1234-1234-1234-123456789abc';
  const record = { pid: 99, token, worker: 'worker.py', script: 'bridge.py', source: 'source.wav', startedAt: Date.now() };
  fs.writeFileSync(marker, JSON.stringify(record)); let callback, spawned = 0;
  const ops = {
    execFileSync: () => JSON.stringify({ Executable: 'python.exe', Command: `python.exe -X atl_worker=${token} worker.py bridge.py source.wav`, Created: new Date(record.startedAt).toISOString() }),
    execFile: (_exe, _args, _options, cb) => { callback = cb; },
    spawn: () => { spawned++; throw new Error('must not spawn'); }
  };
  const runner = createProcessRunner({ marker, python: 'python.exe', worker: 'worker.py', processOps: ops });
  const job = runner('bridge.py', ['source.wav']); callback(Object.assign(new Error('taskkill failed'), { code: 12 }));
  await assert.rejects(job, e => e.cleanupUnconfirmed === true && e.cause.code === 12);
  assert.equal(spawned, 0); assert.deepEqual(JSON.parse(fs.readFileSync(marker)), record);
});

test('taskkill failure records PID inspection failure and keeps the recovery marker', async t => {
  const f = fixture(t, { onStop: cb => cb(Object.assign(new Error('taskkill failed'), { code: 12 })) });
  const controller = new AbortController(), result = f.start(controller.signal); await tick();
  controller.abort();
  await assert.rejects(result, error => {
    assert.equal(error.safeCode, 'WORKER_CLEANUP_UNCONFIRMED');
    assert.equal(error.cause.pidState, 'inspection-failed');
    assert.equal(error.cancelled, true);
    assert.equal(error.originalError.message, 'Processing cancelled');
    return true;
  });
  assert.ok(fs.existsSync(f.marker));
  await assert.rejects(f.start(), error => error.cleanupUnconfirmed === true);
  f.close(1);
});

test('synchronous taskkill launch errors also inspect PID and preserve the marker', async t => {
  const f = fixture(t, { onStop: () => { throw new Error('cannot launch taskkill helper'); } });
  const controller = new AbortController(), result = f.start(controller.signal); await tick();
  controller.abort();
  await assert.rejects(result, error => {
    assert.equal(error.safeCode, 'WORKER_CLEANUP_UNCONFIRMED');
    assert.equal(error.cause.pidState, 'inspection-failed');
    return true;
  });
  assert.ok(fs.existsSync(f.marker)); f.close(1);
});

test('taskkill callback error is accepted only after the worker tree is confirmed gone', async t => {
  const f = fixture(t, {
    onStop: callback => callback(Object.assign(new Error('taskkill reported failure'), { code: 12 })),
    onInspect: () => ''
  });
  const controller = new AbortController(), result = f.start(controller.signal); await tick();
  controller.abort();
  f.close(1);
  await assert.rejects(result, error => error.cancelled === true && error.safeCode === 'USER_CANCELLED');
  assert.equal(fs.existsSync(f.marker), false);
});

test('queue retains the resource lock until the startup recovery promise resolves', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-queue-recovery-gate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'jobs.json');
  const seed = new ProcessingQueue({ file, retention: 0 });
  const job = seed.submit({ owner: 'x', fileId: 'f', execute: async () => {
    throw Object.assign(new Error('cleanup unknown'), { cleanupUnconfirmed: true, safeCode: 'WORKER_CLEANUP_UNCONFIRMED' });
  } });
  await tick(); seed.close();
  let release;
  const recovery = new Promise(resolve => { release = resolve; });
  const pending = new ProcessingQueue({ file, retention: Infinity, recovery });
  assert.throws(() => pending.submit({ owner: 'x', fileId: 'g', execute: async () => ({}) }), { status: 503 });
  assert.equal(pending.get('x', job.jobId).status, 'failed');
  assert.equal(pending.isBusy('x', 'f'), true);
  pending.prune();
  assert.ok(pending.jobs.has(job.jobId));
  release(true); await tick();
  assert.equal(pending.isBusy('x', 'f'), false);
  assert.equal(pending.recoveryPending, false);
  assert.equal(pending.recoveryFailed, false);
  assert.ok(pending.jobs.has(job.jobId));
  pending.close();
});

test('legacy cleanup error codes migrate to an unresolved resource lock', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-queue-legacy-cleanup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'jobs.json'), id = 'legacy-worker-cleanup';
  fs.writeFileSync(file, JSON.stringify({ version: 1, jobs: [{
    id, owner: 'x', fileId: 'f', status: 'failed', errorCode: 'WORKER_CLEANUP_UNCONFIRMED',
    finishedAt: 1, queuedAt: 1
  }] }));
  const unresolved = new ProcessingQueue({ file, retention: 0 });
  assert.equal(unresolved.isBusy('x', 'f'), true);
  assert.throws(() => unresolved.forgetJobs([id]), /queued or running/);
  unresolved.close();
  const recovered = new ProcessingQueue({ file, retention: Infinity, resolveUnconfirmedOnStart: true });
  assert.equal(recovered.isBusy('x', 'f'), false);
  assert.equal(recovered.get('x', id).errorCode, 'WORKER_CLEANUP_UNCONFIRMED');
  recovered.close();
});

test('failed startup recovery keeps the whole processing queue closed', async t => {
  const queue = new ProcessingQueue({ recovery: Promise.reject(new Error('recovery failed')) });
  await tick();
  assert.equal(queue.recoveryPending, false);
  assert.equal(queue.recoveryFailed, true);
  assert.throws(() => queue.submit({ owner: 'x', fileId: 'f', execute: async () => ({}) }), { status: 503 });
  queue.close();
});

test('late spawn after the startup deadline is killed without publishing a marker', async t => {
  let emitSpawn;
  const f = fixture(t, { stopTimeout: 10, delaySpawn: child => { emitSpawn = () => child.emit('spawn'); } });
  const controller = new AbortController(), result = f.start(controller.signal);
  await tick(); controller.abort();
  await assert.rejects(result, error => error.cleanupUnconfirmed === true && error.cancelled === true);
  assert.equal(fs.existsSync(f.marker), false);
  emitSpawn();
  assert.equal(f.calls.some(call => call.type === 'late-kill'), true);
  assert.equal(fs.existsSync(f.marker), false);
  f.close(1);
});
