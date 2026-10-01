'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createSpotify } = require('./spotify.cjs');
const { REDIRECT_URI } = require('./spotify-config.cjs');
test('Spotify Phase 1: authenticated connect, callback, search, refresh and disconnect (mock Spotify)', async t => {
  const saved = { ...process.env }, originalFetch = global.fetch;
  for (const key of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI']) delete process.env[key];
  let user = { id: 'alice' }, requests = 0, refreshes = 0;
  const spotify = createSpotify({
    auth: { originOK: () => {}, requireUser: () => { if (!user) throw Object.assign(new Error('Please sign in'), { status: 401 }); return { user }; } },
    send: (res, status, data) => { res.status = status; res.data = data; return true; }, allowedOrigins: () => new Set()
  });
  t.after(() => { spotify.close(); global.fetch = originalFetch; for (const key of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
  async function request(url, method = 'GET') {
    const res = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end() {} };
    await spotify.handle({ url, method }, res, url.split('?')[0]); return res;
  }
  user = null; await assert.rejects(request('/spotify/status'), { status: 401 }); user = { id: 'alice' };
  assert.deepEqual((await request('/spotify/status')).data, { configured: false, connected: false });
  await assert.rejects(request('/spotify/connect'), { status: 503 });
  process.env.SPOTIFY_CLIENT_ID = 'mock-client'; process.env.SPOTIFY_CLIENT_SECRET = 'mock-secret'; process.env.SPOTIFY_REDIRECT_URI = REDIRECT_URI;
  global.fetch = async (url, options) => {
    requests++;
    if (url === 'https://accounts.spotify.com/api/token') {
      assert.equal(options.method, 'POST'); assert.ok(options.headers.Authorization.startsWith('Basic '));
      if (options.body.get('grant_type') === 'authorization_code') {
        assert.equal(options.body.get('redirect_uri'), REDIRECT_URI);
        return Response.json({ access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 1 });
      }
      refreshes++; assert.equal(options.body.get('refresh_token'), 'test-refresh');
      return Response.json({ access_token: 'test-refreshed', expires_in: 3600 });
    }
    assert.equal(options.headers.Authorization, 'Bearer test-refreshed');
    assert.ok(url.startsWith('https://api.spotify.com/v1/search?type=album&limit=10&q='));
    return Response.json({ albums: { items: [{ id: 'album123456', name: 'Test Album', artists: [{ name: 'Test Artist' }], images: [], total_tracks: 4 }] } });
  };
  const connect = new URL((await request('/spotify/connect')).data.url);
  assert.equal(connect.origin, 'https://accounts.spotify.com'); assert.equal(connect.searchParams.get('redirect_uri'), REDIRECT_URI);
  assert.equal(connect.searchParams.get('response_type'), 'code'); assert.ok(!connect.toString().includes('mock-secret'));
  const state = connect.searchParams.get('state'); assert.ok(state.length >= 43);
  assert.equal((await request('/spotify/callback?state=invalid&code=x')).headers.Location, '/demo/?spotify=state_error'); assert.equal(requests, 0);
  assert.equal((await request('/spotify/callback?state=' + state + '&code=test-code')).headers.Location, '/demo/?spotify=connected');
  assert.deepEqual((await request('/spotify/status')).data, { configured: true, connected: true });
  assert.equal((await request('/spotify/callback?state=' + state + '&code=replayed')).headers.Location, '/demo/?spotify=state_error');
  const found = (await request('/spotify/search?q=Test')).data;
  assert.equal(found.items[0].name, 'Test Album'); assert.equal(refreshes, 1);
  assert.ok(!JSON.stringify(found).includes('test-refreshed'));
  user = { id: 'bob' }; await assert.rejects(request('/spotify/search?q=Test'), { status: 401 });
  user = { id: 'alice' }; await request('/spotify/disconnect', 'POST');
  assert.equal((await request('/spotify/status')).data.connected, false);
  const denied = new URL((await request('/spotify/connect')).data.url).searchParams.get('state');
  assert.equal((await request('/spotify/callback?state=' + denied + '&error=access_denied')).headers.Location, '/demo/?spotify=denied');
});
