'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

test('Phase 4 AI Review UI is cancellable, snapshot-bound and protects manual edits', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'dist/demo/index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'dist/demo/ai-review.js'), 'utf8');
  const demo = fs.readFileSync(path.join(root, 'dist/demo/demo.js'), 'utf8');
  const queue = fs.readFileSync(path.join(root, 'dist/demo/queue.js'), 'utf8');
  const activity = fs.readFileSync(path.join(root, 'dist/demo/admin-activity.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'dist/demo/ai-review.css'), 'utf8');
  for (const id of [
    'ai-review-panel','ai-review-state','ai-review-run','ai-review-cancel','ai-review-connect',
    'ai-review-select-accept','ai-review-clear-selection','ai-review-apply','ai-review-clear',
    'ai-review-status','ai-review-summary','ai-review-list'
  ]) assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(html.includes('04 / AI REVIEW')); assert.ok(html.includes('05 / EXPORT'));
  assert.ok(html.includes('Audio stays on the Server'));
  assert.ok(html.includes('ai-review.css?v=phase4')); assert.ok(html.includes('ai-review.js?v=phase4'));
  assert.ok(html.includes('demo.js?v=performance1')); assert.ok(html.includes('queue.js?v=performance1'));
  assert.ok(js.includes("runProcessingJob('/ai/review'")); assert.ok(js.includes('analysisJobId: snapshot.analysisJobId'));
  assert.ok(js.includes("queuedJSON('/jobs/' + currentJobId + '/cancel'"));
  assert.ok(js.includes("phaseText[job.phase]")); assert.ok(js.includes("'calling-openai'"));
  assert.ok(js.includes("queuedJSON('/jobs')")); assert.ok(js.includes('latest.jobId !== review.analysisJobId'));
  assert.ok(js.includes('boundaryRevision !== review.boundaryRevision'));
  assert.ok(js.includes('confirm(')); assert.ok(js.includes('replace the current manually edited boundaries'));
  assert.ok(js.includes("window.demoSplitAI?.playAround?.(Number(item.time), 5)"));
  assert.ok(js.includes("checkbox.disabled = item.recommendation === 'reject'"));
  assert.ok(js.includes("checkbox.checked = item.recommendation === 'accept'"));
  assert.ok(js.includes("window.audioTechLabsAIModel || 'auto'"));
  assert.ok(demo.includes('analysisJobId=null,boundaryRevision=0'));
  assert.ok(demo.includes('demo-boundaries-changed')); assert.ok(demo.includes('playAround:'));
  assert.ok(demo.includes('allowOverwrite=false'));
  assert.ok(queue.includes('job.canCancel')); assert.ok(queue.includes('errorCode'));
  assert.ok(activity.includes("entry.type === 'ai-review'")); assert.ok(activity.includes('entry.totalTokens'));
  assert.equal(/gpt-[a-z0-9.-]+/i.test(js + html), false, 'frontend must not hard-code an AI Review model ID');
  assert.equal(/localStorage|sessionStorage|indexedDB/.test(js), false);
  assert.equal(js.includes('innerHTML'), false);
  assert.ok(js.includes('NO CANDIDATES')); assert.ok(js.includes('No OpenAI request will be sent.'));
  assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /@media\(max-width:430px\)/);
});
