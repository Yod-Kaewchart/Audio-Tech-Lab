'use strict';
const crypto = require('node:crypto');

function fail(status, message) { return Object.assign(new Error(message), { status }); }
function createSpotify({ auth, send, allowedOrigins, redirectUri }) {
  const states = new Map(), tokens = new Map();
  const clientId = () => String(process.env.SPOTIFY_CLIENT_ID || '').trim();
  const clientSecret = () => String(process.env.SPOTIFY_CLIENT_SECRET || '').trim();
  const callback = () => String(process.env.SPOTIFY_REDIRECT_URI || redirectUri || 'https://demo.audiotechlabs.com/api/spotify/callback').trim();
  const configured = () => Boolean(clientId() && clientSecret() && callback());

  async function spotifyRequest(url, options = {}) {
    const response = await fetch(url, options);
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw fail(response.status === 401 ? 401 : 502, data.error?.message || data.error_description || 'Spotify request failed');
    return data;
  }
  async function exchange(params) {
    const body = new URLSearchParams(params);
    return spotifyRequest('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(clientId() + ':' + clientSecret()).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  }
  async function accessFor(userId) {
    const entry = tokens.get(userId);
    if (!entry) throw fail(401, 'Spotify is not connected');
    if (Date.now() < entry.expiresAt - 60000) return entry.accessToken;
    if (!entry.refreshToken) { tokens.delete(userId); throw fail(401, 'Spotify connection expired'); }
    const data = await exchange({ grant_type: 'refresh_token', refresh_token: entry.refreshToken });
    entry.accessToken = data.access_token;
    entry.expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
    if (data.refresh_token) entry.refreshToken = data.refresh_token;
    return entry.accessToken;
  }
  async function handle(req, res, route) {
    if (!route.startsWith('/spotify/')) return false;
    if (route === '/spotify/callback' && req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost'), state = String(url.searchParams.get('state') || ''), pending = states.get(state);
      states.delete(state);
      if (!pending || pending.expiresAt < Date.now()) { res.writeHead(302, { Location: '/demo/?spotify=state_error' }); res.end(); return true; }
      if (url.searchParams.get('error')) { res.writeHead(302, { Location: '/demo/?spotify=denied' }); res.end(); return true; }
      const code = String(url.searchParams.get('code') || '');
      if (!code || !configured()) { res.writeHead(302, { Location: '/demo/?spotify=config_error' }); res.end(); return true; }
      try {
        const data = await exchange({ grant_type: 'authorization_code', code, redirect_uri: callback() });
        tokens.set(pending.userId, { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 });
        res.writeHead(302, { Location: '/demo/?spotify=connected' }); res.end();
      } catch { res.writeHead(302, { Location: '/demo/?spotify=connect_error' }); res.end(); }
      return true;
    }
    auth.originOK(req, allowedOrigins);
    const { user } = auth.requireUser(req);
    if (route === '/spotify/status' && req.method === 'GET') {
      return send(res, 200, { configured: configured(), connected: tokens.has(user.id) });
    }
    if (route === '/spotify/connect' && req.method === 'GET') {
      if (!configured()) throw fail(503, 'Spotify is not configured on this server');
      const state = crypto.randomBytes(32).toString('base64url');
      states.set(state, { userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 });
      const url = new URL('https://accounts.spotify.com/authorize');
      url.searchParams.set('client_id', clientId()); url.searchParams.set('response_type', 'code');
      url.searchParams.set('redirect_uri', callback()); url.searchParams.set('state', state);
      return send(res, 200, { url: url.toString() });
    }
    if (route === '/spotify/disconnect' && req.method === 'POST') {
      tokens.delete(user.id); return send(res, 200, { ok: true });
    }
    if (route === '/spotify/search' && req.method === 'GET') {
      const q = String(new URL(req.url, 'http://localhost').searchParams.get('q') || '').trim();
      if (!q || q.length > 200) throw fail(400, 'Enter an album or artist to search');
      const access = await accessFor(user.id);
      const data = await spotifyRequest('https://api.spotify.com/v1/search?type=album&limit=10&q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + access } });
      const items = (data.albums?.items || []).map(x => ({ id: x.id, name: x.name, artists: (x.artists || []).map(a => a.name), image: x.images?.[0]?.url || '', url: x.external_urls?.spotify || '', releaseDate: x.release_date || '', totalTracks: x.total_tracks || 0 }));
      return send(res, 200, { items });
    }
    if (route.startsWith('/spotify/album/') && req.method === 'GET') {
      const id = route.slice('/spotify/album/'.length);
      if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw fail(400, 'Invalid Spotify album ID');
      const access = await accessFor(user.id);
      const x = await spotifyRequest('https://api.spotify.com/v1/albums/' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + access } });
      return send(res, 200, { id: x.id, name: x.name, artists: (x.artists || []).map(a => a.name), image: x.images?.[0]?.url || '', url: x.external_urls?.spotify || '', tracks: (x.tracks?.items || []).map(t => ({ id: t.id, number: t.track_number, disc: t.disc_number, name: t.name, durationMs: t.duration_ms, url: t.external_urls?.spotify || '' })) });
    }
    throw fail(404, 'Not found');
  }
  const timer = setInterval(() => { const now = Date.now(); for (const [key, value] of states) if (value.expiresAt < now) states.delete(key); }, 60000); timer.unref();
  return { handle, close: () => clearInterval(timer) };
}
module.exports = { createSpotify };
