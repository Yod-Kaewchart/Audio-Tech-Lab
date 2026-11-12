'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn, execFileSync } = require('node:child_process'), crypto = require('node:crypto');
const { createProcessRunner } = require('./process-runner.cjs');
const ps = String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, kill = String.raw`C:\Windows\System32\taskkill.exe`;
const configuredPython = process.env.ATL_AUDIO_PYTHON || String.raw`D:\Projects\Audio Album Splitter AI\.venv\Scripts\python.exe`;
let python = configuredPython;
if (process.platform === 'win32' && !fs.existsSync(python)) {
  try { python = execFileSync('py.exe', ['-3', '-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).trim(); }
  catch { python = null; }
}
const alive = pid => execFileSync(ps, ['-NoProfile', '-Command', `if(Get-Process -Id ${pid} -ErrorAction SilentlyContinue){'yes'}`], { encoding: 'utf8', windowsHide: true }).trim() === 'yes';
const waitFile = async file => { const end = Date.now() + 5000; while (!fs.existsSync(file)) { if (Date.now() > end) throw new Error('Worker did not start'); await new Promise(resolve => setTimeout(resolve, 30)); } };
const waitDead = async pid => { const end = Date.now() + 5000; while (alive(pid)) { if (Date.now() > end) throw new Error('Worker parent did not exit'); await new Promise(resolve => setTimeout(resolve, 30)); } };
test('Windows timeout and backend recovery stop the whole audio process tree', { skip: process.platform !== 'win32' || !python || !fs.existsSync(python) }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-runner-')), marker = path.join(root, 'worker.json'), script = path.join(root, 'bridge.py'), worker = path.join(__dirname, 'queue-worker.py');
  let orphan;
  fs.writeFileSync(script, 'import subprocess,sys,time\np=subprocess.Popen([sys.executable,"-c","import time;time.sleep(60)"])\nopen(sys.argv[1],"w").write(str(p.pid))\ntime.sleep(60)\n');
  try {
    const source = path.join(root, 'timed.pid'), runner = createProcessRunner({ marker, python, cwd: root, worker, timeout: 2000 });
    const timed = runner(script, [source]);
    await waitFile(source); const descendant = Number(fs.readFileSync(source, 'utf8'));
    await assert.rejects(timed, /exceeded/); assert.equal(alive(descendant), false); assert.equal(fs.existsSync(marker), false);
    const priorSource = path.join(root, 'prior.pid'), startedAt = Date.now(), token = crypto.randomUUID();
    const orphanCode = 'import subprocess,sys,time; p=subprocess.Popen([sys.executable,"-c","import time;time.sleep(60)"]); open(sys.argv[3],"w").write(str(p.pid)); time.sleep(60)';
    orphan = spawn(python, ['-X', 'atl_worker=' + token, '-c', orphanCode, worker, script, priorSource], { cwd: root, windowsHide: true, stdio: 'ignore' });
    await waitFile(priorSource); const priorChild = Number(fs.readFileSync(priorSource, 'utf8'));
    fs.writeFileSync(marker, JSON.stringify({ pid: orphan.pid, worker, script, source: priorSource, token, startedAt }));
    const recoveredRunner = createProcessRunner({ marker, python, cwd: root, worker });
    await recoveredRunner.ready;
    assert.equal(alive(orphan.pid), false); assert.equal(alive(priorChild), false); assert.equal(fs.existsSync(marker), false);
  } finally { if (orphan?.pid && alive(orphan.pid)) execFileSync(kill, ['/PID', String(orphan.pid), '/T', '/F']); fs.rmSync(root, { recursive: true, force: true }); }
});

test('AbortSignal cancellation stops the active audio process tree', { skip: process.platform !== 'win32' || !python || !fs.existsSync(python) }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-runner-cancel-')), marker = path.join(root, 'worker.json'), script = path.join(root, 'bridge.py'), worker = path.join(__dirname, 'queue-worker.py');
  fs.writeFileSync(script, 'import subprocess,sys,time\np=subprocess.Popen([sys.executable,"-c","import time;time.sleep(60)"])\nopen(sys.argv[1],"w").write(str(p.pid))\ntime.sleep(60)\n');
  try {
    const source = path.join(root, 'cancel.pid'), runner = createProcessRunner({ marker, python, cwd: root, worker, timeout: 30000 });
    const controller = new AbortController(), task = runner(script, [source], undefined, { signal: controller.signal });
    await waitFile(source); const descendant = Number(fs.readFileSync(source, 'utf8'));
    controller.abort();
    await assert.rejects(task, error => error.cancelled === true && error.safeCode === 'USER_CANCELLED');
    assert.equal(alive(descendant), false); assert.equal(fs.existsSync(marker), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('startup recovery preserves the marker when the worker exited but an orphan descendant remains', { skip: process.platform !== 'win32' || !python || !fs.existsSync(python) }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-runner-orphan-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const marker = path.join(root, 'worker.json'), script = path.join(root, 'bridge.py');
  const worker = path.join(__dirname, 'queue-worker.py'), source = path.join(root, 'orphan.pid');
  const token = crypto.randomUUID(), startedAt = Date.now();
  const code = 'import subprocess,sys; p=subprocess.Popen([sys.executable,"-c","import time;time.sleep(60)"]); open(sys.argv[3],"w").write(str(p.pid))';
  const parent = spawn(python, ['-X', 'atl_worker=' + token, '-c', code, worker, script, source], { cwd: root, windowsHide: true, stdio: 'ignore' });
  let orphanPid;
  try {
    await waitFile(source); orphanPid = Number(fs.readFileSync(source, 'utf8'));
    await waitDead(parent.pid);
    fs.writeFileSync(marker, JSON.stringify({ pid: parent.pid, worker, script, source, token, startedAt }));
    assert.throws(() => createProcessRunner({ marker, python, cwd: root, worker }), /Cannot safely recover/);
    assert.throws(() => execFileSync(ps, ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'stop-worker.ps1'), '-WorkerPid', String(parent.pid), '-ExpectedPython', python, '-ExpectedToken', token], { windowsHide: true, stdio: 'ignore' }), error => error.status === 11);
    assert.ok(fs.existsSync(marker));
    assert.equal(alive(orphanPid), true);
  } finally {
    if (parent.pid && alive(parent.pid)) execFileSync(kill, ['/PID', String(parent.pid), '/T', '/F']);
    if (orphanPid && alive(orphanPid)) execFileSync(kill, ['/PID', String(orphanPid), '/T', '/F']);
  }
});
