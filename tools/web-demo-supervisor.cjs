'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { deploymentMode } = require('./deployment-config.cjs');
const { origin: publicOrigin, config: tunnelConfig, quick: quickTunnel, external: externalTunnel } = deploymentMode();
const pagesMode = process.env.ATL_PAGES_MODE === '1';
const root = path.resolve(__dirname, '..');
const runtime = path.join(__dirname, 'runtime');
fs.mkdirSync(runtime, { recursive: true });
const logFile = path.join(runtime, 'supervisor.log');
function log(message) {
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 5 * 1024 * 1024) {
      const old = logFile + '.1';
      if (fs.existsSync(old)) fs.unlinkSync(old);
      fs.renameSync(logFile, old);
    }
    fs.appendFileSync(logFile, new Date().toISOString() + ' ' + message + '\n');
  } catch (error) { console.error(error.message); }
}
process.on('uncaughtException', error => { log('Supervisor fatal: ' + (error?.stack || error)); process.exit(1); });
process.on('unhandledRejection', error => { log('Supervisor rejection: ' + (error?.stack || error)); process.exit(1); });
const state = { startedAt: new Date().toISOString(), supervisorPid: process.pid, services: {}, backendUrl: null, webUrl: publicOrigin, mode: pagesMode ? 'cloudflare-pages-backend' : externalTunnel ? 'external-named-tunnel' : publicOrigin ? 'named-tunnel' : quickTunnel ? 'development-tunnel' : 'local' };
function saveState() {
  const target = path.join(runtime, 'state.json');
  fs.writeFileSync(target + '.tmp', JSON.stringify(state, null, 2));
  fs.renameSync(target + '.tmp', target);
}
function publishURLs() {
  saveState();
  const urlFile = path.join(runtime, 'demo-url.txt');
  fs.writeFileSync(urlFile, (state.webUrl || 'http://127.0.0.1:8080') + '/demo/\r\n');
}
const tunnel = path.join(__dirname, 'cloudflared.exe');
const specs = [
  { name: 'backend', exe: process.execPath, args: [path.join(root, 'server', 'upload-server.js')] },
];
if (!pagesMode) specs.push({ name: 'web', exe: process.execPath, args: [path.join(root, 'server', 'web-server.cjs')] });
if (!pagesMode && publicOrigin && !externalTunnel) specs.push({ name: 'webTunnel', exe: tunnel, args: ['tunnel', '--config', path.resolve(tunnelConfig), '--no-autoupdate', 'run'] });
else if (!pagesMode && quickTunnel) specs.push({ name: 'webTunnel', exe: tunnel, args: ['tunnel', '--url', 'http://127.0.0.1:8080', '--no-autoupdate'] });
const children = new Map();
let stopping = false;
function launch(spec) {
  if (stopping) return;
  const child = spawn(spec.exe, spec.args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.set(spec.name, child);
  state.services[spec.name] = { pid: child.pid || null, status: 'starting', startedAt: new Date().toISOString() };
  saveState();
  log(spec.name + ' starting PID ' + child.pid);
  let tail = '';
  function output(buffer) {
    const data = buffer.toString('utf8');
    log('[' + spec.name + '] ' + data.trim());
    tail = (tail + data).slice(-8192);
    const match = tail.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/);
    if (match && quickTunnel && spec.name === 'webTunnel') {
      if (state.webUrl !== match[0]) {
        try {
          state.webUrl = match[0]; publishURLs();
        } catch (error) { log('URL update failed: ' + error.message); }
      }
    }
  }
  child.stdout.on('data', output);
  child.stderr.on('data', output);
  child.once('spawn', () => { state.services[spec.name].status = 'running'; saveState(); });
  child.once('error', error => log(spec.name + ' error: ' + error.message));
  child.once('close', (code, signal) => {
    children.delete(spec.name);
    state.services[spec.name] = { ...state.services[spec.name], status: 'stopped', exitCode: code, signal, stoppedAt: new Date().toISOString() };
    if (spec.name === 'webTunnel') state.webUrl = publicOrigin;
    publishURLs();
    log(spec.name + ' stopped; code=' + code + ' signal=' + signal);
    if (!stopping) setTimeout(() => launch(spec), 10000);
  });
}
function shutdown() {
  if (stopping) return;
  stopping = true;
  log('Supervisor stopping');
  for (const child of children.values()) child.kill();
  setTimeout(() => process.exit(0), 3000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
publishURLs();
log('Supervisor started');
for (const spec of specs) launch(spec);
setInterval(async () => {
  for (const [name, url] of [['backend', 'http://127.0.0.1:8787/health'], ['web', 'http://127.0.0.1:8080/demo/']]) {
    const service = state.services[name];
    if (!service || service.status === 'stopped') continue;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      service.healthy = response.ok;
      service.checkedAt = new Date().toISOString();
      if (!response.ok) log(name + ' health HTTP ' + response.status);
    } catch (error) { service.healthy = false; log(name + ' health failed: ' + error.message); }
  }
  saveState();
}, 30000);
