'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { ProcessingQueue } = require('./processing-queue.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) { const deadline = Date.now() + 5000; while (!check()) { if (Date.now() > deadline) throw new Error('Queue did not reach the expected state'); await new Promise(resolve => setTimeout(resolve, 5)); } }
test('One shared worker, FIFO ordering, and failures release the next job', async () => {
  const queue = new ProcessingQueue(), order = [], controls = [], errors = [];
  let current = 0, maximum = 0;
  function execute(kind) { return () => { order.push(kind); current++; maximum = Math.max(maximum, current); return new Promise((resolve, reject) => controls.push({ resolve, reject })).finally(() => current--); }; }
  const first = queue.submit({ owner: 'a', fileId: 'one', kind: 'analyze', execute: execute('analyze') });
  const second = queue.submit({ owner: 'b', fileId: 'two', kind: 'export', execute: execute('export') });
  const third = queue.submit({ owner: 'a', fileId: 'three', kind: 'analyze', execute: execute('analyze-again') });
  await tick(); assert.deepEqual(order, ['analyze']); assert.equal(queue.get('b', second.jobId).position, 1);
  controls[0].resolve({ ok: true }); await until(() => controls.length === 2);
  controls[1].reject(new Error('Deliberate worker failure')); await until(() => controls.length === 3);
  controls[2].resolve({ ok: true }); await until(() => queue.get('a', third.jobId).status === 'succeeded');
  assert.equal(maximum, 1); assert.deepEqual(order, ['analyze', 'export', 'analyze-again']);
  assert.equal(queue.get('a', first.jobId).status, 'succeeded'); assert.equal(queue.get('b', second.jobId).status, 'failed');
  queue.close();
});
test('Cancellation removes only the owner\'s waiting job and unlocks its file', async () => {
  const queue = new ProcessingQueue(); let release, cancelledRan = false;
  const running = queue.submit({ owner: 'a', fileId: 'one', execute: () => new Promise(resolve => release = resolve) });
  const waiting = queue.submit({ owner: 'b', fileId: 'two', execute: async () => { cancelledRan = true; } });
  await tick();
  assert.throws(() => queue.get('a', waiting.jobId), { status: 404 });
  assert.throws(() => queue.cancel('a', waiting.jobId), { status: 404 });
  assert.throws(() => queue.cancel('a', running.jobId), { status: 409 });
  assert.ok(queue.isBusy('b', 'two')); queue.cancel('b', waiting.jobId); assert.ok(!queue.isBusy('b', 'two'));
  release({}); await until(() => queue.get('a', running.jobId).status === 'succeeded');
  assert.equal(cancelledRan, false); queue.close();
});
test('Duplicate submissions are idempotent, while queue and account limits reject overload', async () => {
  const queue = new ProcessingQueue({ maxWaiting: 2, maxPerUser: 2 }); let release;
  const input = { owner: 'a', fileId: 'one', requestId: 'unique', signature: 'same', execute: () => new Promise(resolve => release = resolve) };
  const first = queue.submit(input); await tick();
  assert.equal(queue.submit(input).jobId, first.jobId);
  assert.throws(() => queue.submit({ ...input, signature: 'different' }), { status: 409 });
  const second = queue.submit({ owner: 'a', fileId: 'two', execute: async () => ({}) });
  assert.throws(() => queue.submit({ owner: 'a', fileId: 'three', execute: async () => ({}) }), { status: 429 });
  const third = queue.submit({ owner: 'b', fileId: 'three', execute: async () => ({}) });
  assert.throws(() => queue.submit({ owner: 'c', fileId: 'four', execute: async () => ({}) }), { status: 429 });
  release({}); await until(() => queue.get('b', third.jobId).status === 'succeeded'); queue.close();
});
test('Restart reports interrupted jobs and completed results survive without re-execution', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-queue-'));
  try {
    const firstFile = path.join(root, 'first.json'), restoredFile = path.join(root, 'restored.json');
    const queue = new ProcessingQueue({ file: firstFile }); let release;
    const done = queue.submit({ owner: 'a', fileId: 'done', execute: async () => ({ answer: 42 }) });
    await until(() => queue.get('a', done.jobId).status === 'succeeded');
    const running = queue.submit({ owner: 'a', fileId: 'running', execute: () => new Promise(resolve => release = resolve) });
    const waiting = queue.submit({ owner: 'b', fileId: 'waiting', execute: async () => ({}) }); await tick();
    fs.copyFileSync(firstFile, restoredFile);
    const restored = new ProcessingQueue({ file: restoredFile });
    assert.equal(restored.get('a', running.jobId).status, 'failed'); assert.equal(restored.get('b', waiting.jobId).status, 'failed');
    assert.deepEqual(restored.get('a', done.jobId).result, { answer: 42 }); assert.ok(!restored.isBusy('a', 'running')); assert.equal(restored.running, null);
    queue.cancel('b', waiting.jobId); release({}); await until(() => queue.get('a', running.jobId).status === 'succeeded');
    queue.close(); restored.close();
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Running cancellation is opt-in and releases the shared worker safely', async () => {
  const queue = new ProcessingQueue(); let secondRan = false;
  const running = queue.submit({
    owner: 'a', fileId: 'one', kind: 'ai-review', cancellable: true,
    execute: ({ signal, setPhase }) => new Promise((resolve, reject) => {
      setPhase('calling-openai');
      signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { cancelled: true, safeCode: 'USER_CANCELLED' })), { once: true });
    })
  });
  const waiting = queue.submit({ owner: 'b', fileId: 'two', kind: 'analyze', execute: async () => { secondRan = true; return {}; } });
  await until(() => queue.get('a', running.jobId).status === 'running');
  let view = queue.get('a', running.jobId);
  assert.equal(view.canCancel, true); assert.equal(view.phase, 'calling-openai');
  view = queue.cancel('a', running.jobId);
  assert.equal(view.status, 'running'); assert.equal(view.phase, 'cancelling'); assert.equal(view.canCancel, false);
  await until(() => queue.get('a', running.jobId).status === 'cancelled');
  assert.equal(queue.get('a', running.jobId).errorCode, 'USER_CANCELLED');
  await until(() => queue.get('b', waiting.jobId).status === 'succeeded');
  assert.equal(secondRan, true); assert.ok(!queue.isBusy('a', 'one')); queue.close();
});

test('Cancellation wins if a cancellable execute ignores abort and resolves afterward', async () => {
  const queue = new ProcessingQueue(); let release;
  const job = queue.submit({
    owner: 'a', fileId: 'race', kind: 'ai-review', cancellable: true,
    execute: () => new Promise(resolve => { release = resolve; })
  });
  await until(() => queue.get('a', job.jobId).status === 'running');
  queue.cancel('a', job.jobId); release({ shouldNotWin: true });
  await until(() => queue.get('a', job.jobId).status === 'cancelled');
  const view = queue.get('a', job.jobId);
  assert.equal(view.status, 'cancelled'); assert.equal(view.errorCode, 'USER_CANCELLED'); assert.equal(view.result, undefined);
  queue.close();
});
