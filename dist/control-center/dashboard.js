'use strict';
(() => {
  const views = { overview: 'System Operations', machines: 'Machines', health: 'System Health', agents: 'AI Agents', activity: 'Activity Logs', settings: 'Settings' };
  function validHealth(value, nonce) {
    return value?.ok === true && value.service === 'audio-tech-labs-demo' && value.apiVersion === 1 && value.authentication === true && value.nonce === nonce;
  }
  function validAudit(value) {
    return Array.isArray(value?.entries) && value.entries.length <= 50 && value.entries.every(entry => entry && typeof entry === 'object' && Number.isSafeInteger(entry.auditId) && entry.auditId > 0) &&
      (value.nextCursor === null || (Number.isSafeInteger(value.nextCursor) && value.nextCursor > 0 && value.nextCursor === value.entries.at(-1)?.auditId));
  }
  function createDashboard({ document, window, fetch, location, navigator, storage, now = Date.now, nonce = () => window.crypto.randomUUID(), isSigningOut = () => false }) {
    const $ = id => document.getElementById(id);
    let epoch = 0, running = null, timer = null, stopped = false, cursor = null, logVersion = 0, loadingOlder = false, resumePending = false;
    const requests = new Set(), checks = new Map();
    const automatic = $('auto-refresh');
    try { automatic.checked = storage.getItem('atl-control-auto-refresh') !== 'off'; } catch {}
    const stamp = value => new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false });
    const errorText = error => error?.status ? 'HTTP ' + error.status : error?.name === 'AbortError' ? 'Check timed out or was interrupted' : 'No valid response received';
    function status(id, state, text) { const element = $(id); element.dataset.state = state; element.textContent = text; }
    function check(name, state, detail) { checks.set(name, { state, detail }); }
    function renderChecks() {
      const list = $('health-checks'); list.replaceChildren();
      for (const [name, { state, detail }] of checks) {
        const row = document.createElement('div'); row.className = 'check-row';
        const title = document.createElement('strong'); title.textContent = name;
        const badge = document.createElement('span'); badge.className = 'status'; badge.dataset.state = state === 'passed' ? 'online' : state === 'failed' ? 'offline' : 'unknown'; badge.textContent = state.toUpperCase();
        const copy = document.createElement('p'); copy.textContent = detail;
        row.append(title, badge, copy); list.append(row);
      }
    }
    function backend(state, detail) {
      status('backend-status', state, state === 'online' ? 'SERVICE REACHABLE' : state === 'offline' ? 'UNREACHABLE' : 'UNKNOWN');
      status('demo-status', state, state === 'online' ? 'API REACHABLE' : state === 'offline' ? 'API UNREACHABLE' : 'API UNKNOWN');
      $('backend-metric').textContent = state === 'online' ? 'Reachable' : state === 'offline' ? 'Unreachable' : 'Unknown';
      $('backend-copy').textContent = detail;
    }
    function reset(message) {
      backend('unknown', message);
      status('overall-status', 'unknown', 'STATUS UNKNOWN');
      $('diagnostic-summary').textContent = 'Unknown';
      $('provider-status').textContent = 'Unknown'; $('provider-copy').textContent = message;
      $('recent-activity').replaceChildren(); $('activity-list').replaceChildren();
      $('recent-activity').textContent = message; $('activity-message').textContent = message;
      cursor = null; $('older-activity').hidden = true;
      checks.clear(); check('Monitoring', 'unknown', message); renderChecks();
    }
    async function json(path) {
      const controller = new AbortController(); requests.add(controller);
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch('/api' + path, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Object.assign(new Error('Request failed'), { status: response.status });
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('JSON response required');
        return await response.json();
      } finally { window.clearTimeout(timeout); requests.delete(controller); }
    }
    function showLogs(target, entries, append = false) {
      if (!append) target.replaceChildren();
      if (!entries.length && !append) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No recorded activity.'; target.append(empty); }
      for (const entry of entries) {
        const row = document.createElement('div'); row.className = 'event';
        const time = document.createElement('time'); time.className = 'time';
        const timestamp = Number.isSafeInteger(entry.timestamp) && entry.timestamp > 0 && entry.timestamp < 8640000000000000 ? entry.timestamp : null;
        time.textContent = timestamp ? new Date(timestamp).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) : '—';
        if (timestamp) { time.dateTime = new Date(timestamp).toISOString(); time.title = stamp(timestamp) + ' (Bangkok)'; }
        const text = document.createElement('span');
        text.textContent = [entry.type || entry.kind || 'event', entry.status, entry.username, entry.filename].filter(value => typeof value === 'string' && value).join(' · ');
        const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = String(entry.category || 'processing').toUpperCase();
        row.append(time, text, tag); target.append(row);
      }
    }
    function schedule() {
      window.clearTimeout(timer);
      if (!stopped && automatic.checked && !document.hidden && navigator.onLine !== false) timer = window.setTimeout(refresh, 15000);
    }
    function busy(value) {
      for (const button of document.querySelectorAll('[data-action]')) button.disabled = value;
      $('older-activity').disabled = value || loadingOlder;
    }
    function requireLogin() { stopped = true; invalidate('Administrator session ended.'); document.body.hidden = true; location.replace('/control-center/login/'); }
    async function refresh() {
      if (stopped || isSigningOut()) return;
      if (running) return running;
      if (navigator.onLine === false) { invalidate('Browser is offline. Reconnect to check current status.'); return; }
      window.clearTimeout(timer);
      const version = ++epoch; ++logVersion;
      busy(true); $('refresh-message').textContent = 'Checking current service data...';
      const current = () => version === epoch && !stopped && !isSigningOut();
      running = (async () => {
        try {
          const challenge = nonce(), started = now();
          const [session, health] = await Promise.allSettled([json('/auth/me'), json('/health?nonce=' + encodeURIComponent(challenge))]);
          if (!current()) return;
          if (session.status === 'rejected') {
            if ([401, 403].includes(session.reason?.status)) return requireLogin();
            reset('Administrator session could not be verified. Try Refresh.');
            $('refresh-message').textContent = 'Checks unavailable: ' + errorText(session.reason); return;
          }
          if (session.value?.user?.role !== 'admin' || session.value.user.mustChange) return requireLogin();
          $('account-user').textContent = (session.value.user.username || 'admin').toUpperCase() + ' / ADMIN';
          const healthy = health.status === 'fulfilled' && validHealth(health.value, challenge);
          const finished = now();
          checks.clear(); check('Administrator session', 'passed', 'Administrator access verified.');
          backend(healthy ? 'online' : 'offline', healthy ? 'Verified ' + stamp(finished) + ' (Bangkok) · ' + Math.max(0, finished - started) + ' ms including session verification' : 'Backend check failed. This does not prove the machine is powered off.');
          check('Backend via public edge', healthy ? 'passed' : 'failed', healthy ? 'Fresh backend response verified; API version 1 and authentication enabled.' : health.status === 'rejected' ? errorText(health.reason) : 'Response failed service identity, API version or freshness validation.');
          check('Modify workstation', 'unknown', 'No authenticated monitoring connection configured.');
          check('Remote repair agent', 'unknown', 'No remote agent configured.');
          status('overall-status', healthy ? 'unknown' : 'offline', healthy ? 'PARTIAL COVERAGE' : 'SERVICE UNREACHABLE');
          renderChecks();
          const [audit, provider] = await Promise.allSettled([json('/admin/audit?limit=50'), json('/ai/providers')]);
          if (!current()) return;
          if ([audit, provider].some(result => result.status === 'rejected' && [401, 403].includes(result.reason?.status))) return requireLogin();
          const auditOK = audit.status === 'fulfilled' && validAudit(audit.value);
          if (auditOK) {
            showLogs($('recent-activity'), audit.value.entries.slice(0, 3)); showLogs($('activity-list'), audit.value.entries);
            cursor = audit.value.nextCursor; $('older-activity').hidden = cursor === null;
            $('activity-message').textContent = 'Latest recorded operations · times shown in Bangkok. Refreshed ' + stamp(now()) + '.';
          } else {
            cursor = null; $('older-activity').hidden = true;
            $('recent-activity').replaceChildren(); $('activity-list').replaceChildren();
            $('recent-activity').textContent = 'Activity unavailable. Try Refresh.'; $('activity-message').textContent = 'Activity unavailable. Try Refresh.';
          }
          check('Activity logs', auditOK ? 'passed' : 'failed', auditOK ? 'Read from the administrator audit log.' : 'Recorded activity could not be read.');
          const item = provider.status === 'fulfilled' && Array.isArray(provider.value?.providers) ? provider.value.providers.find(value => value?.id === 'openai') : null;
          const providerOK = typeof item?.connected === 'boolean';
          $('provider-status').textContent = providerOK ? item.connected ? 'Configured' : 'Not connected' : 'Unknown';
          $('provider-copy').textContent = providerOK ? item.connected ? 'A saved OpenAI connection exists for this administrator. Provider availability has not been tested.' : 'No OpenAI connection is saved for this administrator.' : 'Saved integration status could not be read. Try Refresh.';
          check('OpenAI configuration', providerOK ? 'passed' : 'failed', $('provider-copy').textContent);
          renderChecks();
          $('diagnostic-summary').textContent = healthy && auditOK && providerOK ? 'Checks passed' : 'Needs attention';
          status('overall-status', healthy ? 'unknown' : 'offline', healthy ? auditOK && providerOK ? 'PARTIAL COVERAGE' : 'CHECKS INCOMPLETE' : 'SERVICE UNREACHABLE');
          $('refresh-message').textContent = 'Last check: ' + stamp(now()) + ' (Bangkok). Modify and remote repair remain unmonitored.';
        } catch {
          if (current()) { reset('Checks unavailable. Try Refresh.'); $('refresh-message').textContent = 'Checks unavailable. Try Refresh.'; }
        }
      })();
      try { await running; } finally {
        running = null; busy(false);
        if (resumePending && !stopped && !document.hidden && navigator.onLine !== false) { resumePending = false; refresh(); }
        else { resumePending = false; schedule(); }
      }
    }
    function resume() { if (running) { resumePending = true; return running; } return refresh(); }
    function invalidate(message) {
      ++epoch; ++logVersion;
      window.clearTimeout(timer); for (const controller of requests) controller.abort();
      reset(message); $('refresh-message').textContent = message;
    }
    async function older() {
      if (running || loadingOlder || cursor === null || stopped || isSigningOut()) return;
      const version = ++logVersion, previous = cursor;
      loadingOlder = true; $('older-activity').disabled = true; $('activity-message').textContent = 'Loading older activity...';
      try {
        const value = await json('/admin/audit?limit=50&before=' + previous);
        if (version !== logVersion || stopped || isSigningOut()) return;
        if (!validAudit(value) || value.entries.some(entry => entry.auditId >= previous)) throw new Error('Invalid audit page');
        showLogs($('activity-list'), value.entries, true); cursor = value.nextCursor; $('older-activity').hidden = cursor === null;
        $('activity-message').textContent = 'Older operations loaded · times shown in Bangkok.';
      } catch (error) {
        if (version !== logVersion || stopped || isSigningOut()) return;
        if ([401, 403].includes(error.status)) return requireLogin();
        $('activity-message').textContent = 'Older activity unavailable. Try Load Older again.';
      } finally { loadingOlder = false; $('older-activity').disabled = Boolean(running); }
    }
    function route(focus = false) {
      const view = Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
      for (const name of ['machines', 'overview', 'health', 'agents', 'activity', 'settings']) $(name + '-panel').hidden = name === 'machines' ? !['overview', 'machines'].includes(view) : name !== view;
      for (const link of document.querySelectorAll('.nav a')) {
        const active = link.getAttribute('href') === '#' + view;
        link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      }
      $('page-title').textContent = views[view]; $('page-eyebrow').textContent = 'CONTROL CENTER / ' + view.toUpperCase();
      if (focus) $('page-title').focus();
    }
    for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => {
      if (['health', 'diagnose'].includes(button.dataset.action)) { location.hash = 'health'; route(true); }
      refresh();
    });
    for (const button of document.querySelectorAll('[data-details]')) button.addEventListener('click', () => {
      const detail = $(button.dataset.details); detail.hidden = !detail.hidden; button.setAttribute('aria-expanded', String(!detail.hidden));
    });
    $('older-activity').addEventListener('click', older);
    automatic.addEventListener('change', () => { try { storage.setItem('atl-control-auto-refresh', automatic.checked ? 'on' : 'off'); } catch {} if (automatic.checked) refresh(); else window.clearTimeout(timer); });
    window.addEventListener('hashchange', () => route(true));
    window.addEventListener('offline', () => invalidate('Browser is offline. Reconnect to check current status.'));
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) invalidate('Checks paused while this page is hidden.'); else resume();
    });
    window.addEventListener('pagehide', () => { stopped = true; invalidate('Rechecking session on return.'); });
    window.addEventListener('pageshow', event => { if (event.persisted) { stopped = false; resume(); } });
    route(); refresh();
    return { refresh, invalidate, older, route };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validHealth, validAudit, createDashboard };
  else createDashboard({ document, window, fetch: window.fetch.bind(window), location: window.location, navigator: window.navigator,
    storage: { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) },
    isSigningOut: () => logoutPending });
})();
