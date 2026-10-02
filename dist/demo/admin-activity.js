'use strict';
(() => {
  const panel = document.querySelector('#admin-activity-panel'), toggle = document.querySelector('#activity-toggle');
  const form = document.querySelector('#admin-activity-filters'), list = document.querySelector('#admin-activity-list');
  const message = document.querySelector('#admin-activity-status'), refresh = document.querySelector('#refresh-admin-activity');
  const more = document.querySelector('#more-admin-activity');
  let epoch = 0, cursor = null, count = 0, loading = false, loaded = false, activeUser = null;
  const isAdmin = () => window.demoAuth?.user?.role === 'admin' && !window.demoAuth.user.mustChange;
  const date = new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const labels = { 'user-created': 'USER CREATED', 'user-deleted': 'USER DELETED', 'password-changed': 'PASSWORD CHANGED', 'manual-delete': 'DELETED', 'auto-cleanup': 'AUTO CLEANUP' };
  function element(tag, className, text) {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  }
  function row(entry) {
    const item = document.createElement('li'); item.className = 'activity-row';
    const when = document.createElement('time'); when.className = 'activity-time';
    const stamp = new Date(entry.timestamp); when.dateTime = stamp.toISOString();
    when.append(element('strong', '', time.format(stamp)), element('span', '', date.format(stamp)));
    const body = element('div', 'activity-body', ''), head = element('div', 'activity-line', '');
    head.append(element('strong', 'activity-user', entry.username || 'Unknown user'),
      element('span', 'activity-type', labels[entry.type] || String(entry.type || entry.kind || 'EVENT').toUpperCase()),
      element('span', 'activity-status status-' + entry.status, labels[entry.status] || entry.status.toUpperCase()));
    body.append(head);
    const detail = [];
    if (entry.filename) detail.push(entry.filename);
    if (entry.type === 'delete' && entry.kind) detail.push(entry.kind.toUpperCase());
    if (Number.isSafeInteger(entry.size)) detail.push(storageSize(entry.size));
    if (Number.isFinite(entry.durationMs)) detail.push((entry.durationMs / 1000).toFixed(1) + ' sec');
    if (entry.actorUsername && entry.actorId !== entry.ownerId) detail.push('By ' + entry.actorUsername);
    if (entry.status === 'auto-cleanup') detail.push('System');
    if (detail.length) body.append(element('p', 'activity-detail', detail.join(' · ')));
    item.append(when, body); return item;
  }
  function clear() {
    epoch++; cursor = null; count = 0; loading = false; loaded = false;
    list.replaceChildren(); message.textContent = ''; more.hidden = true; more.disabled = false; refresh.disabled = false;
    panel.removeAttribute('aria-busy');
  }
  function query() {
    const params = new URLSearchParams({ limit: '50' });
    for (const field of form.elements) {
      if (field.name && field.value.trim()) params.set(field.name, field.value.trim().toLowerCase());
    }
    return params;
  }
  async function load(append = false) {
    if (!isAdmin() || (append && (loading || !cursor))) return;
    if (!append) clear();
    const requestEpoch = epoch, user = window.demoAuth;
    loading = true; refresh.disabled = true; more.disabled = true; panel.setAttribute('aria-busy', 'true');
    message.textContent = append ? 'กำลังโหลดรายการเพิ่มเติม…' : 'กำลังโหลด Activity Log…';
    try {
      const params = query(); if (append) params.set('before', String(cursor));
      const value = await authRequest('/admin/audit?' + params);
      if (requestEpoch !== epoch || window.demoAuth !== user || !isAdmin()) return;
      const fragment = document.createDocumentFragment();
      for (const entry of value.entries) fragment.append(row(entry));
      list.append(fragment); count += value.entries.length; cursor = value.nextCursor; loaded = true;
      message.textContent = count ? 'แสดง ' + count + ' รายการ' + (cursor ? '' : ' · ครบแล้ว') : 'ไม่พบกิจกรรมตามตัวกรอง';
      more.hidden = !cursor;
    } catch (error) {
      if (requestEpoch !== epoch || window.demoAuth !== user) return;
      if (error.status === 401) window.dispatchEvent(new Event('auth-required'));
      else if (error.status === 403) { clear(); panel.open = false; panel.hidden = true; toggle.hidden = true; }
      else message.textContent = 'โหลดไม่สำเร็จ: ' + error.message;
    } finally {
      if (requestEpoch === epoch) { loading = false; refresh.disabled = false; more.disabled = false; panel.removeAttribute('aria-busy'); }
    }
  }
  function sync(value) {
    const allowed = value?.user?.role === 'admin' && !value.user.mustChange;
    const name = allowed ? value.user.username : null;
    if (!allowed || activeUser !== name) { clear(); form.reset(); panel.open = false; }
    activeUser = name; panel.hidden = !allowed; toggle.hidden = !allowed;
    toggle.setAttribute('aria-expanded', String(allowed && panel.open));
  }
  toggle.addEventListener('click', () => {
    panel.open = !panel.open;
    if (panel.open) { document.querySelector('#admin-panel').open = false; document.querySelector('#admin-storage-panel').open = false; load(); }
  });
  panel.addEventListener('toggle', () => {
    toggle.setAttribute('aria-expanded', String(panel.open));
    if (panel.open && !loaded && !loading) load();
  });
  for (const id of ['account-toggle', 'storage-toggle']) document.querySelector('#' + id).addEventListener('click', () => { panel.open = false; });
  refresh.addEventListener('click', () => load()); more.addEventListener('click', () => load(true));
  form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) load(); });
  form.addEventListener('change', () => { if (form.checkValidity()) load(); });
  window.addEventListener('demo-auth-changed', event => sync(event.detail));
  sync(window.demoAuth);
})();
