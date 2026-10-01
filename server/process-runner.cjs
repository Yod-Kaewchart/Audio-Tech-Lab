'use strict';
const fs = require('node:fs'), path = require('node:path');
const { spawn, execFile, execFileSync } = require('node:child_process');
function createProcessRunner({ marker, python, cwd, worker, timeout = 30 * 60 * 1000 }) {
  const powershell = String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
  const taskkill = String.raw`C:\Windows\System32\taskkill.exe`;
  function inspect(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid worker PID');
    const code = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' -ErrorAction SilentlyContinue;if($p){[pscustomobject]@{Executable=$p.ExecutablePath;Command=$p.CommandLine;Created=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress}`;
    const text = execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', code], { windowsHide: true, timeout: 10000, encoding: 'utf8' }).trim();
    return text ? JSON.parse(text) : null;
  }
  if (fs.existsSync(marker)) {
    const prior = JSON.parse(fs.readFileSync(marker, 'utf8')), processInfo = inspect(prior.pid);
    if (processInfo) {
      if (processInfo.Executable.toLowerCase() !== python.toLowerCase() || !processInfo.Command.includes(prior.worker) || !processInfo.Command.includes(prior.script) || !processInfo.Command.includes(prior.source) || Math.abs(Date.parse(processInfo.Created) - prior.startedAt) > 10000) throw new Error('Cannot safely recover previous worker; processing stays stopped');
      try { execFileSync(taskkill, ['/PID', String(prior.pid), '/T', '/F'], { windowsHide: true, timeout: 10000, stdio: 'ignore' }); }
      catch (error) { if (inspect(prior.pid)) throw error; }
    }
    fs.rmSync(marker, { force: true });
  }
  let current = null;
  function run(script, args, input) {
    if (current) return Promise.reject(new Error('Another worker is still active'));
    return new Promise((resolve, reject) => {
      const child = spawn(python, [worker, script, ...args], { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      current = child;
      let stdout = '', bytes = 0, error = null, closed = false, stopping = false, killDone = true;
      function finish() {
        if (!closed || !killDone) return;
        clearTimeout(timer); current = null; fs.rmSync(marker, { force: true });
        if (error) reject(error); else resolve(stdout);
      }
      function stop(message) {
        if (stopping) return; stopping = true; error = new Error(message); killDone = false;
        if (!child.pid) { killDone = true; finish(); return; }
        execFile(taskkill, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000 }, () => { killDone = true; finish(); });
      }
      child.stopTree = () => stop('Backend restarted. Please submit the job again');
      child.once('spawn', () => {
        try { fs.writeFileSync(marker + '.tmp', JSON.stringify({ pid: child.pid, worker, script, source: args[0], startedAt: Date.now() })); fs.renameSync(marker + '.tmp', marker); }
        catch { stop('Could not save worker status'); }
      });
      child.stdout.on('data', buffer => { bytes += buffer.length; if (bytes > 4 * 1024 * 1024) stop('Processing output was too large'); else stdout += buffer.toString('utf8'); });
      child.stderr.on('data', buffer => { bytes += buffer.length; if (bytes > 4 * 1024 * 1024) stop('Processing output was too large'); });
      child.once('error', () => { error = new Error('Could not start the audio worker'); });
      child.once('close', code => { closed = true; if (code !== 0 && !error) error = new Error(code === 22 ? 'พื้นที่สำหรับไฟล์ Export ไม่เพียงพอ กรุณาลบไฟล์ที่ไม่ใช้แล้วหรือลดขนาดไฟล์เสียง' : 'Audio processing failed. Please retry'); finish(); });
      child.stdin.on('error', () => {}); child.stdin.end(input);
      const timer = setTimeout(() => stop('Processing exceeded 30 minutes. Please retry'), timeout);
    });
  }
  run.close = () => { if (current) current.stopTree(); };
  return run;
}
module.exports = { createProcessRunner };
