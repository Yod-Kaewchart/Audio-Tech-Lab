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
  const headers = { 'Content-Type': 'application/json' };
  if (window.demoAuth?.csrf) headers['X-CSRF-Token'] = window.demoAuth.csrf;
  const response = await fetch(API + route, { method: method || (data ? 'POST' : 'GET'), headers, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000), body: data ? JSON.stringify(data) : undefined });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('บริการเดโมยังไม่พร้อม กรุณาลองใหม่ภายหลัง');
  const value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.error || 'Request failed'), { status: response.status });
  return value;
}
document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true; authMessage.textContent = 'กำลังเข้าสู่ระบบ…';
  const loginInput = document.querySelector('#login-username'), passwordInput = document.querySelector('#login-password');
  try {
    const login = loginInput.value.trim().toLowerCase(), password = passwordInput.value;
    if (!login || !password) throw new Error('กรุณากรอกชื่อผู้ใช้หรืออีเมล และรหัสผ่าน');
    const value = await authRequest('/auth/login', { username: login, password });
    passwordInput.value = ''; authMessage.textContent = ''; renderAuth(value);
  } catch (err) {
    authMessage.textContent = err.status === 401 ? 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง' : err.status === 429 ? 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' : err.message;
    passwordInput.focus(); passwordInput.select();
  } finally { button.disabled = false; }
});
document.querySelector('#show-register').addEventListener('click', () => {
  loginPanel.hidden = true; registerPanel.hidden = false; authMessage.textContent = '';
  document.querySelector('#register-username').focus();
});
document.querySelector('#show-login').addEventListener('click', () => {
  registerPanel.hidden = true; loginPanel.hidden = false; authMessage.textContent = '';
  document.querySelector('#login-username').focus();
});
document.querySelector('#register-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true; authMessage.textContent = '';
  try {
    const username = document.querySelector('#register-username').value.trim().toLowerCase();
    const email = document.querySelector('#register-email').value.trim().toLowerCase();
    const password = document.querySelector('#register-password').value;
    if (password !== document.querySelector('#register-confirm-password').value) throw new Error('รหัสผ่านทั้งสองช่องต้องตรงกัน');
    await authRequest('/auth/register', { username, email, password });
    event.target.reset(); registerPanel.hidden = true; loginPanel.hidden = false;
    document.querySelector('#login-username').value = username; document.querySelector('#login-password').focus();
    authMessage.textContent = 'สมัครเรียบร้อยแล้ว กรุณาเข้าสู่ระบบ';
  } catch (err) { authMessage.textContent = err.message; } finally { button.disabled = false; }
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
const serverStatus = document.querySelector('#server-status');
function setServerStatus(state) {
  serverStatus.className = 'server-status is-' + state;
  serverStatus.querySelector('span').textContent = state === 'online' ? 'SERVER ONLINE' : state === 'offline' ? 'SERVER OFFLINE' : 'SERVER CHECKING';
}
let healthRequest = null, connectionRequest = null, connectionNeedsRetry = true;
function checkServerStatus() {
  if (healthRequest) return healthRequest;
  // Previous success is not evidence for the request now being checked.
  setServerStatus('checking');
  healthRequest = (async () => {
    const controller = new AbortController(), started = Date.now();
    let timeout;
    try {
      const nonce = crypto.randomUUID();
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => { controller.abort(); reject(new Error('Health timeout')); }, 5000);
      });
      const probe = (async () => {
        const response = await fetch(API + '/health?nonce=' + encodeURIComponent(nonce), {
          cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal,
          headers: { Accept: 'application/json', 'Cache-Control': 'no-store, no-cache', Pragma: 'no-cache' }
        });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return false;
        const health = await response.json();
        return health?.ok === true && health.service === 'audio-tech-labs-demo' && health.apiVersion === 1 && health.authentication === true && health.nonce === nonce;
      })();
      const online = await Promise.race([probe, deadline]) === true && Date.now() - started < 5000;
      setServerStatus(online ? 'online' : 'offline');
      return online;
    } catch { setServerStatus('offline'); return false; }
    finally { clearTimeout(timeout); controller.abort(); }
  })().finally(() => { healthRequest = null; });
  return healthRequest;
}
function connectDemo() {
  if (connectionRequest) return connectionRequest;
  connectionRequest = connectDemoSession().finally(() => { connectionRequest = null; });
  return connectionRequest;
}
async function connectDemoSession() {
  const retry = document.querySelector('#retry-connection');
  const loginButton = document.querySelector('#login-form button');
  retry.hidden = true; loginButton.disabled = true;
  authMessage.textContent = 'กำลังตรวจสอบบริการเดโม…';
  try {
    if (!await checkServerStatus()) throw new Error('บริการเดโมยังไม่พร้อม');
    try { renderAuth(await authRequest('/auth/me')); }
    catch (error) { if (error.status !== 401) throw error; renderAuth(null); }
    authMessage.textContent = ''; loginButton.disabled = false;
    connectionNeedsRetry = false;
  } catch {
    connectionNeedsRetry = true;
    authMessage.textContent = 'บริการเดโมไม่พร้อมใช้งานในขณะนี้ กรุณาลองเชื่อมต่ออีกครั้งภายหลัง';
    retry.hidden = false;
  }
}
document.querySelector('#retry-connection').addEventListener('click', connectDemo);
renderAuth(null);
connectDemo();
function refreshServerStatus() { return connectionNeedsRetry && !connectionRequest ? connectDemo() : checkServerStatus(); }
setInterval(refreshServerStatus, 15000);
window.addEventListener('online', refreshServerStatus);
window.addEventListener('pageshow', refreshServerStatus);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshServerStatus(); });
