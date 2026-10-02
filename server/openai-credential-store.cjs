'use strict';
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^sk-[A-Za-z0-9_-]{17,509}$/;

function createOpenAICredentialStore({
  directory,
  env = process.env,
  platform = process.platform,
  spawn = spawnSync,
  exists = fs.existsSync
} = {}) {
  if (!directory) throw new Error('OpenAI credential directory is required');
  const script = path.join(__dirname, '..', 'tools', 'openai-credential.ps1');
  const powershell = path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const fileFor = userId => {
    if (!UUID.test(String(userId || ''))) throw new Error('Invalid credential owner');
    return path.join(directory, userId + '.clixml');
  };
  function validate(apiKey) {
    const value = typeof apiKey === 'string' ? apiKey.trim() : '';
    if (!KEY.test(value)) throw Object.assign(new Error('Enter a valid OpenAI API key'), { status: 400 });
    return value;
  }
  function run(action, userId, input = '') {
    fileFor(userId);
    if (platform !== 'win32') throw new Error('Encrypted OpenAI credential storage requires Windows');
    const result = spawn(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', script, '-Action', action, '-UserId', userId, '-Directory', directory], {
      input, encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 16384,
      env, stdio: ['pipe', 'pipe', 'pipe']
    });
    if (result.error || result.status !== 0) throw new Error('OpenAI credential store is unavailable');
    return String(result.stdout || '').replace(/^\uFEFF/, '').trim();
  }
  function has(userId) { return exists(fileFor(userId)); }
  function write(userId, apiKey) {
    const value = validate(apiKey);
    run('write', userId, value);
  }
  function read(userId) {
    if (!has(userId)) throw Object.assign(new Error('OpenAI is not connected'), { status: 409 });
    const value = run('read', userId);
    if (!KEY.test(value)) throw new Error('OpenAI credential store is unavailable');
    return value;
  }
  function remove(userId) {
    if (!has(userId)) return false;
    run('delete', userId);
    return true;
  }
  function fingerprintFrom(apiKey) {
    const value = validate(apiKey);
    return '••••' + value.slice(-4);
  }
  function status(userId) {
    if (!has(userId)) return { connected: false, fingerprint: null };
    const value = read(userId);
    return { connected: true, fingerprint: fingerprintFrom(value) };
  }
  return { has, write, read, delete: remove, status, validate, fingerprintFrom };
}
module.exports = { createOpenAICredentialStore };