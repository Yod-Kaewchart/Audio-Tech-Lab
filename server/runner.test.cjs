'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { createProcessRunner } = require('./process-runner.cjs');
const ps = String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, kill = String.raw`C:\Windows\System32\taskkill.exe`;
const python = String.raw`D:\Projects\Audio Album Splitter AI\.venv\Scripts\python.exe`;
const alive = pid => execFileSync(ps, ['-NoProfile', '-Command', `if(Get-Process -Id ${pid} -ErrorAction SilentlyContinue){'yes'}`], { encoding: 'utf8', windowsHide: true }).trim() === 'yes';
const waitFile = async file => { const end = Date.now() + 5000; while (!fs.existsSync(file)) { if (Date.now() > end) throw new Error('Worker did not start'); await new Promise(resolve => setTimeout(resolve, 30)); } };
test('Windows timeout and backend recovery stop the whole audio process tree', { skip: process.platform !== 'win32' }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-runner-')), marker = path.join(root, 'worker.json'), script = path.join(root, 'bridge.py'), worker = path.join(__dirname, 'queue-worker.py');
  let orphan;
  fs.writeFileSync(script, 'import subprocess,sys,time\np=subprocess.Popen([sys.executable,"-c","import time;time.sleep(60)"])\nopen(sys.argv[1],"w").write(str(p.pid))\ntime.sleep(60)\n');
  try {
    const source = path.join(root, 'timed.pid'), runner = createProcessRunner({ marker, python, cwd: root, worker, timeout: 2000 });
    const timed = runner(script, [source]);
    await waitFile(source); const descendant = Number(fs.readFileSync(source, 'utf8'));
    await assert.rejects(timed, /exceeded/); assert.equal(alive(descendant), false); assert.equal(fs.existsSync(marker), false);
    const priorSource = path.join(root, 'prior.pid'), startedAt = Date.now();
    orphan = spawn(python, [worker, script, priorSource], { cwd: root, windowsHide: true, stdio: 'ignore' });
    await waitFile(priorSource); const priorChild = Number(fs.readFileSync(priorSource, 'utf8'));
    fs.writeFileSync(marker, JSON.stringify({ pid: orphan.pid, worker, script, source: priorSource, startedAt }));
    createProcessRunner({ marker, python, cwd: root, worker });
    assert.equal(alive(orphan.pid), false); assert.equal(alive(priorChild), false); assert.equal(fs.existsSync(marker), false);
  } finally { if (orphan?.pid && alive(orphan.pid)) execFileSync(kill, ['/PID', String(orphan.pid), '/T', '/F']); fs.rmSync(root, { recursive: true, force: true }); }
});

test('AbortSignal cancellation stops the active audio process tree', { skip: process.platform !== 'win32' }, async () => {
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
