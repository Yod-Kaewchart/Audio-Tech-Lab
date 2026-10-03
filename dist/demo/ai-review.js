'use strict';
(() => {
  const panel = document.querySelector('#ai-review-panel'), state = document.querySelector('#ai-review-state');
  const copy = document.querySelector('#ai-review-copy'), status = document.querySelector('#ai-review-status');
  const run = document.querySelector('#ai-review-run'), connect = document.querySelector('#ai-review-connect');
  const cancel = document.querySelector('#ai-review-cancel'), apply = document.querySelector('#ai-review-apply');
  const selectAccept = document.querySelector('#ai-review-select-accept'), clearSelection = document.querySelector('#ai-review-clear-selection');
  const clear = document.querySelector('#ai-review-clear'), summary = document.querySelector('#ai-review-summary'), list = document.querySelector('#ai-review-list');
  let providerConnected = false, loading = false, review = null, currentJobId = null, syncEpoch = 0;
  const split = () => window.demoSplitAI?.state?.() || { fileId: null, analysis: null, analysisJobId: null, boundaryRevision: 0 };
  const phaseText = {
    'preparing-evidence': 'Preparing boundary evidence on the Server…',
    'calling-openai': 'Calling OpenAI…',
    'validating-response': 'Validating structured AI Review response…',
    'review-ready': 'AI Review ready.',
    'cancelling': 'Cancelling AI Review…',
  };
  function format(seconds) {
    seconds = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds - h * 3600 - m * 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + s.toFixed(3).padStart(6, '0');
  }
  function setLoading(value) {
    loading = value;
    run.disabled = value || !providerConnected || window.demoServer?.isOnline() !== true || Boolean(split().busy);
    connect.disabled = value || window.demoServer?.isOnline() !== true;
    apply.disabled = value; selectAccept.disabled = value; clearSelection.disabled = value; clear.disabled = value;
    cancel.hidden = !(value && currentJobId); cancel.disabled = false;
    panel.toggleAttribute('aria-busy', value);
  }
  function clearReview() {
    review = null; list.replaceChildren(); summary.textContent = ''; summary.hidden = true;
    apply.hidden = true; selectAccept.hidden = true; clearSelection.hidden = true; clear.hidden = true;
  }
  function selectedInputs() { return [...list.querySelectorAll('.ai-review-select:checked')]; }
  function updateApplyLabel() {
    const count = selectedInputs().length;
    apply.textContent = 'Apply ' + count + ' Selected to Tracks';
    apply.disabled = loading || count === 0;
  }
  function reviewStatus(result) {
    const items = result.items || [], accept = items.filter(item => item.recommendation === 'accept').length;
    const needsReview = items.filter(item => item.recommendation === 'review').length;
    const reject = items.filter(item => item.recommendation === 'reject').length, s = result.shortlist || {};
    return 'Reviewed ' + (s.selected ?? items.length) + ' of ' + (s.before ?? items.length) +
      ' candidate(s) · ' + accept + ' ACCEPT · ' + needsReview + ' REVIEW · ' + reject + ' REJECT · model ' + (result.model || '—') + '.';
  }
  function render(result, snapshot) {
    review = { ...result, boundaryRevision: snapshot.boundaryRevision, analysisJobId: snapshot.analysisJobId };
    list.replaceChildren(); summary.textContent = result.summary || ''; summary.hidden = !result.summary;
    for (const item of result.items || []) {
      const row = document.createElement('div'); row.className = 'ai-review-row';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'ai-review-select';
      checkbox.dataset.time = String(item.time); checkbox.dataset.recommendation = item.recommendation;
      checkbox.setAttribute('aria-label', 'Select AI Review candidate at ' + format(item.time));
      checkbox.disabled = item.recommendation === 'reject'; checkbox.checked = item.recommendation === 'accept';
      checkbox.addEventListener('change', updateApplyLabel);
      const meta = document.createElement('div'); meta.className = 'ai-review-meta';
      const time = document.createElement('span'); time.className = 'ai-review-time'; time.textContent = format(item.time);
      const badge = document.createElement('span'); badge.className = 'ai-review-badge ' + item.recommendation; badge.textContent = String(item.recommendation || '').toUpperCase();
      const body = document.createElement('div'); body.className = 'ai-review-body';
      const title = document.createElement('strong'); title.textContent = (item.selectedDetector || 'Candidate') + ' · ' + Math.round((Number(item.confidence) || 0) * 100) + '% AI confidence';
      const reason = document.createElement('p'); reason.textContent = item.rationale || '';
      const code = document.createElement('span'); code.className = 'ai-review-confidence'; code.textContent = item.reasonCode || '';
      const actions = document.createElement('div'); actions.className = 'ai-review-row-actions';
      const play = document.createElement('button'); play.type = 'button'; play.className = 'ai-review-play'; play.textContent = 'Play ±5s';
      play.addEventListener('click', () => window.demoSplitAI?.playAround?.(Number(item.time), 5));
      meta.append(time, badge); body.append(title, reason, code); actions.append(play); row.append(checkbox, meta, body, actions); list.append(row);
    }
    const hasSelectable = (result.items || []).some(item => item.recommendation !== 'reject');
    apply.hidden = !hasSelectable; selectAccept.hidden = !hasSelectable; clearSelection.hidden = !hasSelectable; clear.hidden = false;
    status.textContent = reviewStatus(result); state.textContent = 'REVIEW COMPLETE'; updateApplyLabel();
  }
  function friendlyError(error) {
    const messages = {
      STALE_ANALYSIS: 'Analyze changed. Run Analyze again before AI Review.',
      OPENAI_AUTH: 'OpenAI API key was rejected. Open AI & Integrations and reconnect the key.',
      OPENAI_FORBIDDEN: 'This OpenAI API account does not have permission to run AI Review.',
      OPENAI_QUOTA: 'OpenAI quota or request limit was reached. Check your OpenAI account before trying again.',
      OPENAI_TIMEOUT: 'OpenAI AI Review timed out. No automatic retry was sent.',
      OPENAI_UNAVAILABLE: 'OpenAI is temporarily unavailable. Try AI Review again later.',
      AI_INVALID_OUTPUT: 'OpenAI returned an invalid AI Review result. Tracks were not changed.',
      USER_CANCELLED: 'AI Review was cancelled. Tracks were not changed.',
    };
    return messages[error?.errorCode] || error?.message || 'AI Review failed';
  }
  async function syncProvider() {
    const current = split(), epoch = ++syncEpoch;
    if (!current.fileId || !current.analysis || !current.analysisJobId || !window.demoAuth?.user || window.demoAuth.user.mustChange) { panel.hidden = true; return; }
    panel.hidden = false;
    if (!Array.isArray(current.analysis.detections) || current.analysis.detections.length === 0) {
      providerConnected = false; run.hidden = true; connect.hidden = true; state.textContent = 'NO CANDIDATES';
      copy.textContent = 'Analyze found no boundary candidates, so there is nothing to send to AI Review.';
      status.textContent = 'No OpenAI request will be sent.'; setLoading(false); return;
    }
    state.textContent = review ? state.textContent : 'READY';
    try {
      const response = await apiFetch('/ai/providers', { cache: 'no-store' }), value = await response.json();
      if (epoch !== syncEpoch) return;
      if (!response.ok) throw Object.assign(new Error(value.error || 'Unable to check AI provider'), { status: response.status });
      providerConnected = Boolean(value.providers?.find(item => item.id === 'openai')?.connected);
    } catch (error) {
      if (epoch !== syncEpoch) return; providerConnected = false; status.textContent = error.message;
    }
    connect.hidden = providerConnected; run.hidden = !providerConnected;
    copy.textContent = providerConnected ? 'OpenAI is connected. Audio stays on the Server; AI Review sends only locally prepared boundary evidence and metadata to OpenAI.' : 'AI Review is optional. Connect your own OpenAI API key to enable it; local Analyze, Tracks and Export continue to work without AI.';
    if (!review && !loading) status.textContent = providerConnected ? 'Ready for AI Review.' : 'OpenAI is not connected.';
    setLoading(loading);
  }
  run.addEventListener('click', async () => {
    if (loading || !providerConnected) return;
    const snapshot = split(); if (!snapshot.fileId || !snapshot.analysis || !snapshot.analysisJobId || snapshot.busy) return;
    currentJobId = null; setLoading(true); window.demoSplitAI?.setBusy?.(true); state.textContent = 'AI REVIEW…'; status.textContent = 'Submitting AI Review job…'; clearReview();
    try {
      const result = await runProcessingJob('/ai/review', {
        fileId: snapshot.fileId, analysisJobId: snapshot.analysisJobId, model: window.audioTechLabsAIModel || 'auto'
      }, job => {
        state.textContent = job.status === 'queued' ? 'WAITING IN QUEUE' : job.phase === 'cancelling' ? 'CANCELLING…' : 'AI REVIEW…';
        status.textContent = job.status === 'queued' ? 'Waiting in processing queue · position ' + job.position :
          job.reconnecting ? 'Connection interrupted · waiting for Server…' : (phaseText[job.phase] || 'AI Review is running…');
      }, {
        onSubmitted: job => { currentJobId = job.jobId; cancel.hidden = !job.canCancel; },
      });
      if (result.analysisJobId !== snapshot.analysisJobId || split().analysisJobId !== snapshot.analysisJobId) throw Object.assign(new Error('Analyze changed'), { errorCode: 'STALE_ANALYSIS' });
      render(result, snapshot);
    } catch (error) {
      if (error.stale) return;
      if (error.errorCode === 'STALE_ANALYSIS') clearReview();
      state.textContent = error.cancelled || error.errorCode === 'USER_CANCELLED' ? 'CANCELLED' : error.errorCode === 'STALE_ANALYSIS' ? 'ANALYSIS CHANGED' : 'AI REVIEW FAILED';
      status.textContent = friendlyError(error);
      if (['OPENAI_AUTH', 'OPENAI_FORBIDDEN'].includes(error.errorCode)) syncProvider();
    } finally {
      currentJobId = null; cancel.hidden = true; window.demoSplitAI?.setBusy?.(false); setLoading(false); refreshProcessingJobs();
    }
  });
  cancel.addEventListener('click', async () => {
    if (!currentJobId || !loading) return;
    cancel.disabled = true; state.textContent = 'CANCELLING…'; status.textContent = 'Cancelling AI Review safely…';
    try { await queuedJSON('/jobs/' + currentJobId + '/cancel', {}); }
    catch (error) { status.textContent = error.message; cancel.disabled = false; }
  });
  connect.addEventListener('click', () => {
    const settings = document.querySelector('#ai-integrations-panel'), toggle = document.querySelector('#ai-integrations-toggle');
    if (settings && toggle) { if (!settings.open) toggle.click(); settings.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  selectAccept.addEventListener('click', () => {
    for (const input of list.querySelectorAll('.ai-review-select')) input.checked = !input.disabled && input.dataset.recommendation === 'accept';
    updateApplyLabel();
  });
  clearSelection.addEventListener('click', () => {
    for (const input of list.querySelectorAll('.ai-review-select')) if (!input.disabled) input.checked = false;
    updateApplyLabel();
  });
  apply.addEventListener('click', async () => {
    if (!review || loading) return;
    const times = selectedInputs().map(input => Number(input.dataset.time)).filter(Number.isFinite);
    if (!times.length) { status.textContent = 'Select at least one ACCEPT or REVIEW candidate before applying.'; return; }
    const current = split();
    if (current.analysisJobId !== review.analysisJobId) {
      clearReview(); state.textContent = 'ANALYSIS CHANGED'; status.textContent = 'Analyze changed. Run AI Review again before applying.'; return;
    }
    apply.disabled = true;
    try {
      const jobs = (await queuedJSON('/jobs')).jobs || [];
      const latest = jobs.filter(job => job.kind === 'analyze' && job.fileId === current.fileId && job.status === 'succeeded')
        .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))[0];
      if (!latest || latest.jobId !== review.analysisJobId) {
        clearReview(); state.textContent = 'ANALYSIS CHANGED'; status.textContent = 'A newer Analyze result exists. Run AI Review again before applying.'; return;
      }
      const changed = current.boundaryRevision !== review.boundaryRevision;
      if (changed && !confirm('Tracks were edited after this AI Review.\n\nApplying the selected AI Review candidates will replace the current manually edited boundaries. Continue?')) return;
      const result = window.demoSplitAI?.applyBoundaries?.(times, {
        analysisJobId: review.analysisJobId, boundaryRevision: review.boundaryRevision, allowOverwrite: changed
      });
      if (result?.ok) {
        review.boundaryRevision = result.boundaryRevision; status.textContent = 'Applied ' + times.length + ' selected AI Review candidate(s) to Tracks. You can still edit boundaries manually before Export.';
      } else if (result?.reason === 'stale-analysis') {
        clearReview(); state.textContent = 'ANALYSIS CHANGED'; status.textContent = 'Analyze changed. Run AI Review again before applying.';
      } else status.textContent = 'No valid AI Review candidates were applied.';
    } catch (error) { status.textContent = 'Could not verify the current Analyze result · ' + error.message; }
    finally { if (review) updateApplyLabel(); }
  });
  clear.addEventListener('click', () => { clearReview(); state.textContent = 'READY'; status.textContent = providerConnected ? 'AI Review cleared. Tracks were not changed by clearing the review.' : 'OpenAI is not connected.'; });
  window.addEventListener('demo-boundaries-changed', event => {
    if (!review) return;
    if (event.detail?.source === 'ai-review') { review.boundaryRevision = event.detail.boundaryRevision; return; }
    state.textContent = 'TRACKS MODIFIED';
    status.textContent = 'Tracks were edited after this AI Review. Review results are still visible; Apply will ask before replacing manual edits.';
  });
  window.addEventListener('demo-analysis-changed', () => { clearReview(); syncProvider(); });
  window.addEventListener('demo-auth-changed', () => { clearReview(); syncProvider(); });
  window.addEventListener('demo-ai-provider-changed', event => { providerConnected = Boolean(event.detail?.connected); syncProvider(); });
  window.addEventListener('demo-server-state', () => setLoading(loading));
  window.addEventListener('demo-split-busy', () => setLoading(loading));
  panel.hidden = true; clearReview();
})();
