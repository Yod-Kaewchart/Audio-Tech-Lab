'use strict';
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createServer } = require('../server/upload-server.js');
const project = path.resolve(__dirname, '..');
const splitter = path.resolve(process.env.ATL_SPLITTER_ROOT || String.raw`D:\Projects\Audio Album Splitter AI`);
const python = path.join(splitter, '.venv-backend', 'Scripts', 'python.exe');
const root = path.join(project, 'tools', 'runtime', 'backend-only');
const port = Number(process.env.ATL_BACKEND_PORT || 8788);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid backend port');
if (!fs.existsSync(python)) throw new Error('Create .venv-backend and install server/requirements-backend.txt first');
process.env.ATL_SPLITTER_ROOT = splitter;
process.env.ATL_AUDIO_PYTHON = python;
// This staging entry point never loads production credentials or starts a tunnel.
for (const key of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI', 'ATL_DEMO_ORIGIN']) delete process.env[key];
const check = [
  'import importlib.util, subprocess',
  'from core.audio_info import read_audio_info',
  'from core.analysis.streaming_source_analyzer import StreamingSourceAnalyzer',
  'from core.audio.qc import analyze_audio_qc',
  'from core.export.batch_exporter import BatchExporter',
  'from core.export.ffmpeg_locator import resolve_ffmpeg_executable, resolve_ffprobe_executable',
  'assert all(importlib.util.find_spec(m) is None for m in ("PySide6", "pyqtgraph", "sounddevice", "pyaudio"))',
  'for exe in (resolve_ffmpeg_executable(), resolve_ffprobe_executable()): subprocess.run([str(exe), "-version"], check=True, capture_output=True)',
  'print("Backend-only preflight passed")'
].join('\n');
console.log(execFileSync(python, ['-c', check], { cwd: splitter, encoding: 'utf8', windowsHide: true }).trim());
const server = createServer({ root, splitter, python, scripts: path.join(project, 'server'), origin: 'http://127.0.0.1:' + port });
server.listen(port, '127.0.0.1', () => console.log('Backend-only staging: http://127.0.0.1:' + port));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
