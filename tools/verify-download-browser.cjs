'use strict';
// Run with Playwright available in NODE_PATH. Uses an isolated account/storage,
// real audio workers, and installed Chrome; never connects to production.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { chromium } = require('playwright');
const { createServer } = require('../server/upload-server.js');
const { createWebServer } = require('../server/web-server.cjs');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));
function wave() {
  const samples = 24000, buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(5000 * Math.sin(2 * Math.PI * 440 * i / 8000)), 44 + 2 * i);
  return buffer;
}
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-download-browser-'));
  const output = path.resolve(__dirname, '../.site-build/download-qa'); fs.mkdirSync(output, { recursive: true });
  let backend, web, browser;
  try {
    backend = createServer({ root, freeBytes: () => 100e9 }); await listen(backend);
    web = createWebServer({ backendPort: backend.address().port }); await listen(web);
    const base = 'http://127.0.0.1:' + web.address().port;
    // Runtime origin allowlist for this isolated random-port test server only.
    fs.writeFileSync(path.join(root, 'tools/runtime/state.json'), JSON.stringify({ webUrl: base }));
    browser = await chromium.launch({ channel: process.env.ATL_TEST_BROWSER || 'chrome', headless: true });
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    context.on('request', request => { if (request.url().includes('/api/download/')) requests.push(request.resourceType()); });
    const registered = await context.request.post(base + '/api/auth/register', { data: { username: 'browsercheck', email: 'browsercheck@example.invalid', password: 'Synthetic-Browser-Password-123' } });
    assert.equal(registered.status(), 201);
    await page.goto(base + '/demo/');
    await page.locator('#login-username').fill('browsercheck');
    await page.locator('#login-password').fill('Synthetic-Browser-Password-123');
    await page.locator('#login-form button[type=submit]').click();
    await page.locator('#demo-workspace').waitFor({ state: 'visible' });
    await page.locator('#audio-file').setInputFiles({ name: 'browser-check.wav', mimeType: 'audio/wav', buffer: wave() });
    await page.locator('#upload-button').click();
    await page.waitForFunction(() => !document.querySelector('#analyze-button').disabled);
    await page.locator('#analyze-button').click();
    await page.locator('#export-panel').waitFor({ state: 'visible', timeout: 30000 });
    async function downloadLink(link, expected) {
      const event = page.waitForEvent('download'); await link.click(); const downloaded = await event;
      assert.equal(downloaded.suggestedFilename(), expected);
      assert.equal(await downloaded.failure(), null);
      const users = JSON.parse(fs.readFileSync(path.join(root, 'tools/runtime/security/users.json'))).users;
      const owner = users.find(user => user.username === 'browsercheck').id;
      const href = new URL(await link.getAttribute('href'), base), job = href.pathname.split('/')[3];
      assert.deepEqual(fs.readFileSync(await downloaded.path()), fs.readFileSync(path.join(root, 'exports', owner, job, expected)));
      assert.equal(page.url(), base + '/demo/');
      assert.equal(await page.locator('#demo-workspace').isVisible(), true);
      assert.equal((await context.request.get(base + '/api/auth/me')).status(), 200);
    }
    for (const format of ['flac', 'wav']) {
      await page.locator('#export-format').selectOption(format);
      await page.locator('#export-button').click();
      await page.locator('.download-link').first().waitFor({ timeout: 30000 });
      await downloadLink(page.locator('.download-link').first(), '01 - Track 01.' + format);
    }
    // Two boundaries are input state, not a mocked Export or download.
    await page.evaluate(() => { editableBoundaries = [1.5]; renderTracks(lastAnalysis); });
    await page.locator('#export-button').click();
    await page.locator('.download-link').nth(1).waitFor({ timeout: 30000 });
    for (let index = 0; index < 2; index++) await downloadLink(page.locator('.download-link').nth(index), `0${index + 1} - Track 0${index + 1}.wav`);
    const first = page.locator('.download-link').first(), original = new URL(await first.getAttribute('href'), base);
    const users = JSON.parse(fs.readFileSync(path.join(root, 'tools/runtime/security/users.json'))).users;
    const owner = users.find(user => user.username === 'browsercheck').id, job = original.pathname.split('/')[3];
    const unicode = '03 - เพลงไทย ทดสอบชื่อไฟล์ยาวสำหรับมือถือ.wav';
    fs.writeFileSync(path.join(root, 'exports', owner, job, unicode), wave());
    await first.evaluate((link, name) => {
      link.href = link.href.slice(0, link.href.lastIndexOf('/') + 1) + encodeURIComponent(name);
      link.setAttribute('aria-label', 'Download ' + name); link.parentElement.querySelector('.download-name').textContent = name;
    }, unicode);
    await downloadLink(first, unicode);
    const rendering = [];
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('#export-panel').scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        buttons: [...document.querySelectorAll('.download-link')].map(link => ({ width: link.getBoundingClientRect().width, height: link.getBoundingClientRect().height })),
        brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => a.hash.length > 1 && !document.getElementById(a.hash.slice(1))).length,
        missingAssets: [...document.querySelectorAll('script[src],link[rel=stylesheet]')].filter(el => !performance.getEntriesByName(el.src || el.href).length).length
      }));
      assert.ok(layout.scrollWidth <= width, JSON.stringify(layout));
      assert.ok(layout.buttons.every(button => button.height >= 44));
      assert.equal(layout.brokenAnchors, 0); assert.equal(layout.missingAssets, 0);
      await page.locator('#export-panel').screenshot({ path: path.join(output, 'export-' + width + '.png') });
      rendering.push(layout);
    }
    // The same cookie survives reload; no tokens are stored in download URLs.
    await page.reload(); await page.locator('#demo-workspace').waitFor({ state: 'visible' });
    assert.equal((await context.request.get(original.href)).status(), 200);
    assert.deepEqual(errors, []); assert.equal(requests.filter(type => ['fetch', 'xhr'].includes(type)).length, 0);
    const result = { browser: await browser.version(), nativeDownloads: 5, rendering, pageErrors: errors, downloadRequestTypes: requests, reloadAuthenticated: true };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser?.close(); if (web?.listening) await close(web); if (backend?.listening) await close(backend);
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
