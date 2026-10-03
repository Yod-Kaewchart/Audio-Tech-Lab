'use strict';
window.demoAuth = null;
const loginPanel = document.querySelector('#login-panel'), registerPanel = document.querySelector('#register-panel'), passwordPanel = document.querySelector('#password-panel');
function addPasswordToggles() {
  document.querySelectorAll('.auth-card input[type="password"]:not([data-no-password-toggle])').forEach(input => {
    if (input.parentElement?.classList.contains('password-field')) return;
    const wrap = document.createElement('span'); wrap.className = 'password-field';
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'password-toggle';
    toggle.setAttribute('aria-label', 'แสดงรหัสผ่าน'); toggle.setAttribute('aria-pressed', 'false'); toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="M4 4l16 16"/></svg>';
    toggle.addEventListener('click', () => {
      const show = input.type === 'password'; input.type = show ? 'text' : 'password';
      toggle.classList.toggle('is-visible', show); toggle.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'); toggle.setAttribute('aria-pressed', String(show));
    });
    wrap.appendChild(toggle);
  });
}
addPasswordToggles();
const workspace = document.querySelector('#demo-workspace'), accountBar = document.querySelector('#account-bar');
const authMessage = document.querySelector('#auth-message'), adminPanel = document.querySelector('#admin-panel');
const offlineMessage = document.querySelector('#server-offline-message'), retryConnection = document.querySelector('#retry-connection');
const loginButton = document.querySelector('#login-form button[type="submit"]'), registerButton = document.querySelector('#register-form button[type="submit"]');
const showRegisterButton = document.querySelector('#show-register');
let loginPending = false, registerPending = false, connectionRequest = null;

function syncServerControls() {
  const online = window.demoServer?.isOnline() === true;
  loginButton.disabled = !online || loginPending;
  registerButton.disabled = !online || registerPending;
  showRegisterButton.disabled = !online;
  retryConnection.hidden = online || window.demoServer?.state === 'checking';
  offlineMessage.hidden = window.demoServer?.state !== 'offline';
}
function resetPrivateView() {
  resetAudioWorkspaceSelection(); uploadsRequest++;
  document.querySelector('#processing-jobs').replaceChildren(); uploadsList.replaceChildren();
}
function renderAuth(value) {
  window.demoAuth = value;
  window.dispatchEvent(new CustomEvent('demo-auth-changed', { detail: value }));
  syncAdminControls(value);
  const signedIn = !!value, mustChange = !!value?.user.mustChange;
  loginPanel.hidden = signedIn; registerPanel.hidden = true; passwordPanel.hidden = !mustChange; accountBar.hidden = !signedIn;
  workspace.hidden = !signedIn || mustChange;
  adminPanel.hidden = !signedIn || mustChange || value.user.role !== 'admin';
  adminStoragePanel.hidden = !signedIn || mustChange || value.user.role !== 'admin';
  if (signedIn && !mustChange && value.user.role === 'admin') loadAdminStorage();
  document.querySelector('#account-name').textContent = signedIn ? value.user.username : '';
  if (signedIn && !mustChange) { loadUploads(); refreshProcessingJobs(); }
}
async function authRequest(route, data, method) {
  window.demoServer?.requireOnline();
  const headers = { 'Content-Type': 'application/json' };
  if (window.demoAuth?.csrf) headers['X-CSRF-Token'] = window.demoAuth.csrf;
  let response;
  try {
    response = await fetch(API + route, { method: method || (data ? 'POST' : 'GET'), headers, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000), body: data ? JSON.stringify(data) : undefined });
  } catch (error) {
    void window.demoServer?.check();
    throw Object.assign(new Error(window.demoServer?.offlineText || 'บริการเดโมยังไม่พร้อม กรุณาลองใหม่ภายหลัง'), { cause: error, offline: true });
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('บริการเดโมยังไม่พร้อม กรุณาลองใหม่ภายหลัง');
  const value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.error || 'Request failed'), { status: response.status });
  return value;
}
document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (window.demoServer?.isOnline() !== true) { syncServerControls(); authMessage.textContent = window.demoServer?.offlineText || 'บริการเดโมยังไม่พร้อม'; return; }
  loginPending = true; syncServerControls(); authMessage.textContent = 'กำลังเข้าสู่ระบบ…';
  const loginInput = document.querySelector('#login-username'), passwordInput = document.querySelector('#login-password');
  try {
    const login = loginInput.value.trim().toLowerCase(), password = passwordInput.value;
    if (!login || !password) throw new Error('กรุณากรอกชื่อผู้ใช้หรืออีเมล และรหัสผ่าน');
    const value = await authRequest('/auth/login', { username: login, password });
    passwordInput.value = ''; authMessage.textContent = ''; renderAuth(value);
  } catch (err) {
    authMessage.textContent = err.status === 401 ? 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง' : err.status === 429 ? 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' : err.message;
    passwordInput.focus(); passwordInput.select();
  } finally { loginPending = false; syncServerControls(); }
});
document.querySelector('#show-register').addEventListener('click', () => {
  if (window.demoServer?.isOnline() !== true) { syncServerControls(); return; }
  loginPanel.hidden = true; registerPanel.hidden = false; authMessage.textContent = '';
  document.querySelector('#register-username').focus();
});
document.querySelector('#show-login').addEventListener('click', () => {
  registerPanel.hidden = true; loginPanel.hidden = false; authMessage.textContent = '';
  document.querySelector('#login-username').focus();
});
document.querySelector('#register-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (window.demoServer?.isOnline() !== true) { syncServerControls(); authMessage.textContent = window.demoServer?.offlineText || 'บริการเดโมยังไม่พร้อม'; return; }
  registerPending = true; syncServerControls(); authMessage.textContent = '';
  try {
    const username = document.querySelector('#register-username').value.trim().toLowerCase();
    const email = document.querySelector('#register-email').value.trim().toLowerCase();
    const password = document.querySelector('#register-password').value;
    if (password !== document.querySelector('#register-confirm-password').value) throw new Error('รหัสผ่านทั้งสองช่องต้องตรงกัน');
    await authRequest('/auth/register', { username, email, password });
    event.target.reset(); registerPanel.hidden = true; loginPanel.hidden = false;
    document.querySelector('#login-username').value = username; document.querySelector('#login-password').focus();
    authMessage.textContent = 'สมัครเรียบร้อยแล้ว กรุณาเข้าสู่ระบบ';
  } catch (err) { authMessage.textContent = err.message; } finally { registerPending = false; syncServerControls(); }
});
document.querySelector('#password-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true; authMessage.textContent = '';
  try {
    const password = document.querySelector('#new-password').value;
    if (password !== document.querySelector('#confirm-password').value) throw new Error('รหัสผ่านใหม่ทั้งสองช่องต้องตรงกัน');
    const value = await authRequest('/auth/password', { currentPassword: document.querySelector('#current-password').value, newPassword: password });
    event.target.reset(); renderAuth(value); authMessage.textContent = 'เปลี่ยนรหัสผ่านเรียบร้อย';
  } catch (err) { authMessage.textContent = err.message; } finally { button.disabled = false; }
});
document.querySelector('#logout-button').addEventListener('click', async () => {
  try { await authRequest('/auth/logout', {}); resetPrivateView(); renderAuth(null); authMessage.textContent = 'ออกจากระบบแล้ว'; }
  catch (err) { authMessage.textContent = err.message; }
});
window.addEventListener('auth-required', () => { resetPrivateView(); renderAuth(null); authMessage.textContent = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'; });
document.querySelector('#create-user-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
  const message = document.querySelector('#create-user-message'); message.textContent = '';
  try {
    const value = await authRequest('/admin/users', { username: document.querySelector('#new-username').value, password: document.querySelector('#user-temporary-password').value });
    event.target.reset(); message.textContent = 'สร้างบัญชี ' + value.username + ' แล้ว ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าใช้ครั้งแรก';
  } catch (err) { message.textContent = err.message; } finally { button.disabled = false; }
});
function connectDemo() {
  if (connectionRequest || window.demoServer?.isOnline() !== true) return connectionRequest;
  connectionRequest = connectDemoSession().finally(() => { connectionRequest = null; });
  return connectionRequest;
}
async function connectDemoSession() {
  authMessage.textContent = window.demoAuth ? '' : 'กำลังตรวจสอบบริการเดโม…';
  try {
    try { renderAuth(await authRequest('/auth/me')); }
    catch (error) {
      if (error.status !== 401) throw error;
      if (window.demoAuth) resetPrivateView();
      renderAuth(null);
    }
    authMessage.textContent = '';
  } catch (error) {
    if (error.offline) void window.demoServer?.check();
    else authMessage.textContent = error.message;
  } finally {
    syncServerControls();
  }
}
retryConnection.addEventListener('click', async () => {
  retryConnection.disabled = true;
  try {
    if (await window.demoServer?.check({ visibleChecking: true })) await connectDemo();
  } finally {
    retryConnection.disabled = false;
    syncServerControls();
  }
});
window.addEventListener('demo-server-state', event => {
  const { state, previous } = event.detail;
  syncServerControls();
  if (state === 'offline') {
    if (!window.demoAuth) authMessage.textContent = '';
    return;
  }
  if (state === 'online' && previous !== 'online') void connectDemo();
});
renderAuth(null);
syncServerControls();
if (window.demoServer?.isOnline() === true) void connectDemo();
