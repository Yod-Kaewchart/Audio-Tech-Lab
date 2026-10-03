'use strict';
(() => {
  const API = '/api';
  const statusNode = () => document.querySelector('#server-status');
  const offlineText = 'เซิร์ฟเวอร์ประมวลผลออฟไลน์ชั่วคราว ระบบจะเชื่อมต่อให้อัตโนมัติเมื่อพร้อมใช้งาน';
  let state = 'checking', inFlight = null, sequence = 0;
  const waiters = new Set();

  function render(next) {
    const node = statusNode();
    if (node) {
      node.className = 'server-status is-' + next;
      const label = node.querySelector('span');
      if (label) label.textContent = next === 'online' ? 'SERVER ONLINE' : next === 'offline' ? 'SERVER OFFLINE' : 'SERVER CHECKING';
    }
    document.documentElement.dataset.serverState = next;
  }

  function setState(next) {
    if (!['checking', 'online', 'offline'].includes(next)) throw new Error('Invalid server state');
    const previous = state;
    state = next;
    window.demoServerState = next;
    render(next);
    if (next === 'online') {
      for (const resolve of waiters) resolve();
      waiters.clear();
    }
    if (previous !== next) window.dispatchEvent(new CustomEvent('demo-server-state', { detail: { state: next, previous } }));
  }

  async function probe({ visibleChecking = false } = {}) {
    if (inFlight) return inFlight;
    const requestId = ++sequence;
    if (visibleChecking && state !== 'checking') setState('checking');
    inFlight = (async () => {
      const controller = new AbortController();
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
        if (requestId === sequence) setState(online ? 'online' : 'offline');
        return online;
      } catch {
        if (requestId === sequence) setState('offline');
        return false;
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }

  function requireOnline() {
    if (state === 'online') return;
    void probe();
    const error = new Error(offlineText);
    error.offline = true;
    throw error;
  }
  function whenOnline() {
    if (state === 'online') return Promise.resolve();
    return new Promise(resolve => waiters.add(resolve));
  }

  const api = {
    get state() { return state; },
    offlineText,
    check: probe,
    requireOnline,
    whenOnline,
    isOnline: () => state === 'online'
  };
  window.demoServer = api;
  window.demoServerState = state;
  render(state);
  void probe();

  setInterval(() => { void probe(); }, 15000);
  window.addEventListener('online', () => { void probe(); });
  window.addEventListener('pageshow', () => { void probe(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void probe();
  });
})();
