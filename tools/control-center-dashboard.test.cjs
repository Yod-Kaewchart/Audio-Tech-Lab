'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { validHealth, validAudit, createDashboard } = require('../control-center/frontend/dashboard.js');
const html = fs.readFileSync(path.join(__dirname, '../control-center/frontend/index.html'), 'utf8');
const admin = { user: { role: 'admin', username: 'testadmin', mustChange: false } };
const health = nonce => ({ ok: true, service: 'audio-tech-labs-demo', apiVersion: 1, authentication: true, nonce });
const audit = { entries: [{ auditId: 100, timestamp: 1791341763000, type: 'login', status: 'completed', username: '<img src=x onerror=alert(1)>', category: 'authentication' }], nextCursor: 100 };
const tick = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
class Element {
  constructor() { this.children = []; this.dataset = {}; this.attributes = {}; this.events = {}; this.hidden = false; this.disabled = false; this.checked = true; this.value = ''; this._text = ''; this.classes = new Set(); this.classList = { toggle: (key, on) => on ? this.classes.add(key) : this.classes.delete(key) }; }
  set textContent(value) { this._text = value; this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = [...children]; }
  addEventListener(event, handler) { this.events[event] = handler; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  focus() { this.focused = true; }
}
function page(respond, saved = null) {
  const ids = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
  const actions = [...html.matchAll(/data-action="([^"]+)"/g)].map(match => Object.assign(new Element(), { dataset: { action: match[1] } }));
  const details = [...html.matchAll(/data-details="([^"]+)"/g)].map(match => Object.assign(new Element(), { dataset: { details: match[1] } }));
  const links = ['overview', 'machines', 'health', 'agents', 'activity', 'settings'].map(name => { const node = new Element(); node.setAttribute('href', '#' + name); return node; });
  const events = {}, docEvents = {}, timers = new Map(), calls = [], redirects = [], stored = new Map(saved ? [['atl-control-auto-refresh', saved]] : []);
  let nextTimer = 1;
  const document = { body: new Element(), hidden: false, getElementById: id => ids[id], createElement: () => new Element(),
    querySelectorAll: selector => selector === '[data-action]' ? actions : selector === '[data-details]' ? details : links,
    addEventListener: (name, fn) => { docEvents[name] = fn; } };
  const window = { setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id), addEventListener: (name, fn) => { events[name] = fn; } };
  const location = { _hash: '', get hash() { return this._hash; }, set hash(value) { this._hash = value && !value.startsWith('#') ? '#' + value : value; }, replace: url => redirects.push(url) }, navigator = { onLine: true };
  const fetch = async (url, options) => { calls.push({ url, options }); return respond(url, options, calls.length); };
  const app = createDashboard({ document, window, fetch, location, navigator, nonce: () => 'fresh-challenge', storage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) } });
  return { app, ids, actions, details, links, events, docEvents, timers, calls, redirects, document, location, navigator, stored };
}
function defaults(url) {
  if (url.endsWith('/auth/me')) return Response.json(admin);
  if (url.includes('/health?')) return Response.json(health(new URL(url, 'http://test').searchParams.get('nonce')));
  if (url.includes('/admin/audit')) return Response.json(audit);
  if (url.endsWith('/ai/providers')) return Response.json({ providers: [{ id: 'openai', connected: true }] });
  throw new Error('Unexpected endpoint: ' + url);
}
test('Health rejects cached challenges, wrong services and loose truthy/version values', () => {
  assert.ok(validHealth(health('fresh'), 'fresh'));
  for (const change of [{ nonce: 'old' }, { service: 'other' }, { apiVersion: '1' }, { authentication: 1 }, { ok: 'true' }]) assert.equal(validHealth({ ...health('fresh'), ...change }, 'fresh'), false);
});
test('Audit validates pagination before rendering or loading another page', () => {
  assert.equal(validAudit(audit), true);
  for (const bad of [{ entries: null, nextCursor: null }, { entries: [], nextCursor: 1 }, { entries: [{ auditId: -1 }], nextCursor: null }]) assert.equal(validAudit(bad), false);
});
test('Fresh data renders service scope, actual logs as text, and configured AI without asserting availability', async () => {
  const p = page(defaults); await tick();
  assert.equal(p.ids['backend-status'].textContent, 'SERVICE REACHABLE');
  assert.equal(p.ids['overall-status'].textContent, 'PARTIAL COVERAGE');
  assert.equal(p.ids['provider-status'].textContent, 'Configured');
  assert.match(p.ids['provider-copy'].textContent, /not been tested/);
  assert.match(p.ids['recent-activity'].textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(p.ids['recent-activity'].children[0].children[1].children.length, 0, 'Audit content must never become HTML nodes');
  assert.ok(p.calls.every(call => call.options.cache === 'no-store' && call.options.credentials === 'same-origin'));
  assert.ok([...p.timers.values()].some(timer => timer.ms === 15000));
});
test('Wrong nonce and HTTP errors never render ONLINE even with valid administrator session', async () => {
  for (const response of [Response.json(health('stale')), Response.json({ error: 'maintenance' }, { status: 503 }), new Response('HTML')]) {
    const p = page(url => url.includes('/health?') ? response : defaults(url)); await tick();
    assert.equal(p.ids['backend-status'].textContent, 'UNREACHABLE');
    assert.equal(p.ids['overall-status'].textContent, 'SERVICE UNREACHABLE');
  }
});
test('Partial API failure preserves verified health but clears old logs and provider state', async () => {
  let failed = false;
  const p = page(url => failed && !url.includes('/health?') && !url.endsWith('/auth/me') ? Response.json({}, { status: 500 }) : defaults(url)); await tick();
  failed = true; await p.app.refresh();
  assert.equal(p.ids['backend-status'].textContent, 'SERVICE REACHABLE');
  assert.equal(p.ids['provider-status'].textContent, 'Unknown');
  assert.equal(p.ids['overall-status'].textContent, 'CHECKS INCOMPLETE');
  assert.equal(p.ids['recent-activity'].children.length, 0);
  assert.equal(p.ids['older-activity'].hidden, true);
});
test('Expired, non-admin and forced-password-change sessions return to login without showing data', async () => {
  for (const value of [Response.json({}, { status: 401 }), Response.json({ user: { role: 'user' } }), Response.json({ user: { role: 'admin', mustChange: true } })]) {
    const p = page(url => url.endsWith('/auth/me') ? value : defaults(url)); await tick();
    assert.deepEqual(p.redirects, ['/control-center/login/']); assert.equal(p.document.body.hidden, true);
    assert.equal(p.calls.some(call => call.url.includes('/admin/audit')), false);
  }
});
test('Expired session while reading activity immediately hides old data', async () => {
  const p = page(url => url.includes('/admin/audit') ? Response.json({}, { status: 401 }) : defaults(url)); await tick();
  assert.equal(p.document.body.hidden, true); assert.deepEqual(p.redirects, ['/control-center/login/']);
  assert.equal(p.ids['recent-activity'].children.length, 0);
});
test('Offline event invalidates an in-flight response, including one ignoring abort', async () => {
  let release;
  const p = page(url => url.includes('/health?') ? new Promise(resolve => { release = resolve; }) : defaults(url));
  await tick(); p.navigator.onLine = false; p.events.offline(); release(Response.json(health('fresh-challenge'))); await tick();
  assert.equal(p.ids['backend-status'].textContent, 'UNKNOWN');
  assert.match(p.ids['refresh-message'].textContent, /offline/);
  assert.equal([...p.timers.values()].some(timer => timer.ms === 15000), false);
});
test('Immediate reconnect retries even with auto refresh off and a previous aborted check still settling', async () => {
  let release, checks = 0;
  const p = page(url => url.includes('/health?') && checks++ === 0 ? new Promise(resolve => { release = resolve; }) : defaults(url), 'off');
  await tick(); p.navigator.onLine = false; p.events.offline(); p.navigator.onLine = true; p.events.online();
  release(Response.json(health('fresh-challenge'))); await tick();
  assert.equal(p.ids['backend-status'].textContent, 'SERVICE REACHABLE');
  assert.equal(checks, 2); assert.equal([...p.timers.values()].some(timer => timer.ms === 15000), false);
});
test('Duplicate refresh actions share one set of requests', async () => {
  let release;
  const p = page(url => url.includes('/health?') ? new Promise(resolve => { release = resolve; }) : defaults(url));
  const second = p.app.refresh(); const third = p.app.refresh(); await tick();
  assert.equal(p.calls.filter(call => call.url.includes('/health?')).length, 1);
  release(Response.json(health('fresh-challenge'))); await Promise.all([second, third]);
});
test('All menu destinations, diagnostics actions and Details controls have concrete behavior', async () => {
  const p = page(defaults); await tick();
  for (const link of p.links) {
    p.location.hash = link.getAttribute('href'); p.events.hashchange();
    const view = p.location.hash.slice(1); assert.equal(p.ids[view + '-panel'].hidden, false); assert.equal(link.getAttribute('aria-current'), 'page');
  }
  p.actions.find(button => button.dataset.action === 'diagnose').events.click(); await tick();
  assert.equal(p.location.hash, '#health'); assert.equal(p.ids['health-panel'].hidden, false); assert.equal(p.ids['page-title'].focused, true);
  p.ids['modify-details'].hidden = true; p.details.find(button => button.dataset.details === 'modify-details').events.click();
  assert.equal(p.ids['modify-details'].hidden, false);
  p.ids['auto-refresh'].checked = false; p.ids['auto-refresh'].events.change(); assert.equal(p.stored.get('atl-control-auto-refresh'), 'off');
});
test('Activity pagination appends older entries and hides the exhausted cursor', async () => {
  const p = page(url => url.includes('&before=') ? Response.json({ entries: [{ ...audit.entries[0], auditId: 99 }], nextCursor: null }) : defaults(url)); await tick();
  await p.app.older(); assert.equal(p.ids['activity-list'].children.length, 2); assert.equal(p.ids['older-activity'].hidden, true);
});
test('Activity pagination response cannot overwrite logs after a fresh refresh', async () => {
  let release;
  const p = page(url => url.includes('&before=') ? new Promise(resolve => { release = resolve; }) : defaults(url)); await tick();
  const old = p.app.older(); await p.app.refresh(); release(Response.json({ entries: [{ ...audit.entries[0], auditId: 99 }], nextCursor: null })); await old;
  assert.equal(p.ids['activity-list'].children.length, 1); assert.equal(p.ids['older-activity'].hidden, false);
});
test('Pagehide invalidates old requests and cached-page restoration rechecks current status', async () => {
  const p = page(defaults); await tick(); p.events.pagehide();
  assert.equal(p.ids['backend-status'].textContent, 'UNKNOWN');
  p.events.pageshow({ persisted: true }); await tick(); assert.equal(p.ids['backend-status'].textContent, 'SERVICE REACHABLE');
});
test('A response body hanging beyond the deadline is aborted and cannot report healthy', async () => {
  const p = page((url, options) => url.includes('/health?') ? {
    ok: true, headers: new Headers({ 'content-type': 'application/json' }),
    json: () => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
  } : defaults(url));
  await tick(); for (const timer of [...p.timers.values()].filter(timer => timer.ms === 5000)) timer.fn(); await tick();
  assert.equal(p.ids['backend-status'].textContent, 'UNREACHABLE');
});
