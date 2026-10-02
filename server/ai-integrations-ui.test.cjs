'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

test('AI & Integrations UI is user-visible, provider-driven and never stores API keys in browser storage', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'dist/demo/index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'dist/demo/ai-integrations.js'), 'utf8');
  const auth = fs.readFileSync(path.join(root, 'dist/demo/auth.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'dist/demo/ai-integrations.css'), 'utf8');
  const account = html.indexOf('id="account-name"'), ai = html.indexOf('id="ai-integrations-toggle"');
  const storage = html.indexOf('id="storage-toggle"'), logout = html.indexOf('id="logout-button"');
  assert.ok(account >= 0 && ai > account && storage > ai && logout > storage);
  for (const id of ['ai-integrations-panel', 'ai-openai-badge', 'ai-openai-key', 'ai-openai-test',
    'ai-openai-connect', 'ai-openai-connected-view', 'ai-openai-model', 'ai-openai-test-connected',
    'ai-openai-change', 'ai-openai-disconnect', 'ai-openai-message']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.match(html, /id="ai-openai-key" type="password"[^>]*data-no-password-toggle[^>]*autocomplete="off"/);
  assert.ok(auth.includes(':not([data-no-password-toggle])'));
  assert.ok(html.includes('ai-integrations.css?v=phase2'));
  assert.ok(html.indexOf('ai-integrations.js?v=phase2') < html.indexOf('auth.js?v=ai-integrations2'));
  assert.equal(/localStorage|sessionStorage|indexedDB/.test(js), false);
  for (const route of ['/ai/providers', '/ai/openai/test', '/ai/openai/credential', '/ai/openai/models']) assert.ok(js.includes(route), route);
  assert.equal(/gpt-[a-z0-9.-]+/i.test(html + js), false, 'frontend must not hard-code model IDs');
  assert.ok(js.includes("const allowed = Boolean(event.detail?.user && !event.detail.user.mustChange)"));
  assert.ok(html.includes('<option value="integration">AI &amp; Integrations</option>'));
  for (const type of ['openai-connected', 'openai-disconnected', 'openai-test-failed']) assert.ok(html.includes('value="' + type + '"'));
  assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /@media\(max-width:430px\)/);
  assert.ok(js.includes("clearKey();"));
});
