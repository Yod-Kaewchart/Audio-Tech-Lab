'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { createServer } = require('./upload-server.js');

function request(port, host, forwardedProto) {
  return new Promise((resolve, reject) => {
    const headers = { Host: host };
    if (forwardedProto) headers['X-Forwarded-Proto'] = forwardedProto;
    const req = http.request({ hostname: '127.0.0.1', port, path: '/health?nonce=host-test', headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString(), headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('Pages backend host allowlist accepts only loopback or the configured HTTPS tunnel host', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-backend-host-'));
  const server = createServer({ root, backendOrigin: 'https://backend.audiotechlabs.com' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const port = server.address().port;

  const local = await request(port, '127.0.0.1:' + port);
  assert.equal(local.status, 200);

  const wrongHost = await request(port, 'demo.audiotechlabs.com', 'https');
  assert.equal(wrongHost.status, 421);

  const insecureTunnel = await request(port, 'backend.audiotechlabs.com', 'http');
  assert.equal(insecureTunnel.status, 403);

  const tunnel = await request(port, 'backend.audiotechlabs.com', 'https');
  assert.equal(tunnel.status, 200);
  const health = JSON.parse(tunnel.body);
  assert.equal(health.service, 'audio-tech-labs-demo');
  assert.equal(health.nonce, 'host-test');
});
