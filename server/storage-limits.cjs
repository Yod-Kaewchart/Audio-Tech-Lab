'use strict';
const fs = require('node:fs'), path = require('node:path');
const GB = 1000 ** 3;
function configuredBytes(env, name, fallback) {
  const value = env[name] === undefined ? fallback : Number(env[name]);
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(value * GB)) throw new Error(name + ' must be a positive number of GB');
  return value * GB;
}
function limitsFromEnv(env = process.env) {
  return { userBytes: configuredBytes(env, 'ATL_USER_STORAGE_GB', 10), totalBytes: configuredBytes(env, 'ATL_TOTAL_STORAGE_GB', 100),
    minFreeBytes: configuredBytes(env, 'ATL_MIN_FREE_GB', 5), exportBytes: configuredBytes(env, 'ATL_MAX_EXPORT_GB', 4) };
}
function directoryBytes(directory) {
  if (!fs.existsSync(directory)) return 0;
  let size = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Storage must not contain symbolic links');
    size += entry.isDirectory() ? directoryBytes(file) : fs.statSync(file).size;
  }
  return size;
}
function createStorageLimits({ uploads, exports, previews, sessions, limits = {}, freeBytes }) {
  const policy = { ...limitsFromEnv(), ...limits }, reservations = new Map();
  for (const value of Object.values(policy)) if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid storage limit');
  // Both roots are under the same application directory/volume.
  const diskFree = freeBytes || (() => { const stat = fs.statfsSync(uploads); return stat.bavail * stat.bsize; });
  function reserved(owner) {
    let bytes = 0;
    for (const session of sessions.values()) if (!owner || session.owner === owner) bytes += session.size - session.received;
    for (const reservation of reservations.values()) if (!owner || reservation.owner === owner) bytes += reservation.bytes;
    return bytes;
  }
  function usage(owner) { const roots = [uploads, exports, ...(previews ? [previews] : [])]; return roots.reduce((total, root) => total + directoryBytes(owner ? path.join(root, owner) : root), 0); }
  function available(owner) {
    return Math.max(0, Math.floor(Math.min(policy.userBytes - usage(owner) - reserved(owner),
      policy.totalBytes - usage() - reserved(), diskFree() - policy.minFreeBytes - reserved())));
  }
  function check(owner, bytes = 0) {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid storage reservation');
    if (usage(owner) + reserved(owner) + bytes > policy.userBytes) throw Object.assign(new Error('พื้นที่บัญชีเต็ม กรุณาลบไฟล์ที่ไม่ใช้แล้ว'), { status: 413 });
    if (usage() + reserved() + bytes > policy.totalBytes || diskFree() - reserved() - bytes < policy.minFreeBytes)
      throw Object.assign(new Error('พื้นที่เซิร์ฟเวอร์ไม่เพียงพอ กรุณาลองใหม่ภายหลัง'), { status: 507 });
  }
  function reserveExport(owner) {
    check(owner);
    const bytes = Math.min(policy.exportBytes, available(owner));
    if (bytes <= 0) throw Object.assign(new Error('พื้นที่สำหรับ Export ไม่เพียงพอ'), { status: 507 });
    const key = Symbol('export'); reservations.set(key, { owner, bytes });
    return { bytes, release: () => reservations.delete(key) };
  }
  return { check, reserveExport, summary: owner => ({ usedBytes: usage(owner), reservedBytes: reserved(owner), limitBytes: policy.userBytes }), policy };
}
module.exports = { createStorageLimits, limitsFromEnv };
