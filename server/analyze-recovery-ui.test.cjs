'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const queueSource = fs.readFileSync(path.join(__dirname, '../dist/demo/queue.js'), 'utf8');
const demoSource = fs.readFileSync(path.join(__dirname, '../dist/demo/demo.js'), 'utf8');

function setup({ jobs, detail, files = [] }) {
  const usedRoutes = [], restorations = [], nodes = new Map();
  function element(tag = 'div') {
    return {
      tag, textContent: '', className: '', children: [], disabled: false,
      events: {},
      addEventListener(type, fn) { this.events[type] = fn; },
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; }
    };
  }
  const document = {
    hidden: false,
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, element());
      return nodes.get(selector);
    },
    createElement: element,
    addEventListener() {}
  };
  const window = {
    demoServer: { isOnline: () => true },
    demoAuth: { user: { username: 'alice', mustChange: false } },
    demoSplitAI: { restoreAnalysis: (job, file) => restorations.push({ job, file }) },
    addEventListener() {}
  };
  async function apiFetch(route, options = {}) {
    usedRoutes.push([route, options.method || 'GET']);
    let data;
    if (route === '/jobs') data = { jobs };
    else if (route === '/uploads') data = { files };
    else if (route.startsWith('/jobs/')) data = detail;
    else throw new Error('Unexpected route ' + route);
    return { ok: true, status: 200, json: async () => data };
  }
  const context = vm.createContext({
    document, window, apiFetch, processingEpoch: 0,
    crypto: { randomUUID: () => 'new-id' }, setInterval() {},
    setTimeout() {}, clearTimeout() {}, console
  });
  vm.runInContext(queueSource, context);
  function allNodes(root) {
    return [root, ...root.children.flatMap(allNodes)];
  }
  return {
    document, window, usedRoutes, restorations, context,
    refresh: async () => vm.runInContext('refreshProcessingJobs()', context),
    buttons: () => allNodes(document.querySelector('#processing-jobs')).filter(n => n.tag === 'button' && n.textContent === 'Load Result')
  };
}

function succeeded(id = 'job-old') {
  return { jobId: id, kind: 'analyze', fileId: 'audio-1', filename: 'Long Album.wav',
    status: 'succeeded', queuedAt: 10, finishedAt: 12, result: undefined };
}

test('recovery reads existing job without POST /analyze', async () => {
  const success = succeeded();
  const b = setup({
    jobs: [{ ...success, status: 'running', jobId: 'job-new', queuedAt: 20 }, success],
    detail: { ...success, result: { duration: 5200, detections: Array(41).fill({ time: 30 }), waveform: { minimum: [0], maximum: [0] } } },
    files: [{ fileId: 'audio-1', name: 'Long Album.wav' }]
  });
  await b.refresh();
  assert.equal(b.buttons().length, 1);
  await b.buttons()[0].events.click();
  assert.equal(b.restorations.length, 1);
  assert.equal(b.restorations[0].job.result.detections.length, 41);
  assert.equal(b.restorations[0].file.fileId, 'audio-1');
  assert.deepEqual(b.usedRoutes.map(x => x[0]), ['/jobs', '/jobs/job-old', '/uploads']);
  assert.equal(b.usedRoutes.some(x => x[1] === 'POST'), false);
});

test('recovery is refused if original uploaded audio was deleted', async () => {
  const s = succeeded();
  const b = setup({ jobs: [s], detail: { ...s, result: { duration: 100, detections: [] } } });
  await b.refresh();
  await b.buttons()[0].events.click();
  assert.equal(b.restorations.length, 0);
  assert.match(b.document.querySelector('#processing-jobs-status').textContent, /Original audio is no longer available/);
});

test('recovery refuses swapped job response', async () => {
  const s = succeeded();
  const b = setup({ jobs: [s], detail: { ...s, fileId: 'other-file', result: {} }, files: [{ fileId: 'audio-1' }] });
  await b.refresh();
  await b.buttons()[0].events.click();
  assert.equal(b.restorations.length, 0);
  assert.match(b.document.querySelector('#processing-jobs-status').textContent, /Analysis result has changed/);
});

test('only most recent successful Analyze for a file gets a restore control', async () => {
  const b = setup({ jobs: [{ ...succeeded('latest'), queuedAt: 100 }, succeeded('older'), { ...succeeded('bad'), status: 'failed', fileId: 'audio-2' }] });
  await b.refresh();
  assert.equal(b.buttons().length, 1);
});

test('normal and recovered Analyze use one renderer and restore method is exposed', () => {
  assert.match(demoSource, /function showAnalysisResult\(data,jobId,elapsedSeconds=null\)/);
  assert.match(demoSource, /showAnalysisResult\(data,completedAnalysisJobId,elapsed\)/);
  assert.match(demoSource, /window\.demoSplitAI\.restoreAnalysis=\(job,file\)=>/);
  assert.match(demoSource, /showAnalysisResult\(job\.result,job\.jobId\)/);
});
