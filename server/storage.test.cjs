'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createStorageLimits, limitsFromEnv } = require('./storage-limits.cjs');
function fixture(t, limits = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-storage-'));
  t.after(() => { if (!root.startsWith(path.join(os.tmpdir(), 'atl-storage-'))) throw new Error('Invalid test root'); fs.rmSync(root, { recursive: true, force: true }); });
  const uploads = path.join(root, 'uploads'), exports = path.join(root, 'exports'), sessions = new Map();
  fs.mkdirSync(uploads); fs.mkdirSync(exports);
  let free = 10000;
  const storage = createStorageLimits({ uploads, exports, sessions, limits: { userBytes: 1000, totalBytes: 2000, minFreeBytes: 100, exportBytes: 600, ...limits }, freeBytes: () => free });
  const file = (base, owner, name, size) => { const dir = path.join(base, owner); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), Buffer.alloc(size)); };
  return { storage, sessions, uploads, exports, file, free: value => { free = value; } };
}
test('Completed uploads, partial uploads, exports and outstanding reservations share the account quota', t => {
  const f = fixture(t);
  f.file(f.uploads, 'a', 'complete.wav', 300); f.file(f.exports, 'a', 'track.wav', 100);
  f.file(f.uploads, 'a', 'incomplete.part', 100);
  f.sessions.set('part', { owner: 'a', size: 400, received: 100 });
  f.storage.check('a', 200);
  assert.throws(() => f.storage.check('a', 201), { status: 413 });
  assert.deepEqual(f.storage.summary('a'), { usedBytes: 500, reservedBytes: 300, limitBytes: 1000 });
  f.sessions.delete('part'); f.storage.check('a', 500);
});
test('Concurrent account reservations cannot overbook global capacity or disk reserve', t => {
  const f = fixture(t, { userBytes: 3000, totalBytes: 1500 });
  f.sessions.set('one', { owner: 'a', size: 1000, received: 0 });
  assert.throws(() => f.storage.check('b', 501), { status: 507 });
  f.free(1300); f.storage.check('b', 200);
  assert.throws(() => f.storage.check('b', 201), { status: 507 });
  f.free(1099); assert.throws(() => f.storage.check('a'), { status: 507 });
});
test('Export reserves available capacity and releases it on completion or failure', t => {
  const f = fixture(t);
  f.file(f.uploads, 'a', 'source.flac', 450);
  const reservation = f.storage.reserveExport('a'); assert.equal(reservation.bytes, 550);
  assert.throws(() => f.storage.check('a', 1), { status: 413 });
  reservation.release(); f.storage.check('a', 550);
  f.free(100); assert.throws(() => f.storage.reserveExport('a'), { status: 507 });
});
test('Storage policy rejects invalid configuration instead of disabling the limits', () => {
  assert.equal(limitsFromEnv({}).userBytes, 10e9);
  for (const value of ['0', '-1', 'NaN', 'Infinity', 'many']) assert.throws(() => limitsFromEnv({ ATL_USER_STORAGE_GB: value }));
});
