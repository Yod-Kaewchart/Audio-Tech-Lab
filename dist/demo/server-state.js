'use strict';
(() => {
  if (window.demoServer) return;
  const API = '/api';
  const statusNode = () => document.querySelector('#server-status');
  const offlineText = 'เซิร์ฟเวอร์ประมวลผลออฟไลน์ชั่วคราว ระบบจะเชื่อมต่อให้อัตโนมัติเมื่อพร้อมใช้งาน';
  const maxAge = 20000;
  let state = 'checking', inFlight = null, sequence = 0, verifiedAt = 0, activeController;
  const waiters = new Set();

  function render(next) {
    const node = statusNode();
    if (node) {
      node.className = 'server-status is-' + next;
      const label = node.querySelector('span');
      if (label) label.textContent = next === 'online' ? 'SERVER ONLINE' : next === 'offline' ? 'SERVER OFFLINE' : 'SERVER CHECKING';
    }
    document.documentElement.dataset.serverState = next;
    let notice = document.querySelector('#server-offline-message') || document.querySelector('#connection-notice');
    if (!notice && document.createElement) {
      notice = document.createElement('p');
      notice.id = 'connection-notice'; notice.className = 'connection-notice';
      notice.setAttribute('role', 'status');
      document.querySelector('main')?.prepend(notice);
    }
    if (notice) { notice.hidden = next !== 'offline'; notice.textContent = offlineText; }
  }

  function setState(next) {
    if (!['checking', 'online', 'offline'].includes(next)) throw new Error('Invalid server state');
    const previous = state;
    state = next;
    window.demoServerState = next;
    if (previous !== next) render(next);
    if (next === 'online') {
      for (const resolve of waiters) resolve();
      waiters.clear();
    }
    if (previous !== next) window.dispatchEvent(new CustomEvent('demo-server-state', { detail: { state: next, previous } }));
  }

  async function probe({ visibleChecking = false, reason = 'poll' } = {}) {
    if (inFlight) return inFlight;
    const requestId = ++sequence;
    if (visibleChecking && state !== 'checking') setState('checking');
    inFlight = (async () => {
      const controller = new AbortController();
      activeController = controller;
      let timeout;
      try {
        const nonce = crypto.randomUUID();
        const deadline = new Promise((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error('Health timeout'));
          }, 5000);
        });
        const fetchHealth = (async () => {
          const response = await fetch(API + '/health?nonce=' + encodeURIComponent(nonce), {
            cache: 'no-store',
            credentials: 'same-origin',
            redirect: 'error',
            signal: controller.signal,
            headers: { Accept: 'application/json', 'Cache-Control': 'no-store, no-cache', Pragma: 'no-cache' }
          });
          if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return false;
          const health = await response.json();
          return health?.ok === true &&
            health.service === 'audio-tech-labs-demo' &&
            health.apiVersion === 1 &&
            health.authentication === true &&
            health.nonce === nonce;
        })();
        const online = await Promise.race([fetchHealth, deadline]) === true;
        if (requestId !== sequence) return false;
        verifiedAt = online ? Date.now() : 0;
        setState(online ? 'online' : 'offline');
        if (online) window.dispatchEvent(new CustomEvent('demo-server-verified', { detail: { reason } }));
        return online;
      } catch {
        if (requestId === sequence) setState('offline');
        return false;
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    })().finally(() => { inFlight = null; activeController = null; });
    return inFlight;
  }

  function requireOnline() {
    if (isFresh()) return;
    void probe();
    const error = new Error(offlineText);
    error.offline = true;
    throw error;
  }
  function whenOnline() {
    if (isFresh()) return Promise.resolve();
    void probe();
    return new Promise(resolve => waiters.add(resolve));
  }
  function isFresh() { return state === 'online' && Date.now() - verifiedAt >= 0 && Date.now() - verifiedAt < maxAge; }
  function unavailable() {
    // Keep the flight locked until the aborted request settles or times out.
    ++sequence; activeController?.abort(); verifiedAt = 0;
    setState('offline');
    return Object.assign(new Error(offlineText), { offline: true });
  }
  async function ensureOnline() {
    if (!isFresh() && !await probe({ visibleChecking: state === 'online' })) throw Object.assign(new Error(offlineText), { offline: true });
    requireOnline();
  }
  // One attempt only. A failed mutation may already have reached the backend.
  async function request(url, options = {}) {
    await ensureOnline();
    let response;
    try { response = await fetch(url, { ...options, cache: 'no-store', credentials: 'same-origin' }); }
    catch (cause) { throw Object.assign(unavailable(), { cause }); }
    if (response.status >= 500 || !response.headers.get('content-type')?.includes('application/json')) throw unavailable();
    return response;
  }

  const api = {
    get state() { return state; },
    offlineText,
    check: probe,
    ensureOnline,
    request,
    unavailable,
    get verifiedAt() { return verifiedAt; },
    requireOnline,
    whenOnline,
    isOnline: () => state === 'online'
  };
  window.demoServer = api;
  window.demoServerState = state;
  render(state);
  void probe();

  setInterval(() => { if (!document.hidden) void probe(); }, 15000);
  window.addEventListener('offline', unavailable);
  window.addEventListener('online', () => { void probe({ reason: 'resume' }); });
  window.addEventListener('pageshow', event => { if (event.persisted) void probe({ reason: 'resume' }); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void probe({ reason: 'resume', visibleChecking: state === 'online' && !isFresh() });
  });
})();
