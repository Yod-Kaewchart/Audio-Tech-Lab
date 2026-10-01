'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), http = require('node:http');
const { createServer } = require('./upload-server.js');
const { createWebServer } = require('./web-server.cjs');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));

test('Authenticated downloads stream through the same-origin proxy', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-download-'));
  const backend = createServer({ root, runJob: async () => '{}' });
  await listen(backend);
  const web = createWebServer({ backendPort: backend.address().port });
  await listen(web);
  t.after(async () => { await close(web); await close(backend); fs.rmSync(root, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + web.address().port;
  async function account(username) {
    const password = 'Synthetic-Download-Password-123';
    const registered = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email: username + '@example.invalid', password }) });
    assert.equal(registered.status, 201); await registered.json();
    const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    assert.equal(response.status, 200); await response.json();
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    const users = JSON.parse(fs.readFileSync(path.join(root, 'tools/runtime/security/users.json'))).users;
    return { cookie: cookie.split(';')[0], id: users.find(u => u.username === username).id };
  }
  const alice = await account('downloadalice'), bob = await account('downloadbob');
  const job = crypto.randomUUID(), directory = path.join(root, 'exports', alice.id, job);
  fs.mkdirSync(directory, { recursive: true });
  const names = ['01 - Track 01.flac', '02 - เพลงไทย (ทดสอบ)\'%.wav'];
  const contents = names.map((_, index) => Buffer.from([index, 0, 255, 10, 13, 42]));
  names.forEach((name, index) => fs.writeFileSync(path.join(directory, name), contents[index]));
  const url = name => '/api/download/' + job + '/' + encodeURIComponent(name);
  const get = (route, user = alice, options = {}) => fetch(base + route, { ...options, headers: { ...(user ? { Cookie: user.cookie } : {}), ...options.headers } });
  // http.request preserves malicious dot segments (fetch/URL normalize them).
  const raw = route => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: web.address().port, path: route, headers: { Cookie: alice.cookie } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    }).on('error', reject);
  });
  await t.test('200, exact bytes/length, audio types and ASCII plus UTF-8 attachment names', async () => {
    for (let index = 0; index < names.length; index++) {
      const response = await get(url(names[index]));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-length'), String(contents[index].length));
      assert.equal(response.headers.get('content-type'), index ? 'audio/wav' : 'audio/flac');
      const disposition = response.headers.get('content-disposition');
      assert.match(disposition, /^attachment; filename="[a-zA-Z0-9._ -]+"; filename\*=UTF-8''/);
      assert.equal(decodeURIComponent(disposition.split("UTF-8''")[1]), names[index]);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('set-cookie'), null);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), contents[index]);
    }
    const head = await get(url(names[1]), alice, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), String(contents[1].length));
    assert.equal((await head.arrayBuffer()).byteLength, 0);
  });
  await t.test('Anonymous, foreign account and revoked sessions cannot download', async () => {
    for (const [user, status] of [[null, 401], [bob, 404], [{ cookie: 'atl_session=invalid' }, 401]]) {
      const response = await get(url(names[0]), user); assert.equal(response.status, status); await response.json();
    }
    const crossOrigin = await get(url(names[0]), alice, { headers: { Origin: 'https://attacker.invalid' } });
    assert.equal(crossOrigin.status, 403); await crossOrigin.json();
  });
  await t.test('Reload preserves session and subsequent track access without a CSRF header', async () => {
    assert.equal((await get('/demo/')).status, 200);
    assert.equal((await get('/api/auth/me')).status, 200);
    for (const name of [names[0], names[1], names[0]]) {
      const response = await get(url(name)); assert.equal(response.status, 200); await response.arrayBuffer();
    }
  });
  await t.test('Invalid jobs, encodings, traversal, Windows paths and header injection are rejected', async () => {
    const prefix = '/api/download/' + job + '/';
    for (const suffix of ['', '../../health', '../../auth/me', '../' + names[0], '%2e%2e/' + names[0], '%2e%2e%2fsecret.wav', '%2e%2e%5csecret.wav', '%00.wav', 'x%0d%0aInjected%3Ayes.wav', 'x%22.wav', 'C%3Afile.wav', 'track.wav%3Asecret', '%ZZ.wav', '%E0%A4.wav', 'track.wav/extra', '.hidden.wav', 'track.wav.', 'track.wav%20', 'notes.txt']) {
      assert.equal(await raw(prefix + suffix.replaceAll(' ', '%20')), 400, suffix);
    }
    assert.equal(await raw('/api/download/invalid/track.wav'), 400);
    assert.equal(await raw('/api/download/' + crypto.randomUUID() + '/track.wav'), 404);
    assert.equal(await raw(prefix + 'missing.wav'), 404);
    fs.mkdirSync(path.join(directory, 'directory.wav'));
    assert.equal(await raw(prefix + 'directory.wav'), 404);
  });
  await t.test('Directory junctions cannot escape an owner export directory', async () => {
    const linkedJob = crypto.randomUUID(), target = path.join(root, 'outside');
    fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'private.wav'), 'private');
    fs.symlinkSync(target, path.join(root, 'exports', alice.id, linkedJob), process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(await raw('/api/download/' + linkedJob + '/private.wav'), 404);
  });
  await t.test('Large response starts before EOF; backpressure and cancellation stop disk reads', async () => {
    const large = path.join(directory, 'large.wav'), size = 32 * 1024 * 1024;
    const fd = fs.openSync(large, 'w'), chunk = Buffer.alloc(64 * 1024, 42);
    for (let n = 0; n < size; n += chunk.length) fs.writeSync(fd, chunk);
    fs.closeSync(fd);
    const original = fs.createReadStream;
    let stream;
    const mock = t.mock.method(fs, 'createReadStream', function(file, options) {
      const result = original.call(this, file, options); if (file === large) stream = result; return result;
    });
    try {
      await new Promise((resolve, reject) => {
        const request = http.get(base + url('large.wav'), { headers: { Cookie: alice.cookie } }, response => {
          assert.equal(response.statusCode, 200); assert.equal(Number(response.headers['content-length']), size);
          response.once('data', () => {
            response.pause();
            setTimeout(() => {
              try { assert.ok(stream.bytesRead < size, 'must not read the entire file for a paused client'); }
              catch (error) { reject(error); }
              const timeout = setTimeout(() => reject(new Error('File stream did not close on cancel')), 3000);
              stream.once('close', () => { clearTimeout(timeout); resolve(); });
              response.destroy(); request.destroy();
            }, 100);
          });
        });
        request.on('error', reject);
      });
      assert.equal(stream.destroyed, true); assert.ok(stream.bytesRead < size);
      assert.equal((await get('/api/health')).status, 200);
    } finally { mock.mock.restore(); }
  });
  await t.test('Logout revokes existing download links', async () => {
    const me = await (await get('/api/auth/me')).json();
    const logout = await get('/api/auth/logout', alice, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf }, body: '{}' });
    assert.equal(logout.status, 200); await logout.json();
    const response = await get(url(names[0])); assert.equal(response.status, 401); await response.json();
  });
});
