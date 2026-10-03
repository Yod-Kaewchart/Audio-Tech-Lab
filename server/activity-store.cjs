'use strict';
const fs = require('node:fs'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ACTIVE = new Set(['queued', 'running']);
const eventStatus = { queued: 'queued', running: 'started', succeeded: 'completed', failed: 'failed', cancelled: 'cancelled' };
const TYPES = new Set(['analyze', 'ai-review', 'qc', 'preview', 'export', 'merge', 'upload', 'delete', 'login', 'logout', 'register', 'user-created', 'user-deleted', 'password-changed', 'openai-connected', 'openai-disconnected', 'openai-test-failed']);
const CATEGORIES = new Set(['processing', 'file', 'authentication', 'admin', 'integration']);
const STATUSES = new Set(['queued', 'started', 'completed', 'failed', 'cancelled', 'manual-delete', 'auto-cleanup']);
const ACCOUNT_TYPES = new Set(['login', 'logout', 'register', 'user-created', 'user-deleted', 'password-changed']);
const INTEGRATION_TYPES = new Set(['openai-connected', 'openai-disconnected', 'openai-test-failed']);
const AI_ERROR_CODES = new Set(['USER_CANCELLED', 'OPENAI_AUTH', 'OPENAI_FORBIDDEN', 'OPENAI_QUOTA', 'OPENAI_TIMEOUT', 'OPENAI_UNAVAILABLE', 'AI_INVALID_OUTPUT', 'STALE_ANALYSIS']);
const TYPE_SQL = "COALESCE(json_extract(data,'$.type'), CASE WHEN json_extract(data,'$.status') IN ('manual-delete','auto-cleanup') THEN 'delete' ELSE json_extract(data,'$.kind') END)";
const CATEGORY_SQL = "COALESCE(json_extract(data,'$.category'), CASE WHEN json_extract(data,'$.status') IN ('manual-delete','auto-cleanup') THEN 'file' ELSE 'processing' END)";
const username = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(value) ? value : null;
const identity = value => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value) ? value : null;
// Only these fields may reach durable audit storage. Never copy job results or errors.
function metadata(job) {
  const data = { jobId: job.id, ownerId: job.owner, username: job.username || null,
    fileId: job.fileId, fileIds: job.fileIds || [job.fileId], filename: job.filename || '',
    size: Number.isSafeInteger(job.size) ? job.size : null, kind: job.kind,
    status: eventStatus[job.status], queuedAt: job.queuedAt, startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null, durationMs: job.finishedAt && job.startedAt ? Math.max(0, job.finishedAt - job.startedAt) : null };
  if (job.kind === 'ai-review') {
    const telemetry = job.telemetry && typeof job.telemetry === 'object' ? job.telemetry : {};
    if (typeof telemetry.model === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(telemetry.model)) data.model = telemetry.model;
    for (const key of ['candidateCount', 'shortlistBefore', 'shortlistSelected', 'inputTokens', 'outputTokens', 'totalTokens']) {
      if (Number.isSafeInteger(telemetry[key]) && telemetry[key] >= 0) data[key] = telemetry[key];
    }
    if (AI_ERROR_CODES.has(job.errorCode)) data.errorCode = job.errorCode;
  }
  return data;
}
class ActivityStore {
  constructor(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS user_history (job_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, queued_at INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS history_owner ON user_history(owner_id, queued_at DESC);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT UNIQUE NOT NULL, occurred_at INTEGER NOT NULL, data TEXT NOT NULL);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_username ON audit(json_extract(data,'$.username'), id DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_type ON audit(${TYPE_SQL}, id DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_category ON audit(${CATEGORY_SQL}, id DESC);
      PRAGMA optimize;`);
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
  completeDeletion(ids, events) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const remove = this.db.prepare('DELETE FROM user_history WHERE job_id=?');
      for (const id of ids) remove.run(id);
      for (const event of events) this.deletion(event);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  deletion({ eventId, ownerId, username, fileId, resourceId, filename, size, kind, reason, source, actorId, actorUsername, result = 'success', errorCode }) {
    const timestamp = Date.now();
    this.append.run('delete:' + (eventId || require('node:crypto').randomUUID()), timestamp,
      JSON.stringify({ timestamp, type: 'delete', category: 'file', ownerId, username, fileId, resourceId: resourceId || fileId || null,
        filename, size, kind, status: result === 'failure' ? 'failed' : reason, reason, source: source || reason, result, errorCode,
        actorId: actorId || null, actorUsername: actorUsername || null }));
  }
  event({ type, status = 'completed', ownerId, username: name, actorId, actorUsername, fileId, filename, size } = {}) {
    if (!ACCOUNT_TYPES.has(type) && !INTEGRATION_TYPES.has(type) && type !== 'upload') throw new Error('Invalid activity event');
    if (!['completed', 'failed'].includes(status) || (status === 'failed' && !['login', 'openai-test-failed'].includes(type)) ||
        (type === 'openai-test-failed' && status !== 'failed')) throw new Error('Invalid activity status');
    const timestamp = Date.now(), category = type === 'upload' ? 'file' : INTEGRATION_TYPES.has(type) ? 'integration' : type.startsWith('user-') ? 'admin' : 'authentication';
    const data = { timestamp, type, category, status, ownerId: identity(ownerId), username: username(name), actorId: identity(actorId), actorUsername: username(actorUsername) };
    if (type === 'upload') Object.assign(data, { fileId: identity(fileId), filename: typeof filename === 'string' ? filename.slice(0, 180) : '', size: Number.isSafeInteger(size) && size >= 0 ? size : null });
    this.append.run('event:' + require('node:crypto').randomUUID(), timestamp, JSON.stringify(data));
  }
  audit({ limit = 50, before, type, category, status, username: name } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (before !== undefined && (!Number.isSafeInteger(before) || before < 1)))
      throw Object.assign(new Error('Invalid audit page'), { status: 400 });
    if ((type !== undefined && !TYPES.has(type)) || (category !== undefined && !CATEGORIES.has(category)) ||
        (status !== undefined && !STATUSES.has(status)) || (name !== undefined && !username(name)))
      throw Object.assign(new Error('Invalid audit filter'), { status: 400 });
    const clauses = ['id < ?'], values = [before || Number.MAX_SAFE_INTEGER];
    for (const [expression, value] of [[TYPE_SQL, type], [CATEGORY_SQL, category], ["json_extract(data,'$.status')", status], ["json_extract(data,'$.username')", name]]) {
      if (value !== undefined) { clauses.push(expression + ' = ?'); values.push(value); }
    }
    const rows = this.db.prepare('SELECT id, data, ' + TYPE_SQL + ' AS type, ' + CATEGORY_SQL + ' AS category FROM audit WHERE ' + clauses.join(' AND ') + ' ORDER BY id DESC LIMIT ?').all(...values, limit + 1);
    const entries = rows.slice(0, limit).map(row => ({ ...JSON.parse(row.data), type: row.type, category: row.category, auditId: row.id }));
    return { entries, nextCursor: rows.length > limit ? entries.at(-1).auditId : null };
  }
  close() { this.db.close(); }
}
module.exports = { ActivityStore };
