'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadSpotifyConfig, REDIRECT_URI } = require('./spotify-config.cjs');
test('Spotify environment credentials are paired and production redirect is exact', () => {
  const env = { SPOTIFY_CLIENT_ID: 'test-id', SPOTIFY_CLIENT_SECRET: 'test-secret' };
  assert.equal(loadSpotifyConfig({ env, run: () => { throw new Error('Must not read store'); } }), true);
  assert.equal(env.SPOTIFY_REDIRECT_URI, REDIRECT_URI);
  assert.throws(() => loadSpotifyConfig({ env: { SPOTIFY_CLIENT_ID: 'partial' } }), /both/);
  assert.throws(() => loadSpotifyConfig({ env: { ...env, SPOTIFY_REDIRECT_URI: REDIRECT_URI + '/' } }), /must equal/);
});
test('Missing credentials leave Spotify unconfigured without affecting the demo', () => {
  assert.equal(loadSpotifyConfig({ env: {}, platform: 'win32' }), false);
  assert.equal(loadSpotifyConfig({ env: { LOCALAPPDATA: 'C:\\fake' }, platform: 'win32', exists: () => false }), false);
});
test('Fresh backend loads the encrypted store without secrets in process arguments', () => {
  for (let restart = 0; restart < 2; restart++) {
    const env = { LOCALAPPDATA: 'C:\\fake', SystemRoot: 'C:\\Windows' };
    assert.equal(loadSpotifyConfig({ env, platform: 'win32', exists: file => file.endsWith('spotify.clixml'), run: (exe, args, options) => {
      assert.ok(args.includes('-NonInteractive')); assert.equal(options.windowsHide, true);
      assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
      assert.ok(!args.join(' ').includes('b'.repeat(32)));
      return JSON.stringify({ clientId: 'a'.repeat(32), clientSecret: 'b'.repeat(32) });
    } }), true);
    assert.equal(env.SPOTIFY_CLIENT_ID, 'a'.repeat(32));
    assert.equal(env.SPOTIFY_CLIENT_SECRET, 'b'.repeat(32));
    assert.equal(env.SPOTIFY_REDIRECT_URI, REDIRECT_URI);
  }
});
test('Decryption errors and malformed stores never disclose child output or partially set credentials', () => {
  for (const run of [() => { throw new Error('sensitive-output'); }, () => 'sensitive-output', () => JSON.stringify({ clientId: 'a'.repeat(32), clientSecret: 'invalid' })]) {
    const env = { LOCALAPPDATA: 'C:\\fake' };
    assert.throws(() => loadSpotifyConfig({ env, platform: 'win32', exists: () => true, run }), error => !error.message.includes('sensitive-output') && /Cannot load/.test(error.message));
    assert.equal(env.SPOTIFY_CLIENT_ID, undefined); assert.equal(env.SPOTIFY_CLIENT_SECRET, undefined);
  }
});
