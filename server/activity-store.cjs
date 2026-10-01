'use strict';
const fs = require('node:fs'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ACTIVE = new Set(['queued', 'running']);
const eventStatus = { queued: 'queued', running: 'started', succeeded: 'completed', failed: 'failed', cancelled: 'cancelled' };
// Only these fields may reach durable audit storage. Never copy job results or errors.
function metadata(job) {
  return { jobId: job.id, ownerId: job.owner, username: job.username || null,
    fileId: job.fileId, fileIds: job.fileIds || [job.fileId], filename: job.filename || '',
    size: Number.isSafeInteger(job.size) ? job.size : null, kind: job.kind,
    status: eventStatus[job.status], queuedAt: job.queuedAt, startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null, durationMs: job.finishedAt && job.startedAt ? Math.max(0, job.finishedAt - job.startedAt) : null };
}
class ActivityStore {
  constructor(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS user_history (job_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, queued_at INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS history_owner ON user_history(owner_id, queued_at DESC);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT UNIQUE NOT NULL, occurred_at INTEGER NOT NULL, data TEXT NOT NULL);`);
    this.upsert = this.db.prepare('INSERT INTO user_history VALUES (?, ?, ?, ?) ON CONFLICT(job_id) DO UPDATE SET data=excluded.data');
    this.append = this.db.prepare('INSERT OR IGNORE INTO audit(event_key, occurred_at, data) VALUES (?, ?, ?)');
  }
  record(job) {
    const data = metadata(job), timestamp = job.finishedAt || job.startedAt || job.queuedAt;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.upsert.run(job.id, job.owner, job.queuedAt, JSON.stringify({ ...data, status: job.status }));
      // Import available legacy milestones once; stable keys also make restart reconciliation idempotent.
      for (const [status, time] of [['queued', job.queuedAt], ['started', job.startedAt],
        ...(!ACTIVE.has(job.status) ? [[eventStatus[job.status], timestamp]] : [])]) {
        if (!time || !status) continue;
        this.append.run(job.id + ':' + status, time, JSON.stringify({ ...data, status, timestamp: time, durationMs: status === 'queued' || status === 'started' ? null : data.durationMs }));
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  list(owner) {
    return this.db.prepare('SELECT data FROM user_history WHERE owner_id=? ORDER BY queued_at DESC').all(owner).map(row => JSON.parse(row.data));
  }
  forget(ids) {
    const remove = this.db.prepare('DELETE FROM user_history WHERE job_id=?');
    this.db.exec('BEGIN IMMEDIATE');
    try { for (const id of ids) remove.run(id); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  reconcile(ids) {
    const live = new Set(ids);
    this.forget(this.db.prepare('SELECT job_id FROM user_history').all().map(row => row.job_id).filter(id => !live.has(id)));
  }
  deletion({ ownerId, username, fileId, filename, size, kind, reason, actorId, actorUsername }) {
    const timestamp = Date.now();
    this.append.run('delete:' + require('node:crypto').randomUUID(), timestamp,
      JSON.stringify({ timestamp, ownerId, username, fileId, filename, size, kind, status: reason, actorId: actorId || null, actorUsername: actorUsername || null }));
  }
  audit({ limit = 50, before } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (before !== undefined && (!Number.isSafeInteger(before) || before < 1)))
      throw Object.assign(new Error('Invalid audit page'), { status: 400 });
    const rows = this.db.prepare('SELECT id, data FROM audit WHERE id < ? ORDER BY id DESC LIMIT ?').all(before || Number.MAX_SAFE_INTEGER, limit + 1);
    const entries = rows.slice(0, limit).map(row => ({ ...JSON.parse(row.data), auditId: row.id }));
    return { entries, nextCursor: rows.length > limit ? entries.at(-1).auditId : null };
  }
  close() { this.db.close(); }
}
module.exports = { ActivityStore };
