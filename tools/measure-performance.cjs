'use strict';
// Read-only public baseline; local measurements use an isolated backend/account.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { chromium } = require('playwright');
const { createServer } = require('../server/upload-server.js');
const { createWebServer } = require('../server/web-server.cjs');
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', r));
const close = async s => { if (s?.listening) { s.closeAllConnections(); await new Promise(r => s.close(r)); } };
const pause = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  const label = process.argv[2] || 'local';
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid measurement label');
  const publicRun = process.argv.includes('--public');
  const output = path.resolve(__dirname, 'runtime/performance'); fs.mkdirSync(output, { recursive: true });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-performance-'));
  let backend, web, browser;
  const report = { label, timestamp: new Date().toISOString(), publicRun, measurements: [] };
  try {
    let base = 'https://demo.audiotechlabs.com';
    if (!publicRun) {
      backend = createServer({ root }); await listen(backend);
      web = createWebServer({ backendPort: backend.address().port, ...(process.env.ATL_PERF_DIST ? { root: path.resolve(process.env.ATL_PERF_DIST) } : {}) }); await listen(web);
      base = 'http://127.0.0.1:' + web.address().port;
      fs.writeFileSync(path.join(root, 'tools/runtime/state.json'), JSON.stringify({ webUrl: base }));
    }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    report.browser = browser.version();
    for (const width of [390, 1440]) for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      if (!publicRun) {
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 200000, uploadThroughput: 100000 });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      }
      const requests = [], failures = [], errors = [], consoleMessages = [], responses = [], networkHttpErrors = [];
      let wireBytes = 0;
      cdp.on('Network.loadingFinished', e => { wireBytes += e.encodedDataLength; });
      cdp.on('Network.responseReceived', ({ response }) => { if (response.status >= 400) networkHttpErrors.push({ path: new URL(response.url).pathname, status: response.status }); });
      page.on('request', r => requests.push({ path: new URL(r.url()).pathname, method: r.method() }));
      page.on('requestfailed', r => failures.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (['warning','error'].includes(m.type())) consoleMessages.push(m.text()); });
      page.on('response', r => { if (r.status() >= 400) responses.push({ path: new URL(r.url()).pathname, status: r.status() }); });
      await page.addInitScript(() => {
        window.perfSample = { lcp: null, cls: 0, longTasks: [] };
        new PerformanceObserver(list => { for (const e of list.getEntries()) window.perfSample.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.perfSample.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => { for (const e of list.getEntries()) window.perfSample.longTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true });
      });
      await page.goto(base + '/demo/', { waitUntil: 'load', timeout: 60000 }); await pause(2000);
      const metrics = await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0], resources = performance.getEntriesByType('resource');
        return { ...window.perfSample, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd,
          transferBytes: n.transferSize + resources.reduce((s,e) => s+e.transferSize,0),
          decodedJS: resources.filter(e=>e.name.includes('.js')).reduce((s,e)=>s+e.decodedBodySize,0),
          decodedCSS: resources.filter(e=>e.name.includes('.css')).reduce((s,e)=>s+e.decodedBodySize,0),
          overflow: document.documentElement.scrollWidth > innerWidth, state: window.demoServer?.state };
      });
      const sample = { width, run, ...metrics, wireBytes, requests, failures, errors, consoleMessages, responses, networkHttpErrors };
      await page.screenshot({ path: path.join(output, `${label}-${width}-${run}.png`), fullPage: true });
      report.measurements.push(sample); await context.close();
    }
    if (!publicRun) {
      const context = await browser.newContext(), page = await context.newPage();
      const password = 'Synthetic-Performance-123';
      await context.request.post(base+'/api/auth/register', { headers: { Origin: base }, data: { username: 'perftest', email: 'perftest@example.invalid', password } });
      await context.request.post(base+'/api/auth/login', { headers: { Origin: base }, data: { username: 'perftest', password } });
      await page.goto(base+'/demo/'); await page.locator('#demo-workspace').waitFor({state:'visible'}); await pause(1000);
      const calls = []; page.on('request', r=> { if (r.url().includes('/api/')) calls.push(new URL(r.url()).pathname); });
      await page.evaluate(() => { window.queueMutations = 0; new MutationObserver(m=>window.queueMutations+=m.length).observe(document.querySelector('#processing-jobs'),{subtree:true,childList:true}); });
      await pause(31000);
      report.idle31s = { requests: calls.splice(0), queueMutations: await page.evaluate(()=>window.queueMutations) };
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable:true, get:()=>true }); document.dispatchEvent(new Event('visibilitychange')); });
      await pause(1000); calls.length = 0; await pause(31000);
      report.hidden31s = { requests: calls.splice(0), note: 'Synthetic document.hidden + visibilitychange; browser scheduling remains foreground.' };
      await context.close();
    }
  } finally {
    await browser?.close(); await close(web); await close(backend);
    fs.writeFileSync(path.join(output, label+'.json'), JSON.stringify(report,null,2));
    if (!root.startsWith(path.join(os.tmpdir(),'atl-performance-'))) throw new Error('Unsafe cleanup');
    await fs.promises.rm(root, { recursive:true, force:true, maxRetries:10, retryDelay:200 });
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(e=>{ console.error(e); process.exitCode=1; });
