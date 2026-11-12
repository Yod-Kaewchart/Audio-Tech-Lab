'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const childProcess = require('node:child_process');

function createProcessRunner({ marker, python, cwd, worker, timeout = 30 * 60 * 1000,
  stopTimeout = 15000, processOps = childProcess }) {
  const powershell = String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
  const stopScript = path.join(__dirname, 'stop-worker.ps1');
  function inspect(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid worker PID');
    const code = `$all=Get-CimInstance Win32_Process -ErrorAction Stop;$ids=@(${pid});do{$old=$ids.Count;foreach($x in $all){if(($ids -contains [int]$x.ParentProcessId) -and ($ids -notcontains [int]$x.ProcessId)){$ids+= [int]$x.ProcessId}}}while($ids.Count -gt $old);$p=$all|Where-Object{[int]$_.ProcessId -eq ${pid}}|Select-Object -First 1;if($p){[pscustomobject]@{Executable=$p.ExecutablePath;Command=$p.CommandLine;Created=$p.CreationDate.ToUniversalTime().ToString('o');DescendantCount=$ids.Count-1}|ConvertTo-Json -Compress}elseif($ids.Count -gt 1){[pscustomobject]@{Executable='';Command='';Created='';DescendantCount=$ids.Count-1}|ConvertTo-Json -Compress}`;
    const text = processOps.execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', code], { windowsHide: true, timeout: 10000, encoding: 'utf8' }).trim();
    return text ? JSON.parse(text) : null;
  }
  function matches(info, record) {
    return typeof record.token === 'string' && /^[0-9a-f-]{36}$/.test(record.token) &&
      typeof info?.Executable === 'string' && info.Executable.toLowerCase() === python.toLowerCase() &&
      typeof info.Command === 'string' && info.Command.includes('atl_worker=' + record.token) &&
      info.Command.includes(record.worker) && info.Command.includes(record.script) &&
      typeof record.source === 'string' && info.Command.includes(record.source) &&
      Number.isFinite(Date.parse(info.Created)) && Number.isFinite(record.startedAt) &&
      Math.abs(Date.parse(info.Created) - record.startedAt) <= 10000;
  }
  function stopArgs(record) {
    return ['-NoProfile', '-NonInteractive', '-File', stopScript, '-WorkerPid', String(record.pid),
      '-ExpectedPython', python, '-ExpectedToken', record.token];
  }
  function stopWorker(record) {
    return new Promise((resolve, reject) => {
      let done = false, helper;
      const confirmWorkerTreeGone = error => {
        try {
          if (!inspect(record.pid)) { error.pidState = 'not-found'; return true; }
          error.pidState = 'alive';
        } catch { error.pidState = 'inspection-failed'; }
        return false;
      };
      const rejectAfterInspection = error => {
        if (confirmWorkerTreeGone(error)) { resolve(); return; }
        reject(error);
      };
      const deadline = setTimeout(() => {
        if (done) return; done = true;
        // Do not kill the helper: its handle must remain open until taskkill
        // finishes, even if the caller has already reported an error.
        helper?.unref?.(); helper?.stdout?.destroy(); helper?.stderr?.destroy();
        const error = new Error('Worker cleanup deadline exceeded');
        if (confirmWorkerTreeGone(error)) { resolve(); return; }
        reject(error);
      }, stopTimeout);
      try {
        helper = processOps.execFile(powershell, stopArgs(record), { windowsHide: true }, error => {
          if (done) return; done = true; clearTimeout(deadline);
          if (error && error.code !== 10) rejectAfterInspection(error);
          else resolve();
        });
      } catch (error) { done = true; clearTimeout(deadline); rejectAfterInspection(error); }
    });
  }
  // An interrupted or failed marker write needs operator review; never
  // discard the partial recovery record or start a second worker over it.
  if (fs.existsSync(marker + '.tmp')) throw new Error('Incomplete worker marker; processing stays stopped');
  const hadMarker = fs.existsSync(marker);
  let recoveryConfirmed = !hadMarker, recovery = Promise.resolve(false);
  if (hadMarker) {
    const prior = JSON.parse(fs.readFileSync(marker, 'utf8')), info = inspect(prior.pid);
    if (info) {
      // Old markers without a unique token are retained for manual recovery.
      if (!matches(info, prior)) throw new Error('Cannot safely recover previous worker; processing stays stopped');
      recovery = stopWorker(prior).then(() => {
        if (inspect(prior.pid)) throw new Error('Previous worker cleanup is unconfirmed; processing stays stopped');
        const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
        if (saved.token !== prior.token || saved.pid !== prior.pid) throw new Error('Worker marker changed');
        fs.rmSync(marker); return true;
      });
    } else {
      fs.rmSync(marker, { force: true }); recoveryConfirmed = true; recovery = Promise.resolve(true);
    }
  }
  recovery = recovery.catch(cause => { throw Object.assign(new Error('Worker recovery could not be confirmed; processing is stopped'), { safeCode: 'WORKER_CLEANUP_UNCONFIRMED', cleanupUnconfirmed: true, cause }); });
  recovery = recovery.then(value => { recoveryConfirmed = true; return value; });
  // The server also observes this promise; retain failure for later run calls.
  recovery.catch(() => {});
  let current = null, blocked = false;
  async function run(script, args, input, { signal } = {}) {
    if (signal?.aborted) return Promise.reject(Object.assign(new Error('Processing cancelled'), { cancelled: true, safeCode: 'USER_CANCELLED' }));
    await recovery;
    if (signal?.aborted) return Promise.reject(Object.assign(new Error('Processing cancelled'), { cancelled: true, safeCode: 'USER_CANCELLED' }));
    if (blocked) return Promise.reject(Object.assign(new Error('Worker cleanup is unconfirmed; processing stays stopped'), { safeCode: 'WORKER_CLEANUP_UNCONFIRMED', cleanupUnconfirmed: true }));
    if (current) return Promise.reject(new Error('Another worker is still active'));
    return new Promise((resolve, reject) => {
      const token = crypto.randomUUID();
      const record = { worker, script, source: args[0], token, startedAt: Date.now() };
      const child = processOps.spawn(python, ['-X', 'atl_worker=' + token, worker, script, ...args], {
        cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ATL_WORKER_MARKER: marker }
      });
      record.pid = child.pid; current = child;
      let stdout = '', bytes = 0, error = null, closed = false, exited = false, spawned = false;
      let stopping = false, killDone = true, settled = false, timer, stopTimer;
      function unconfirmed(cause) {
        if (settled) return;
        blocked = true;
        const failure = Object.assign(new Error('Worker cleanup could not be confirmed; processing is stopped'), {
          safeCode: 'WORKER_CLEANUP_UNCONFIRMED', cleanupUnconfirmed: true, cause, cleanupError: cause,
          originalError: error || null, originalSafeCode: error?.safeCode, cancelled: error?.cancelled === true
        });
        finish(failure);
      }
      function finish(failure) {
        if (settled || (!failure && (!closed || !killDone))) return;
        settled = true; clearTimeout(timer); clearTimeout(stopTimer); signal?.removeEventListener('abort', onAbort);
        if (failure) { reject(failure); return; }
        try {
          if (fs.existsSync(marker)) {
            const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
            if (saved.token !== token || saved.pid !== record.pid) throw new Error('Worker marker changed');
            fs.rmSync(marker);
          }
        } catch (cause) {
          blocked = true;
          reject(Object.assign(new Error('Worker recovery marker could not be cleared; processing is stopped'), {
            safeCode: 'WORKER_CLEANUP_UNCONFIRMED', cleanupUnconfirmed: true, cause, cleanupError: cause,
            originalError: error || null, originalSafeCode: error?.safeCode, cancelled: error?.cancelled === true
          }));
          return;
        }
        current = null;
        if (error) reject(error); else resolve(stdout);
      }
      function launchStop() {
        if (settled || !stopping || killDone) return;
        if (exited || closed) { killDone = true; finish(); return; }
        clearTimeout(stopTimer); stopTimer = null;
        stopWorker(record).then(() => { if (!settled) { killDone = true; finish(); } }, unconfirmed);
      }
      function stop(message, cancelled = false) {
        if (stopping || settled) return;
        stopping = true;
        error = Object.assign(new Error(message), cancelled ? { cancelled: true, safeCode: 'USER_CANCELLED' } : {});
        killDone = false;
        stopTimer = setTimeout(() => {
          const cause = new Error('Worker cleanup deadline exceeded');
          if (record.pid) {
            try { cause.pidState = inspect(record.pid) ? 'alive' : 'not-found'; }
            catch { cause.pidState = 'inspection-failed'; }
          }
          unconfirmed(cause);
        }, stopTimeout);
        if (exited || closed) { killDone = true; finish(); }
        else if (spawned) launchStop();
      }
      const onAbort = () => stop('Processing cancelled', true);
      signal?.addEventListener('abort', onAbort, { once: true });
      child.stopTree = () => stop('Backend restarted. Please submit the job again');
      child.once('spawn', () => {
        spawned = true;
        if (settled) { try { child.kill?.(); } catch {} return; }
        try {
          fs.writeFileSync(marker + '.tmp', JSON.stringify(record), { flag: 'wx' });
          // Link is exclusive: a marker created by another instance cannot
          // be overwritten. A crash leaves either the record or its temp copy.
          fs.linkSync(marker + '.tmp', marker);
          fs.unlinkSync(marker + '.tmp');
        } catch (cause) { stop('Could not save worker status'); unconfirmed(cause); return; }
        if (stopping) launchStop();
      });
      child.stdout.on('data', buffer => { bytes += buffer.length; if (bytes > 4 * 1024 * 1024) stop('Processing output was too large'); else stdout += buffer.toString('utf8'); });
      child.stderr.on('data', buffer => { bytes += buffer.length; if (bytes > 4 * 1024 * 1024) stop('Processing output was too large'); });
      child.once('error', () => { if (!stopping) error = new Error('Could not start the audio worker'); });
      child.once('exit', () => { exited = true; });
      child.once('close', code => {
        closed = true;
        if (stopping && !spawned) killDone = true;
        if (code !== 0 && !error) error = new Error(code === 22 ? 'พื้นที่สำหรับไฟล์ Export ไม่เพียงพอ กรุณาลบไฟล์ที่ไม่ใช้แล้วหรือลดขนาดไฟล์เสียง' : 'Audio processing failed. Please retry');
        finish();
      });
      child.stdin.on('error', () => {}); child.stdin.end(input);
      timer = setTimeout(() => stop('Processing exceeded 30 minutes. Please retry'), timeout);
    });
  }
  run.close = () => { if (current && !blocked) current.stopTree(); };
  Object.defineProperty(run, 'recoveryConfirmed', { enumerable: true, get: () => recoveryConfirmed });
  run.ready = recovery;
  return run;
}
module.exports = { createProcessRunner };
