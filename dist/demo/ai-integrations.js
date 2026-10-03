'use strict';
(() => {
  const panel = document.querySelector('#ai-integrations-panel');
  const toggle = document.querySelector('#ai-integrations-toggle');
  const badge = document.querySelector('#ai-openai-badge');
  const copy = document.querySelector('#ai-openai-copy');
  const connectView = document.querySelector('#ai-openai-connect-view');
  const connectedView = document.querySelector('#ai-openai-connected-view');
  const input = document.querySelector('#ai-openai-key');
  const fingerprint = document.querySelector('#ai-openai-fingerprint');
  const model = document.querySelector('#ai-openai-model');
  const message = document.querySelector('#ai-openai-message');
  const testButton = document.querySelector('#ai-openai-test');
  const connectButton = document.querySelector('#ai-openai-connect');
  const testConnectedButton = document.querySelector('#ai-openai-test-connected');
  const changeButton = document.querySelector('#ai-openai-change');
  const disconnectButton = document.querySelector('#ai-openai-disconnect');
  const cancelButton = document.querySelector('#ai-openai-cancel-change');
  let provider = { connected: false, fingerprint: null }, editing = false, loading = false;
  let selectedModel = 'auto';
  const signedIn = () => Boolean(window.demoAuth?.user && !window.demoAuth.user.mustChange);
  function busy(value) {
    loading = value;
    for (const button of [testButton, connectButton, testConnectedButton, changeButton, disconnectButton, cancelButton]) button.disabled = value;
    panel.toggleAttribute('aria-busy', value);
  }
  function setModels(models = []) {
    const previous = model.value || selectedModel;
    model.replaceChildren(new Option('Auto', 'auto'));
    for (const item of models) {
      if (!item || typeof item.id !== 'string' || typeof item.label !== 'string') continue;
      model.append(new Option(item.label, item.id));
    }
    model.value = [...model.options].some(option => option.value === previous) ? previous : 'auto';
    selectedModel = model.value; window.audioTechLabsAIModel = selectedModel;
  }
  function render() {
    const connected = Boolean(provider.connected);
    badge.textContent = connected ? 'CONNECTED' : 'NOT CONNECTED';
    badge.classList.toggle('is-connected', connected);
    connectView.hidden = connected && !editing;
    connectedView.hidden = !connected || editing;
    cancelButton.hidden = !connected || !editing;
    connectButton.textContent = connected ? 'Update API Key' : 'Connect API Key';
    fingerprint.textContent = provider.fingerprint || '—';
    copy.textContent = connected
      ? 'OpenAI is connected. AI Review can use this provider when the feature is enabled.'
      : 'Connect your own OpenAI API key to unlock AI Review and intelligent analysis.';
    if (!connected) setModels([]);
    window.audioTechLabsOpenAIConnected = connected;
    window.dispatchEvent(new CustomEvent('demo-ai-provider-changed', { detail: { connected } }));
  }
  function clearKey() { input.value = ''; input.type = 'password'; }
  async function loadModels() {
    if (!provider.connected) return setModels([]);
    try {
      const value = await authRequest('/ai/openai/models');
      setModels(value.models || []);
      if (!value.models?.length) message.textContent = 'Connected, but no supported AI Review model is available for this API account.';
    } catch (error) {
      setModels([]);
      message.textContent = 'Model list unavailable: ' + error.message;
    }
  }
  async function loadProvider() {
    if (!signedIn() || loading) return;
    busy(true); message.textContent = 'Checking OpenAI connection…';
    try {
      const value = await authRequest('/ai/providers');
      provider = value.providers?.find(item => item.id === 'openai') || { connected: false, fingerprint: null };
      editing = false; clearKey(); render();
      message.textContent = provider.connected ? 'OpenAI API key is encrypted and connected.' : 'OpenAI is not connected.';
      if (provider.connected) await loadModels();
    } catch (error) {
      if (error.status === 401) window.dispatchEvent(new Event('auth-required'));
      else message.textContent = error.message;
    } finally { busy(false); }
  }
  async function testConnection(useInput) {
    if (loading) return;
    const apiKey = input.value.trim();
    if (useInput && !apiKey) { message.textContent = 'Enter an OpenAI API key first.'; input.focus(); return; }
    busy(true); message.textContent = 'Testing OpenAI connection…';
    try {
      const value = await authRequest('/ai/openai/test', useInput ? { apiKey } : {}, 'POST');
      setModels(value.models || []);
      message.textContent = value.models?.length
        ? 'Connection successful · ' + value.models.length + ' supported model' + (value.models.length === 1 ? '' : 's') + ' available.'
        : 'Connection successful, but no supported AI Review model is available.';
    } catch (error) { message.textContent = error.message; }
    finally { busy(false); }
  }
  async function connect() {
    if (loading) return;
    const apiKey = input.value.trim();
    if (!apiKey) { message.textContent = 'Enter an OpenAI API key first.'; input.focus(); return; }
    busy(true); message.textContent = provider.connected ? 'Testing and updating API key…' : 'Testing and connecting API key…';
    try {
      const value = await authRequest('/ai/openai/credential', { apiKey }, 'PUT');
      provider = { connected: true, fingerprint: value.fingerprint || null };
      editing = false; clearKey(); setModels(value.models || []); render();
      message.textContent = value.models?.length
        ? 'OpenAI connected securely. AI Review is ready for a supported model.'
        : 'OpenAI connected securely, but this account has no supported AI Review model yet.';
    } catch (error) { message.textContent = error.message; }
    finally { busy(false); }
  }
  async function disconnect() {
    if (loading) return;
    if (!confirm('Disconnect OpenAI and delete the encrypted API key for this account?')) return;
    busy(true); message.textContent = 'Disconnecting OpenAI…';
    try {
      await authRequest('/ai/openai/credential', {}, 'DELETE');
      provider = { connected: false, fingerprint: null }; editing = false; clearKey(); setModels([]); render();
      message.textContent = 'OpenAI disconnected. Local Analyze, Tracks and Export remain available.';
    } catch (error) { message.textContent = error.message; }
    finally { busy(false); }
  }
  toggle.addEventListener('click', () => {
    panel.open = !panel.open;
    if (panel.open) {
      for (const id of ['admin-panel', 'admin-storage-panel', 'admin-activity-panel']) {
        const other = document.querySelector('#' + id); if (other) other.open = false;
      }
      loadProvider();
    } else { editing = false; clearKey(); render(); }
  });
  panel.addEventListener('toggle', () => {
    toggle.setAttribute('aria-expanded', String(panel.open));
    if (!panel.open) { editing = false; clearKey(); render(); }
  });
  testButton.addEventListener('click', () => testConnection(true));
  connectButton.addEventListener('click', connect);
  testConnectedButton.addEventListener('click', () => testConnection(false));
  changeButton.addEventListener('click', () => { editing = true; clearKey(); render(); message.textContent = 'Enter the replacement API key. The current key remains active until the update succeeds.'; input.focus(); });
  cancelButton.addEventListener('click', () => { editing = false; clearKey(); render(); message.textContent = 'Current OpenAI connection was not changed.'; });
  disconnectButton.addEventListener('click', disconnect);
  model.addEventListener('change', () => { selectedModel = model.value; window.audioTechLabsAIModel = selectedModel; });
  window.addEventListener('demo-auth-changed', event => {
    const allowed = Boolean(event.detail?.user && !event.detail.user.mustChange);
    toggle.hidden = !allowed; panel.hidden = !allowed;
    if (!allowed) { panel.open = false; provider = { connected: false, fingerprint: null }; editing = false; clearKey(); setModels([]); message.textContent = ''; render(); }
  });
  toggle.hidden = true; panel.hidden = true; render();
})();
