'use strict';
// UI regression on isolated storage/accounts and real workers. Requires installed
// Chrome and Playwright (NODE_PATH); never contacts production or uses real users.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createServer } = require('../server/upload-server.js');
const { createWebServer } = require('../server/web-server.cjs');
const output = path.resolve(__dirname, '../.site-build/split-qa');
const views = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 844]];
function wave() {
  const samples = 12 * 8000, b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) b.writeInt16LE(Math.round(5000 * Math.sin(2 * Math.PI * 440 * i / 8000)), 44 + i * 2);
  return b;
}
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-split-ui-'));
  let backend, web, browser;
  try {
    backend = createServer({ root, freeBytes: () => 100e9 }); await listen(backend);
    web = createWebServer({ backendPort: backend.address().port }); await listen(web);
    const base = 'http://127.0.0.1:' + web.address().port;
    fs.writeFileSync(path.join(root, 'tools/runtime/state.json'), JSON.stringify({ webUrl: base }));
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage(), errors = [], results = [];
    page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(15000);
    async function screenshot(name) { await page.mouse.move(0, 0); await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true, animations: 'disabled' }); }
    async function saveDownload(link) {
      const event = page.waitForEvent('download'); await link.click(); const download = await event;
      assert.equal(await download.failure(), null);
      const target = new URL(await link.getAttribute('href'), base);
      const [job, filename] = target.pathname.split('/').slice(3).map(decodeURIComponent);
      const users = JSON.parse(fs.readFileSync(path.join(root, 'tools/runtime/security/users.json'))).users;
      const owner = users.find(u => u.username === 'splituitest').id;
      assert.equal(download.suggestedFilename(), filename);
      assert.ok(fs.readFileSync(await download.path()).equals(fs.readFileSync(path.join(root, 'exports', owner, job, filename))));
      return filename;
    }
    await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base + '/demo/');
    await page.getByRole('button', { name: 'สมัครฟรี', exact: true }).click();
    await page.locator('#register-username').fill('splituitest'); await page.locator('#register-email').fill('splituitest@example.invalid');
    await page.locator('#register-password').fill('Synthetic-Split-Password-123'); await page.locator('#register-confirm-password').fill('Synthetic-Split-Password-123');
    await page.locator('#register-form button[type=submit]').click();
    await page.locator('#login-panel').waitFor({ state: 'visible' });
    for (const [width, height] of views) {
      await page.setViewportSize({ width, height });
      await screenshot('login-' + width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('#login-username').fill('splituitest'); await page.locator('#login-password').fill('Synthetic-Split-Password-123');
      await page.locator('#login-form button[type=submit]').click(); await page.locator('#demo-workspace').waitFor({ state: 'visible' });
      await screenshot('split-empty-' + width);
      await page.locator('#audio-file').setInputFiles({ name: 'Album-' + 'Long-Recording-Title-'.repeat(5) + '.wav', mimeType: 'audio/wav', buffer: wave() });
      await page.locator('#upload-button').click();
      await page.waitForFunction(() => !document.querySelector('#analyze-button').disabled);
      await page.locator('#analyze-button').click(); await page.locator('#waveform-panel').waitFor({ state: 'visible', timeout: 30000 });
      const waveform = await page.evaluate(() => ({ points: lastAnalysis.waveform.minimum.length, duration: lastAnalysis.duration, detections: lastAnalysis.detections.length }));
      assert.ok(waveform.points > 0); assert.equal(waveform.duration, 12);
      // A deterministic boundary fixture exercises the existing editor, independent
      // of whether this synthetic continuous tone produces detector candidates.
      await page.evaluate(() => { editableBoundaries = [6]; renderTracks(lastAnalysis); renderWaveform(lastAnalysis); });
      assert.equal(await page.locator('.track-row').count(), 2);
      await page.locator('.track-time-input').nth(1).fill('00:00:06.250'); await page.locator('.track-time-input').nth(1).press('Tab');
      assert.equal(await page.locator('.track-time-input').nth(2).inputValue(), '00:00:06.250');
      await page.locator('.track-time-input').nth(2).fill('00:00:05.750'); await page.locator('.track-time-input').nth(2).press('Tab');
      assert.equal(await page.locator('.track-time-input').nth(1).inputValue(), '00:00:05.750');
      await page.locator('.track-play').nth(1).click();
      await page.waitForFunction(() => !audio.paused && audio.currentTime >= 5.75);
      await page.locator('.track-stop').nth(1).click();
      assert.ok(await page.evaluate(() => audio.paused && Math.abs(audio.currentTime - 5.75) < .05));
      const canvas = page.locator('#waveform-canvas'); const rect = await canvas.boundingBox();
      await canvas.click({ position: { x: rect.width * .25, y: rect.height / 2 } });
      assert.ok(await page.evaluate(() => Math.abs(audio.currentTime - 3) < .1));
      await page.locator('.track-play').first().click(); await page.waitForFunction(() => !audio.paused);
      await page.locator('.track-stop').first().click(); assert.ok(await page.evaluate(() => audio.paused && audio.currentTime < .05));
      // Stress layout only; neither title editing nor duration controls are added.
      await page.locator('.track-row > strong').first().evaluate(el => { el.textContent = 'Track 01 — เพลงทดสอบชื่อยาวสำหรับอัลบั้ม / ' + 'LongUnbrokenTitle'.repeat(5); });
      await page.locator('#export-format').selectOption(width === 1024 ? 'wav' : 'flac');
      await page.locator('#export-button').click(); await page.locator('.download-link').nth(1).waitFor({ timeout: 30000 });
      const downloads = [];
      for (let i = 0; i < 2; i++) downloads.push(await saveDownload(page.locator('.download-link').nth(i)));
      assert.equal(page.url(), base + '/demo/');
      const layout = await page.evaluate(() => {
        const bounds = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const overlap = (a, b) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, hero: getComputedStyle(document.querySelector('h1')).fontSize,
          help: getComputedStyle(document.querySelector('.split-drop-help')).fontSize, drop: bounds(document.querySelector('#drop-zone')),
          waveform: bounds(document.querySelector('#waveform-wrap')), canvas: bounds(document.querySelector('#waveform-canvas')),
          timeInputs: [...document.querySelectorAll('.track-time-input')].map(bounds),
          collisions: [...document.querySelectorAll('.track-row')].some(row => { const parts = [...row.children].map(bounds); return parts.some((a, i) => parts.slice(i + 1).some(b => overlap(a, b))); }),
          controls: [...document.querySelectorAll('.track-play,.track-stop,#analyze-button,#export-button,#export-format,.download-link')].map(bounds),
          brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => a.hash.length > 1 && !document.getElementById(a.hash.slice(1))).length
        };
      });
      assert.ok(layout.scrollWidth <= width); assert.equal(layout.collisions, false); assert.equal(layout.brokenAnchors, 0);
      assert.ok(layout.controls.every(r => r.height >= 44)); assert.ok(layout.timeInputs.every(r => r.height >= 44));
      assert.ok(Math.abs(layout.waveform.width - layout.canvas.width) <= 1); assert.ok(layout.waveform.height >= 170);
      await screenshot('split-results-' + width);
      await page.locator('#track-results').screenshot({ path: path.join(output, 'tracks-' + width + '.png') });
      results.push({ viewport: [width, height], waveform, layout, downloads, login: true, uploadAnalyze: true, startEndEditing: true, playStopSeek: true });
      await page.locator('#logout-button').click(); await page.locator('#login-panel').waitFor({ state: 'visible' });
    }
    // Regression of the paired tool uses the same real session, uploads and worker.
    await page.locator('#login-username').fill('splituitest'); await page.locator('#login-password').fill('Synthetic-Split-Password-123');
    await page.locator('#login-form button[type=submit]').click(); await page.locator('#demo-workspace').waitFor({ state: 'visible' });
    await page.locator('.demo-tool-nav a[href="merge/"]').click(); await page.locator('#merge-workspace').waitFor({ state: 'visible' });
    await page.locator('#merge-files').setInputFiles(['One.wav', 'Two.wav'].map(name => ({ name, mimeType: 'audio/wav', buffer: wave() })));
    await page.locator('.merge-actions button').nth(1).click(); assert.equal(await page.locator('.merge-track-info strong').first().textContent(), 'Two.wav');
    await page.locator('#upload-tracks').click(); await page.waitForFunction(() => !document.querySelector('#merge-button').disabled);
    await page.locator('#album-name').fill('Merge regression'); await page.locator('#merge-button').click();
    await page.locator('#merge-download a').waitFor({ timeout: 30000 }); const merged = await saveDownload(page.locator('#merge-download a'));
    await page.locator('.merge-topbar a').click(); await page.locator('#demo-workspace').waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    const report = { browser: await browser.version(), results, mergeRegression: { navigation: true, uploadReorderMergeDownload: true, file: merged }, errors };
    fs.writeFileSync(path.join(output, 'functional-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ viewports: results.map(r => ({ viewport: r.viewport, hero: r.layout.hero, help: r.layout.help, overflow: r.layout.scrollWidth > r.layout.width })), splitDownloads: results.length * 2, mergeRegression: report.mergeRegression, errors }, null, 2));
  } finally {
    await browser?.close(); if (web?.listening) await close(web); if (backend?.listening) await close(backend);
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
