'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const active = job => job.status === 'queued' || job.status === 'running';
const failure = (status, message) => Object.assign(new Error(message), { status });
class ProcessingQueue {
  constructor({ file, maxWaiting = 10, maxPerUser = 3, historyLimit = 20, retention = 60 * 60 * 1000 } = {}) {
    this.file = file; this.maxWaiting = maxWaiting; this.maxPerUser = maxPerUser;
    this.historyLimit = historyLimit; this.retention = retention;
    this.jobs = new Map(); this.pending = []; this.running = null; this.closed = false;
    if (file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file)) {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const job of saved.jobs || []) {
          if (active(job)) Object.assign(job, { status: 'failed', error: 'Backend restarted. Please submit the job again', finishedAt: Date.now() });
          this.jobs.set(job.id, job);
        }
      }
      this.prune(); this.save();
    }
  }
  save() {
    if (!this.file) return;
    const jobs = [...this.jobs.values()].map(({ execute, ...job }) => job);
    fs.writeFileSync(this.file + '.tmp', JSON.stringify({ version: 1, jobs }));
    fs.renameSync(this.file + '.tmp', this.file);
  }
  prune() {
    const completed = [...this.jobs.values()].filter(job => !active(job)).sort((a, b) => b.finishedAt - a.finishedAt);
    for (let i = 0; i < completed.length; i++) if (i >= this.historyLimit || Date.now() - completed[i].finishedAt > this.retention) this.jobs.delete(completed[i].id);
  }
  view(job, includeResult = true) {
    return { jobId: job.id, kind: job.kind, fileId: job.fileId, filename: job.filename, status: job.status,
      position: job.status === 'queued' ? this.pending.indexOf(job.id) + 1 : 0,
      queuedAt: job.queuedAt, startedAt: job.startedAt || null, finishedAt: job.finishedAt || null,
      ...(job.error ? { error: job.error } : {}), ...(includeResult && job.status === 'succeeded' ? { result: job.result } : {}) };
  }
  get(owner, id) { const job = this.jobs.get(id); if (!job || job.owner !== owner) throw failure(404, 'Job not found'); return this.view(job); }
  list(owner) { this.prune(); return [...this.jobs.values()].filter(job => job.owner === owner).sort((a, b) => b.queuedAt - a.queuedAt).map(job => this.view(job, false)); }
  isBusy(owner, fileId) { return [...this.jobs.values()].some(job => job.owner === owner && active(job) && (job.fileIds || [job.fileId]).includes(fileId)); }
  submit({ owner, kind, fileId, fileIds, filename, requestId, signature, execute }) {
    if (this.closed) throw failure(503, 'Backend is restarting. Please retry');
    this.prune();
    if (requestId) {
      const prior = [...this.jobs.values()].find(job => job.owner === owner && job.requestId === requestId);
      if (prior) { if (prior.signature !== signature) throw failure(409, 'Request ID is already used'); return this.view(prior); }
    }
    const resources = Array.isArray(fileIds) && fileIds.length ? fileIds : [fileId];
    if (resources.some(id => this.isBusy(owner, id))) throw failure(409, 'One or more files already have a queued or running job');
    if ([...this.jobs.values()].filter(job => job.owner === owner && active(job)).length >= this.maxPerUser) throw failure(429, 'You already have ' + this.maxPerUser + ' active jobs. Please wait');
    if (this.pending.length >= this.maxWaiting) throw failure(429, 'The processing queue is full. Please retry later');
    const job = { id: crypto.randomUUID(), owner, kind, fileId, ...(resources.length > 1 ? { fileIds: resources } : {}), filename, requestId, signature, status: 'queued', queuedAt: Date.now(), execute };
    this.jobs.set(job.id, job); this.pending.push(job.id);
    try { this.save(); } catch (error) { this.jobs.delete(job.id); this.pending.pop(); throw error; }
    queueMicrotask(() => this.pump());
    return this.view(job);
  }
  cancel(owner, id) {
    const job = this.jobs.get(id); if (!job || job.owner !== owner) throw failure(404, 'Job not found');
    if (job.status !== 'queued') throw failure(409, 'Only a waiting job can be cancelled');
    this.pending = this.pending.filter(value => value !== id);
    Object.assign(job, { status: 'cancelled', finishedAt: Date.now() }); delete job.execute; this.save();
    return this.view(job);
  }
  async pump() {
    if (this.running || this.closed) return;
    const id = this.pending.shift(); if (!id) return;
    const job = this.jobs.get(id); this.running = id;
    Object.assign(job, { status: 'running', startedAt: Date.now() });
    try {
      this.save(); job.result = await job.execute(); job.status = 'succeeded';
    } catch (error) { job.status = 'failed'; job.error = error.message || 'Processing failed. Please retry'; }
    finally {
      job.finishedAt = Date.now(); delete job.execute; this.running = null;
      this.prune(); this.save(); queueMicrotask(() => this.pump());
    }
  }
  close() {
    this.closed = true;
    for (const id of this.pending) { const job = this.jobs.get(id); Object.assign(job, { status: 'failed', error: 'Backend restarted. Please submit the job again', finishedAt: Date.now() }); delete job.execute; }
    this.pending = []; this.save();
  }
}
module.exports = { ProcessingQueue };
