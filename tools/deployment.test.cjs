'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { demoOrigin, mainOrigin, verifyDemo, deploymentMode } = require('./deployment-config.cjs');
const { buildPages } = require('./build-pages.cjs');
test('Production endpoint excludes random tunnels, credentials and wrong paths', () => {
  assert.equal(demoOrigin('https://demo.audiotechlabs.com/'), 'https://demo.audiotechlabs.com');
  assert.equal(mainOrigin('https://www.audiotechlabs.com/'), 'https://www.audiotechlabs.com');
  assert.equal(demoOrigin(''), null);
  assert.equal(mainOrigin(''), null);
  assert.throws(() => mainOrigin('https://audiotechlabs.com'), /ATL_MAIN_ORIGIN/);
  for (const value of ['https://random.trycloudflare.com', 'http://demo.audiotechlabs.com', 'https://audiotechlabs.com', 'https://demo.audiotechlabs.com/demo/', 'https://user:secret@demo.audiotechlabs.com', 'https://demo.audiotechlabs.com/?next=other']) assert.throws(() => demoOrigin(value));
});
test('Deployment checks require the expected API and anonymous rejection', async () => {
  const origin = 'https://demo.audiotechlabs.com', health = { service: 'audio-tech-labs-demo', apiVersion: 1, authentication: true };
  const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  await verifyDemo(origin, async url => url.endsWith('/health') ? response(health) : response({}, 401));
  await assert.rejects(verifyDemo(origin, async () => new Response('<html>', { status: 404 })), /unavailable/);
  await assert.rejects(verifyDemo(origin, async () => response({ ok: true })), /not ready/);
  await assert.rejects(verifyDemo(origin, async url => url.endsWith('/health') ? response(health) : response({})), /authentication check failed/);
});

test('Existing named service can be reused but production rejects quick or conflicting tunnels', () => {
  const env = { ATL_DEMO_ORIGIN: 'https://demo.audiotechlabs.com', ATL_EXTERNAL_TUNNEL: '1' };
  assert.equal(deploymentMode(env).external, true);
  assert.equal(deploymentMode({}).origin, null);
  assert.equal(deploymentMode({ ATL_ALLOW_QUICK_TUNNEL: '1' }).quick, true);
  assert.throws(() => deploymentMode({ ...env, ATL_ALLOW_QUICK_TUNNEL: '1' }), /Quick Tunnel/);
  assert.throws(() => deploymentMode({ ...env, ATL_TUNNEL_CONFIG: 'missing.yml' }), /either/);
  assert.throws(() => deploymentMode({ ATL_EXTERNAL_TUNNEL: '1' }), /ATL_DEMO_ORIGIN/);
  assert.throws(() => deploymentMode({ ATL_DEMO_ORIGIN: env.ATL_DEMO_ORIGIN }), /installed service/);
});
test('Pages serves a maintenance entry without an API, and a verified permanent link when configured', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-pages-'));
  t.after(() => { if (!root.startsWith(path.join(os.tmpdir(), 'atl-pages-'))) throw new Error('Invalid test root'); fs.rmSync(root, { recursive: true, force: true }); });
  fs.mkdirSync(path.join(root, 'dist', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'demo', 'index.html'), 'PRIVATE APP SOURCE');
  let checked = false;
  const output = await buildPages({ root, origin: '' });
  const entry = fs.readFileSync(path.join(output, 'demo', 'index.html'), 'utf8');
  assert.match(entry, /ยังไม่เปิดรับไฟล์เสียง/); assert.doesNotMatch(entry, /<script|PRIVATE APP SOURCE/);
  await buildPages({ root, origin: 'https://demo.audiotechlabs.com', verify: async () => { checked = true; } });
  assert.ok(checked); assert.match(fs.readFileSync(path.join(output, 'demo', 'index.html'), 'utf8'), /href="https:\/\/demo.audiotechlabs.com\/demo\/"/);
  assert.equal(fs.readFileSync(path.join(root, 'dist', 'demo', 'index.html'), 'utf8'), 'PRIVATE APP SOURCE');
  await assert.rejects(buildPages({ root, origin: 'https://demo.audiotechlabs.com', verify: async () => { throw new Error('offline'); } }), /offline/);
});
