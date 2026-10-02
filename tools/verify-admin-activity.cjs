'use strict';
// Isolated accounts/storage, real Chrome, and no production credentials.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), { spawn } = require('node:child_process');
const { createServer } = require('../server/upload-server.js'), { createWebServer } = require('../server/web-server.cjs');
const { ActivityStore } = require('../server/activity-store.cjs');
const output = path.resolve(__dirname, '../.site-build/activity-qa');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-activity-ui-')); fs.mkdirSync(output, { recursive: true });
  let backend, web, chrome, socket;
  try {
    backend = createServer({ root, runJob: async () => '{}' }); await listen(backend);
    web = createWebServer({ backendPort: backend.address().port }); await listen(web);
    const base = 'http://127.0.0.1:' + web.address().port;
    fs.writeFileSync(path.join(root, 'tools/runtime/state.json'), JSON.stringify({ webUrl: base }));
    const temporary = fs.readFileSync(path.join(root, 'tools/runtime/security/first-login.txt'), 'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
    const db = new ActivityStore(path.join(root, 'tools/runtime/security/activity.sqlite'));
    for (let i = 0; i < 60; i++) db.record({ id: crypto.randomUUID(), owner: crypto.randomUUID(), username: 'deleteduser', kind: 'analyze', fileId: crypto.randomUUID(), filename: 'เพลงชื่อยาวสำหรับทดสอบ ' + 'LongAlbumTitle'.repeat(12) + ' <img src=x onerror=alert(1)>.wav', size: 428600000, status: 'succeeded', queuedAt: Date.now() - 2000, startedAt: Date.now() - 1000, finishedAt: Date.now() });
    db.close();
    const profile = path.join(root, 'chrome-profile');
    chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
    const activePort = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; !fs.existsSync(activePort); i++) { assert.ok(i < 300, 'Chrome did not start'); await pause(50); }
    const [port, endpoint] = fs.readFileSync(activePort, 'utf8').trim().split(/\r?\n/);
    socket = new WebSocket('ws://127.0.0.1:' + port + endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0, session; const pending = new Map(), errors = [];
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.id) { const p = pending.get(data.id); if (p) { clearTimeout(p.timer); pending.delete(data.id); if (data.error) p.reject(new Error(data.error.message)); else p.resolve(data.result); } }
      if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
    });
    function rpc(method, params = {}, targetSession = session) {
      return new Promise((resolve, reject) => {
        const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
        pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
      });
    }
    const target = await rpc('Target.createTarget', { url: 'about:blank' }, null);
    session = (await rpc('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
    await rpc('Runtime.enable'); await rpc('Page.enable');
    async function evaluate(expression) {
      const result = await rpc('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    }
    async function wait(expression) { for (let i = 0; !await evaluate(expression); i++) { if (i >= 300) { console.log(JSON.stringify(await evaluate("({auth:document.querySelector('#auth-message')?.textContent,errors:document.querySelector('#admin-activity-status')?.textContent,loginHidden:document.querySelector('#login-panel')?.hidden})"))); throw new Error('Wait failed: ' + expression + '; runtime errors: ' + errors.join(',')); } await pause(50); } }
    const set = (selector, value) => evaluate('document.querySelector(' + JSON.stringify(selector) + ').value=' + JSON.stringify(value));
    const click = selector => evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
    await rpc('Page.navigate', { url: base + '/demo/' }); await wait("document.readyState==='complete' && document.querySelector('#server-status').classList.contains('is-online') && !document.querySelector('#login-form button[type=submit]').disabled");
    assert.equal(await evaluate("document.querySelector('#activity-toggle').hidden"), true);
    await set('#login-username', 'yod'); await set('#login-password', temporary); await click('#login-form button[type=submit]');
    await wait("!document.querySelector('#password-panel').hidden");
    assert.equal(await evaluate("document.querySelector('#activity-toggle').hidden"), true);
    await set('#current-password', temporary); await set('#new-password', 'Synthetic-Audit-Password-123'); await set('#confirm-password', 'Synthetic-Audit-Password-123');
    await click('#password-form button[type=submit]'); await wait("!document.querySelector('#activity-toggle').hidden");
    await click('#activity-toggle'); await wait("document.querySelectorAll('.activity-row').length===50");
    await click('#more-admin-activity'); await wait("document.querySelectorAll('.activity-row').length===100");
    const ids = await evaluate("[...document.querySelectorAll('.activity-row')].map(el=>el.textContent)"); assert.equal(ids.length, 100);
    await set('#activity-username', 'deleteduser'); await set('#activity-type', 'analyze'); await set('#activity-status', 'completed');
    await evaluate("document.querySelector('#admin-activity-filters').requestSubmit()"); await wait("document.querySelectorAll('.activity-row').length===50 && [...document.querySelectorAll('.activity-user')].every(el=>el.textContent==='deleteduser') && !document.querySelector('#refresh-admin-activity').disabled");
    assert.equal(await evaluate("document.querySelectorAll('#admin-activity-list img').length"), 0);
    assert.equal(await evaluate("document.querySelector('.activity-detail').textContent.includes('<img')"), true);
    await click('#more-admin-activity'); await wait("document.querySelectorAll('.activity-row').length===60");
    assert.equal(await evaluate("document.querySelector('#more-admin-activity').hidden"), true);
    const results = [];
    for (const [width, height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,844]]) {
      await rpc('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await evaluate('scrollTo(0,0)');
      const layout = await evaluate("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('#admin-activity-filters input,#admin-activity-filters select,#refresh-admin-activity')].map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,right:el.getBoundingClientRect().right})),listWidth:document.querySelector('#admin-activity-list').getBoundingClientRect().width})");
      assert.ok(layout.scrollWidth <= width, 'Horizontal overflow at ' + width); assert.ok(layout.controls.every(c => c.width > 60 && c.height >= 38 && c.right <= width));
      const screenshot = await rpc('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'activity-' + width + '.png'), Buffer.from(screenshot.data, 'base64'));
      results.push(layout);
    }
    await set('#activity-username', ''); await set('#activity-type', 'login'); await set('#activity-status', 'completed'); await set('#activity-category', 'authentication');
    await evaluate("document.querySelector('#admin-activity-filters').requestSubmit()"); await wait("document.querySelectorAll('.activity-row').length===1 && !document.querySelector('#refresh-admin-activity').disabled");
    assert.equal(await evaluate("document.querySelector('.activity-user').textContent"), 'yod');
    await click('#refresh-admin-activity'); await wait("document.querySelectorAll('.activity-row').length===1 && !document.querySelector('#refresh-admin-activity').disabled");
    await set('#activity-username', 'nobody'); await evaluate("document.querySelector('#admin-activity-filters').requestSubmit()"); await wait("document.querySelector('#admin-activity-status').textContent==='ไม่พบกิจกรรมตามตัวกรอง'");
    await click('#storage-toggle'); assert.equal(await evaluate("document.querySelector('#admin-activity-panel').open"), false);
    await click('#activity-toggle'); await click('#account-toggle'); assert.equal(await evaluate("document.querySelector('#admin-activity-panel').open"), false);
    await click('#activity-toggle'); await click('#logout-button'); await wait("document.querySelector('#account-bar').hidden");
    assert.equal(await evaluate("document.querySelector('#admin-activity-list').children.length"), 0);
    assert.equal(await evaluate("document.querySelector('#admin-activity-panel').hidden"), true);
    assert.equal(await evaluate("document.querySelector('#activity-username').value"), '');
    // A response arriving after logout must not repopulate the panel.
    await set('#login-username', 'yod'); await set('#login-password', 'Synthetic-Audit-Password-123'); await click('#login-form button[type=submit]'); await wait("!document.querySelector('#activity-toggle').hidden");
    await evaluate("window.auditOriginalRequest=authRequest;window.auditDeferred=null;authRequest=(route,...args)=>route.startsWith('/admin/audit')?new Promise(resolve=>{window.auditDeferred=resolve}):window.auditOriginalRequest(route,...args)");
    await click('#activity-toggle'); await wait('!!window.auditDeferred'); await click('#logout-button'); await wait("document.querySelector('#account-bar').hidden");
    await evaluate("window.auditDeferred({entries:[{timestamp:Date.now(),username:'yod',type:'login',status:'completed'}],nextCursor:null});authRequest=window.auditOriginalRequest"); await pause(100);
    assert.equal(await evaluate("document.querySelector('#admin-activity-list').children.length"), 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors, pagination: true, filtering: true, deletedUserFilter: true, logoutClear: true, lateResponseGuard: true, safeTextRendering: true }, null, 2));
    console.log(JSON.stringify({ viewports: results.map(r => r.width), errors, pagination: true, filtering: true, logoutClear: true, lateResponseGuard: true }));
    await rpc('Browser.close', {}, null).catch(() => {});
  } finally {
    socket?.close(); chrome?.kill(); if (web?.listening) await close(web); if (backend?.listening) await close(backend);
    await pause(200); fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
