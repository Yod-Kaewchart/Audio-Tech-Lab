'use strict';
(() => {
  const panel = document.querySelector('#ai-review-panel'), state = document.querySelector('#ai-review-state');
  const copy = document.querySelector('#ai-review-copy'), status = document.querySelector('#ai-review-status');
  const run = document.querySelector('#ai-review-run'), connect = document.querySelector('#ai-review-connect');
  const apply = document.querySelector('#ai-review-apply'), clear = document.querySelector('#ai-review-clear');
  const summary = document.querySelector('#ai-review-summary'), list = document.querySelector('#ai-review-list');
  let providerConnected = false, loading = false, review = null, syncEpoch = 0;
  const split = () => window.demoSplitAI?.state?.() || { fileId: null, analysis: null };
  function format(seconds) {
    seconds = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds - h * 3600 - m * 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + s.toFixed(3).padStart(6, '0');
  }
  function setLoading(value) {
    loading = value; run.disabled = value || !providerConnected || window.demoServer?.isOnline() !== true || Boolean(split().busy);
    connect.disabled = value || window.demoServer?.isOnline() !== true; apply.disabled = value;
    panel.toggleAttribute('aria-busy', value);
  }
  function clearReview() {
    review = null; list.replaceChildren(); summary.textContent = ''; summary.hidden = true;
    apply.hidden = true; clear.hidden = true;
  }
  function render(result) {
    review = result; list.replaceChildren(); summary.textContent = result.summary || ''; summary.hidden = !result.summary;
    for (const item of result.items || []) {
      const row = document.createElement('label'); row.className = 'ai-review-row';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'ai-review-select';
      checkbox.dataset.time = String(item.time); checkbox.disabled = item.recommendation === 'reject'; checkbox.checked = item.recommendation === 'accept';
      const meta = document.createElement('div'); meta.className = 'ai-review-meta';
      const time = document.createElement('span'); time.className = 'ai-review-time'; time.textContent = format(item.time);
      const badge = document.createElement('span'); badge.className = 'ai-review-badge ' + item.recommendation; badge.textContent = String(item.recommendation || '').toUpperCase();
      const body = document.createElement('div'); body.className = 'ai-review-body';
      const title = document.createElement('strong'); title.textContent = (item.selectedDetector || 'Candidate') + ' · ' + Math.round((Number(item.confidence) || 0) * 100) + '% AI confidence';
      const reason = document.createElement('p'); reason.textContent = item.rationale || '';
      const code = document.createElement('span'); code.className = 'ai-review-confidence'; code.textContent = item.reasonCode || '';
      meta.append(time, badge); body.append(title, reason, code); row.append(checkbox, meta, body); list.append(row);
    }
    apply.hidden = !(result.items || []).some(item => item.recommendation !== 'reject'); clear.hidden = false;
    const s = result.shortlist || {};
    status.textContent = 'Reviewed ' + (s.selected ?? result.items?.length ?? 0) + ' of ' + (s.before ?? result.items?.length ?? 0) + ' candidate(s) · model ' + (result.model || '—') + '. ACCEPT is preselected; REVIEW requires your choice.';
    state.textContent = 'REVIEW COMPLETE';
  }
  async function syncProvider() {
    const current = split(), epoch = ++syncEpoch;
    if (!current.fileId || !current.analysis || !window.demoAuth?.user || window.demoAuth.user.mustChange) { panel.hidden = true; return; }
    panel.hidden = false;
    if (!Array.isArray(current.analysis.detections) || current.analysis.detections.length === 0) {
      providerConnected = false; run.hidden = true; connect.hidden = true; state.textContent = 'NO CANDIDATES';
      copy.textContent = 'Analyze found no boundary candidates, so there is nothing to send to AI Review.';
      status.textContent = 'No OpenAI request will be sent.'; setLoading(false); return;
    }
    state.textContent = review ? 'REVIEW COMPLETE' : 'READY';
    try {
      const response = await apiFetch('/ai/providers', { cache: 'no-store' }); const value = await response.json();
      if (epoch !== syncEpoch) return;
      if (!response.ok) throw Object.assign(new Error(value.error || 'Unable to check AI provider'), { status: response.status });
      providerConnected = Boolean(value.providers?.find(item => item.id === 'openai')?.connected);
    } catch (error) {
      if (epoch !== syncEpoch) return; providerConnected = false; status.textContent = error.message;
    }
    connect.hidden = providerConnected; run.hidden = !providerConnected;
    copy.textContent = providerConnected ? 'OpenAI is connected. Audio stays on the Server; AI Review sends only locally prepared boundary evidence and metadata to OpenAI.' : 'AI Review is optional. Connect your own OpenAI API key to enable it; local Analyze, Tracks and Export continue to work without AI.';
    if (!review) status.textContent = providerConnected ? 'Ready for AI Review.' : 'OpenAI is not connected.';
    setLoading(false);
  }
  run.addEventListener('click', async () => {
    if (loading || !providerConnected) return;
    const current = split(); if (!current.fileId || !current.analysis || current.busy) return;
    setLoading(true); window.demoSplitAI?.setBusy?.(true); state.textContent = 'AI REVIEW…'; status.textContent = 'Preparing bounded local evidence…'; clearReview();
    try {
      const result = await runProcessingJob('/ai/review', { fileId: current.fileId, model: window.audioTechLabsAIModel || 'auto' }, job => {
        state.textContent = job.status === 'queued' ? 'WAITING IN QUEUE' : 'AI REVIEW…';
        status.textContent = job.status === 'queued' ? 'Waiting in processing queue · position ' + job.position : job.reconnecting ? 'Connection interrupted · waiting for Server…' : 'Reviewing shortlist with OpenAI…';
      });
      render(result);
    } catch (error) {
      if (error.stale) return;
      state.textContent = error.cancelled ? 'CANCELLED' : 'AI REVIEW FAILED'; status.textContent = error.message;
    } finally { window.demoSplitAI?.setBusy?.(false); setLoading(false); }
  });
  connect.addEventListener('click', () => {
    const settings = document.querySelector('#ai-integrations-panel'), toggle = document.querySelector('#ai-integrations-toggle');
    if (settings && toggle) { if (!settings.open) toggle.click(); settings.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  apply.addEventListener('click', () => {
    if (!review) return;
    const times = [...list.querySelectorAll('.ai-review-select:checked')].map(input => Number(input.dataset.time)).filter(Number.isFinite);
    if (!times.length) { status.textContent = 'Select at least one ACCEPT or REVIEW candidate before applying.'; return; }
    const applied = window.demoSplitAI?.applyBoundaries?.(times);
    status.textContent = applied ? 'Applied ' + times.length + ' selected AI Review candidate(s) to Tracks. You can still edit boundaries manually before Export.' : 'No valid AI Review candidates were applied.';
  });
  clear.addEventListener('click', () => { clearReview(); state.textContent = 'READY'; status.textContent = providerConnected ? 'AI Review cleared. Tracks were not changed by clearing the review.' : 'OpenAI is not connected.'; });
  window.addEventListener('demo-analysis-changed', () => { clearReview(); syncProvider(); });
  window.addEventListener('demo-auth-changed', () => { clearReview(); syncProvider(); });
  window.addEventListener('demo-ai-provider-changed', event => { providerConnected = Boolean(event.detail?.connected); syncProvider(); });
  window.addEventListener('demo-server-state', () => setLoading(loading));
  window.addEventListener('demo-split-busy', () => setLoading(loading));
  panel.hidden = true; clearReview();
})();
