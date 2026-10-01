'use strict';
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const REDIRECT_URI = 'https://demo.audiotechlabs.com/api/spotify/callback';

// Only the backend entry point calls this. Never load credentials in the web
// proxy, supervisor, imported test servers, or frontend build.
function loadSpotifyConfig({ env = process.env, platform = process.platform, exists = fs.existsSync, run = execFileSync } = {}) {
  const id = String(env.SPOTIFY_CLIENT_ID || '').trim();
  const secret = String(env.SPOTIFY_CLIENT_SECRET || '').trim();
  if (env.SPOTIFY_REDIRECT_URI && env.SPOTIFY_REDIRECT_URI.trim() !== REDIRECT_URI) {
    throw new Error('SPOTIFY_REDIRECT_URI must equal ' + REDIRECT_URI);
  }
  if (id || secret) {
    if (!id || !secret) throw new Error('Set both Spotify environment credentials, or remove both to use the encrypted store');
    env.SPOTIFY_REDIRECT_URI = REDIRECT_URI;
    return true;
  }
  if (platform !== 'win32' || !env.LOCALAPPDATA) return false;
  const file = path.join(env.LOCALAPPDATA, 'AudioTechLab', 'spotify.clixml');
  if (!exists(file)) return false;
  try {
    const powershell = path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const output = run(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '..', 'tools', 'read-spotify-credentials.ps1')], {
      env, encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 16384, stdio: ['ignore', 'pipe', 'pipe']
    });
    const data = JSON.parse(output.replace(/^\uFEFF/, ''));
    if (!/^[a-f0-9]{32}$/i.test(data.clientId) || !/^[a-f0-9]{32}$/i.test(data.clientSecret)) throw new Error();
    env.SPOTIFY_CLIENT_ID = data.clientId;
    env.SPOTIFY_CLIENT_SECRET = data.clientSecret;
    env.SPOTIFY_REDIRECT_URI = REDIRECT_URI;
    return true;
  } catch {
    // Do not propagate child-process output or malformed credential contents.
    throw new Error('Cannot load encrypted Spotify credentials; run setup-spotify.ps1 as the backend Windows user');
  }
}
module.exports = { loadSpotifyConfig, REDIRECT_URI };
