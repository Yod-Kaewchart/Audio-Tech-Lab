'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadMiddleware(t) {
  const source = path.resolve(__dirname, '..', 'functions', '_middleware.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-pages-route-'));
  const target = path.join(dir, 'middleware.mjs');
  fs.copyFileSync(source, target);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return import(pathToFileURL(target).href + '?v=' + Date.now());
}

test('Pages root redirects only the demo hostname', async t => {
  const { onRequest } = await loadMiddleware(t);
  const passthrough = () => new Response('MAIN', { status: 200 });
  const demo = await onRequest({
    request: new Request('https://demo.audiotechlabs.com/'),
    next: async () => passthrough()
  });
  assert.equal(demo.status, 302);
  assert.equal(demo.headers.get('location'), 'https://demo.audiotechlabs.com/demo/');

  for (const host of ['audio-tech-lab.pages.dev', 'www.audiotechlabs.com']) {
    const response = await onRequest({
      request: new Request('https://' + host + '/'),
      next: async () => passthrough()
    });
    assert.equal(await response.text(), 'MAIN');
  }
});
