'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createModifyMonitor, telemetry, warnings, readConfig, CACHE_MS, TIMEOUT_MS } = require('./modify-monitor.cjs');
const sample = { machine: 'MODIFY', os: 'Microsoft Windows 11 Pro', uptimeSeconds: 4000, totalMemoryBytes: 8 * 1024 ** 3, freeMemoryBytes: 3 * 1024 ** 3, cpuPercent: 10, disks: [{ drive: 'C:', totalBytes: 256 * 1024 ** 3, freeBytes: 100 * 1024 ** 3 }] };
function configuration(t, content = { enabled: true, sshAlias: 'modify-wsl' }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-modify-test-')), file = path.join(root, 'config.json');
  if (content) fs.writeFileSync(file, JSON.stringify(content));
  t.after(() => { assert.ok(root.startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(root, { recursive: true, force: true }); });
  return file;
}
test('Telemetry validates Windows identity and ranges, and strips unexpected data', () => {
  const value = telemetry({ ...sample, key: 'private-key-content', processes: ['private-process'] });
  assert.equal(value.os, sample.os); assert.equal(JSON.stringify(value).includes('private'), false);
  for (const change of [{ machine: 'ELITEBOOK' }, { freeMemoryBytes: sample.totalMemoryBytes + 1 }, { cpuPercent: 101 }, { cpuPercent: '10' }, { uptimeSeconds: -1 }, { disks: [{ drive: '../x', totalBytes: 100, freeBytes: 10 }] }, { disks: [] }, { disks: [sample.disks[0], sample.disks[0]] }]) assert.throws(() => telemetry({ ...sample, ...change }));
  assert.equal(telemetry({ ...sample, cpuPercent: null }).cpuPercent, null);
});
test('Warning thresholds reflect CPU, memory and each disk without treating reachability as full hardware health', () => {
  assert.deepEqual(warnings(telemetry(sample)), []);
  assert.deepEqual(warnings(telemetry({ ...sample, cpuPercent: 95, freeMemoryBytes: 0, disks: [{ drive: 'C:', totalBytes: 100 * 1024 ** 3, freeBytes: 4 * 1024 ** 3 }] })), ['CPU_HIGH', 'MEMORY_HIGH', 'DISK_LOW_C']);
});
test('Disabled and invalid configuration never launch SSH or accept a command/host from configuration', async t => {
  let launches = 0;
  for (const content of [null, { enabled: false }, { enabled: true, sshAlias: '-oProxyCommand=bad' }, { enabled: true, sshAlias: 'modify;bad' }, { enabled: true, sshAlias: 'modify-wsl', command: 'bad' }]) {
    const configFile = configuration(t, content);
    const monitor = createModifyMonitor({ configFile, execute: () => { launches++; } });
    assert.equal((await monitor.check()).configured, false); monitor.close();
  }
  assert.equal(launches, 0);
});
test('SSH uses fixed read-only PowerShell, pinned host verification, finite deadlines and shared cache', async t => {
  const configFile = configuration(t), calls = []; let finish, time = 100000;
  const monitor = createModifyMonitor({ configFile, now: () => time, execute: (file, args, options, callback) => { calls.push({ file, args, options }); finish = callback; return { kill() {} }; } }); t.after(monitor.close);
  const first = monitor.check(), second = monitor.check(); assert.equal(calls.length, 1);
  assert.ok(calls[0].args.includes('StrictHostKeyChecking=yes')); assert.ok(calls[0].args.includes('PasswordAuthentication=no'));
  assert.equal(calls[0].options.timeout, TIMEOUT_MS); assert.equal(calls[0].options.windowsHide, true);
  const remote = calls[0].args.at(-1); assert.match(remote, /^\/mnt\/c\/Windows\/System32\/WindowsPowerShell\/v1.0\/powershell.exe -NoProfile -NonInteractive -EncodedCommand [A-Za-z0-9+/=]+$/);
  const script = Buffer.from(remote.split(' ').at(-1), 'base64').toString('utf16le'); assert.match(script, /Get-CimInstance/); assert.doesNotMatch(script, /Restart-|Stop-Process|Set-Item|Remove-/);
  finish(null, JSON.stringify(sample)); const [a, b] = await Promise.all([first, second]); assert.equal(a.status, 'online'); assert.deepEqual(a, b);
  assert.equal((await monitor.check()).cached, true); assert.equal(calls.length, 1);
  time += CACHE_MS + 1; const third = monitor.check(); assert.equal(calls.length, 2);
  finish({ killed: true }, 'private stdout', 'private stderr'); const failed = await third;
  assert.equal(failed.status, 'offline'); assert.equal(failed.metrics, null); assert.equal(failed.code, 'SSH_TIMEOUT'); assert.equal(JSON.stringify(failed).includes('private'), false);
});
test('Malformed telemetry, missing ssh and connection errors have safe distinct states; configuration can be disabled live', async t => {
  for (const [error, stdout, state, code] of [[null, JSON.stringify({ ...sample, machine: 'OTHER' }), 'unknown', 'INVALID_TELEMETRY'], [{ code: 'ENOENT' }, '', 'unknown', 'SSH_UNAVAILABLE'], [{ code: 255 }, '', 'offline', 'SSH_UNREACHABLE']]) {
    const configFile = configuration(t);
    const monitor = createModifyMonitor({ configFile, execute: (_file, _args, _options, done) => { queueMicrotask(() => done(error, stdout)); return { kill() {} }; } });
    const value = await monitor.check(); assert.equal(value.status, state); assert.equal(value.code, code); assert.equal(value.metrics, null);
    fs.writeFileSync(configFile, '{"enabled":false}'); assert.equal((await monitor.check()).code, 'NOT_CONFIGURED'); monitor.close();
  }
});
test('Read configuration rejects invalid JSON and returns only enabled/alias values', t => {
  const file = configuration(t); assert.deepEqual(readConfig(file), { enabled: true, sshAlias: 'modify-wsl' });
  fs.writeFileSync(file, 'null'); assert.throws(() => readConfig(file));
});
