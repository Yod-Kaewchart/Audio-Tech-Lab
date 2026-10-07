'use strict';
const fs = require('node:fs'), path = require('node:path');
const { execFile } = require('node:child_process');
const CACHE_MS = 10000, TIMEOUT_MS = 10000;
const SSH_OPTIONS = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'PasswordAuthentication=no',
  '-o', 'KbdInteractiveAuthentication=no', '-o', 'ConnectTimeout=3', '-o', 'ConnectionAttempts=1',
  '-o', 'ServerAliveInterval=2', '-o', 'ServerAliveCountMax=2'];
function readConfig(file) {
  if (!fs.existsSync(file)) return { enabled: false };
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!value || typeof value !== 'object' || typeof value.enabled !== 'boolean' || Object.keys(value).some(key => !['enabled', 'sshAlias'].includes(key))) throw new Error('Invalid monitoring configuration');
  if (value.enabled && (typeof value.sshAlias !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value.sshAlias))) throw new Error('Invalid SSH alias');
  return { enabled: value.enabled, sshAlias: value.sshAlias };
}
function telemetry(value) {
  const bytes = number => Number.isSafeInteger(number) && number >= 0;
  if (value?.machine !== 'MODIFY' || typeof value.os !== 'string' || value.os.length < 1 || value.os.length > 160 ||
      !bytes(value.uptimeSeconds) || !bytes(value.totalMemoryBytes) || value.totalMemoryBytes === 0 || !bytes(value.freeMemoryBytes) || value.freeMemoryBytes > value.totalMemoryBytes ||
      !(value.cpuPercent === null || (typeof value.cpuPercent === 'number' && Number.isFinite(value.cpuPercent) && value.cpuPercent >= 0 && value.cpuPercent <= 100)) ||
      !Array.isArray(value.disks) || value.disks.length < 1 || value.disks.length > 26 || value.disks.some(disk => !/^[A-Z]:$/.test(disk?.drive) || !bytes(disk.totalBytes) || disk.totalBytes === 0 || !bytes(disk.freeBytes) || disk.freeBytes > disk.totalBytes) ||
      new Set(value.disks.map(disk => disk.drive)).size !== value.disks.length) throw new Error('Invalid machine telemetry');
  // Whitelist output fields; SSH details, process lists and arbitrary remote data never reach the API.
  return { os: value.os, uptimeSeconds: value.uptimeSeconds, cpuPercent: value.cpuPercent,
    totalMemoryBytes: value.totalMemoryBytes, freeMemoryBytes: value.freeMemoryBytes,
    disks: value.disks.map(disk => ({ drive: disk.drive, totalBytes: disk.totalBytes, freeBytes: disk.freeBytes })) };
}
function warnings(metrics) {
  const result = [];
  if (metrics.cpuPercent !== null && metrics.cpuPercent >= 95) result.push('CPU_HIGH');
  if ((1 - metrics.freeMemoryBytes / metrics.totalMemoryBytes) * 100 >= 90) result.push('MEMORY_HIGH');
  for (const disk of metrics.disks) if (disk.freeBytes / disk.totalBytes < 0.1 || disk.freeBytes < 5 * 1024 ** 3) result.push('DISK_LOW_' + disk.drive[0]);
  return result;
}
function createModifyMonitor({ configFile, execute = execFile, now = Date.now, platform = process.platform, systemRoot = process.env.SystemRoot || 'C:/Windows' } = {}) {
  if (!configFile) throw new Error('Monitoring configuration path required');
  const ssh = platform === 'win32' ? path.join(systemRoot, 'System32', 'OpenSSH', 'ssh.exe') : 'ssh';
  const script = fs.readFileSync(path.join(__dirname, 'modify-health.ps1'), 'utf8');
  const command = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -NonInteractive -EncodedCommand ' + Buffer.from(script, 'utf16le').toString('base64');
  let cache = null, flight = null, child = null, closed = false;
  const base = { service: 'audio-tech-labs-machine-health', apiVersion: 1, machine: 'modify' };
  const unknown = code => ({ ...base, configured: false, status: 'unknown', checkedAt: null, metrics: null, warnings: [], code });
  async function check() {
    if (closed) return unknown('MONITOR_STOPPED');
    let config;
    try { config = readConfig(configFile); } catch { cache = null; return unknown('CONFIG_INVALID'); }
    if (!config.enabled) { cache = null; return unknown('NOT_CONFIGURED'); }
    const key = config.sshAlias;
    if (flight) {
      if (flight.key === key) return flight.promise;
      // Hold the old flight until it settles before using a changed local configuration.
      await flight.promise; return check();
    }
    if (cache?.key === key && now() - cache.value.checkedAt < CACHE_MS) return { ...cache.value, cached: true };
    const started = now();
    const promise = new Promise(resolve => {
      let settled = false;
      const finish = (error, stdout) => {
        if (settled) return; settled = true; child = null;
        let metrics = null, code = null;
        if (error) code = error.killed || error.signal ? 'SSH_TIMEOUT' : error.code === 'ENOENT' ? 'SSH_UNAVAILABLE' : 'SSH_UNREACHABLE';
        else try { metrics = telemetry(JSON.parse(String(stdout).replace(/^\uFEFF/, '').trim())); } catch { code = 'INVALID_TELEMETRY'; }
        const issues = metrics ? warnings(metrics) : [];
        const value = { ...base, configured: true, status: metrics ? issues.length ? 'warning' : 'online' : code === 'SSH_UNREACHABLE' || code === 'SSH_TIMEOUT' ? 'offline' : 'unknown',
          checkedAt: now(), durationMs: Math.max(0, now() - started), metrics, warnings: issues, code, cached: false };
        cache = { key, value }; resolve(value);
      };
      try { child = execute(ssh, [...SSH_OPTIONS, key, command], { encoding: 'utf8', windowsHide: true, timeout: TIMEOUT_MS, maxBuffer: 32768 }, finish); }
      catch (error) { finish(error); }
    });
    flight = { key, promise };
    try { return await promise; } finally { flight = null; }
  }
  function close() { closed = true; cache = null; child?.kill(); }
  return { check, close };
}
module.exports = { createModifyMonitor, telemetry, warnings, readConfig, CACHE_MS, TIMEOUT_MS };
