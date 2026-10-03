'use strict';
const jobsContainer = document.querySelector('#processing-jobs'), jobsMessage = document.querySelector('#processing-jobs-status');
const pausePolling = ms => new Promise(resolve => setTimeout(resolve, ms));
async function queuedJSON(route, data) {
  const options = data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  const response = await apiFetch(route, options), value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.error || 'Request failed'), { status: response.status });
  return value;
}
async function runProcessingJob(route, data, progress) {
  const epoch = processingEpoch, username = window.demoAuth?.user.username;
  const request = { ...data, requestId: crypto.randomUUID() };
  function checkView() { if (epoch !== processingEpoch || username !== window.demoAuth?.user.username) throw Object.assign(new Error('Processing view changed'), { stale: true }); }
  let job;
  for (let attempt = 0; !job; attempt++) {
    checkView();
    try { job = await queuedJSON(route, request); }
    catch (error) {
      checkView();
      if (error.offline) { await window.demoServer.whenOnline(); continue; }
      if (error.status || attempt >= 2) throw error;
      await pausePolling(1500);
    }
  }
  refreshProcessingJobs();
  let networkFailures = 0;
  for (;;) {
    checkView(); progress(job);
    if (job.status === 'succeeded') return job.result;
    if (job.status === 'failed') throw new Error(job.error || 'Processing failed');
    if (job.status === 'cancelled') throw Object.assign(new Error('ยกเลิกงานที่รอคิวแล้ว'), { cancelled: true });
    if (!['queued', 'running'].includes(job.status)) throw new Error('กรุณารีเฟรชหน้าเว็บแล้วลองใหม่');
    await pausePolling(2000); checkView();
    try { job = await queuedJSON('/jobs/' + job.jobId); networkFailures = 0; }
    catch (error) {
      checkView();
      if (error.offline) { progress({ ...job, reconnecting: true }); await window.demoServer.whenOnline(); continue; }
      if (error.status || ++networkFailures >= 5) throw error;
    }
  }
}
let jobsRefreshing = false;
async function refreshProcessingJobs() {
  if (jobsRefreshing || !window.demoAuth || window.demoAuth.user.mustChange) return;
  const username = window.demoAuth.user.username; jobsRefreshing = true;
  try {
    const value = await queuedJSON('/jobs');
    if (username !== window.demoAuth?.user.username) return;
    jobsContainer.replaceChildren();
    const jobs = value.jobs || [], active = jobs.filter(job => ['queued', 'running'].includes(job.status));
    jobsMessage.textContent = active.length ? active.length + ' งานของคุณ · ประมวลผลร่วมกันครั้งละหนึ่งงาน' : 'ไม่มีงานรอคิว · ประมวลผลครั้งละหนึ่งงาน';
    for (const job of jobs.slice(0, 8)) {
      const row = document.createElement('div'); row.className = 'upload-file-row';
      const info = document.createElement('div'); info.className = 'upload-file-info';
      const name = document.createElement('strong'); const kind = ({ export: 'Export', qc: 'Audio QC', merge: 'Merge Audio', preview: 'Browser Preview', analyze: 'Analyze' })[job.kind] || 'Processing'; name.textContent = kind + ' · ' + job.filename;
      const status = document.createElement('span'); status.className = 'upload-file-meta';
      status.textContent = job.status === 'queued' ? 'รอคิวลำดับที่ ' + job.position : ({ running: 'กำลังประมวลผล', succeeded: 'เสร็จแล้ว', failed: 'ไม่สำเร็จ · ' + (job.error || ''), cancelled: 'ยกเลิกแล้ว' })[job.status];
      info.append(name, status); row.append(info);
      if (job.status === 'queued') {
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'upload-delete-button'; cancel.textContent = 'ยกเลิกคิว';
        cancel.addEventListener('click', async () => { cancel.disabled = true; try { await queuedJSON('/jobs/' + job.jobId + '/cancel', {}); await refreshProcessingJobs(); } catch (error) { jobsMessage.textContent = error.message; cancel.disabled = false; } });
        row.append(cancel);
      }
      jobsContainer.append(row);
    }
  } catch (error) { if (username === window.demoAuth?.user.username) jobsMessage.textContent = error.message; }
  finally { jobsRefreshing = false; }
}
document.querySelector('#refresh-processing-jobs').addEventListener('click', refreshProcessingJobs);
setInterval(refreshProcessingJobs, 3000);
