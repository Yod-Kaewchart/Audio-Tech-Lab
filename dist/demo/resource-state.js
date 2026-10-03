'use strict';
// Reconcile against authenticated server state after manual deletion, other tabs,
// admin actions and retention. Never restore resources from a browser cache.
(() => {
  let refreshing = false;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('demo-resource-changes') : null;
  async function refresh() {
    if (refreshing || !window.demoResourceView || !window.demoServer?.isOnline()) return;
    const view = window.demoResourceView();
    refreshing = true;
    try {
      const response = await fetch('/api/resources', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      const state = await response.json();
      window.dispatchEvent(new CustomEvent('demo-resources', { detail: { view, state } }));
    } catch { /* Keep the current view on a network failure. */ }
    finally { refreshing = false; }
  }
  window.demoResourcesChanged = () => {
    channel?.postMessage('refresh'); refresh();
    window.dispatchEvent(new Event('demo-delete-completed'));
  };
  channel?.addEventListener('message', refresh);
  window.addEventListener('focus', refresh);
  setInterval(refresh, 5000);
})();
