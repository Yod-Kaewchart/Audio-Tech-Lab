'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { resolveClientIp } = require('./trusted-client-ip.cjs');
const request = (peer, headers = {}) => ({ socket: { remoteAddress: peer }, headers });
test('unverified clients and loopback cannot select an IP using forwarding headers', () => {
  for (const peer of ['192.0.2.1', '2001:db8::1', '127.0.0.1', '::1']) {
    const result = resolveClientIp(request(peer, { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '203.0.113.8' }));
    assert.deepEqual(result, { address: peer, source: 'socket' });
  }
});
test('verified proxy uses only a valid CF single IP; missing or malformed values fall back', () => {
  const options = { verifiedProxy: () => true };
  assert.deepEqual(resolveClientIp(request('127.0.0.1', { 'cf-connecting-ip': '2001:DB8::2' }), options), { address: '2001:db8::2', source: 'verified-proxy' });
  assert.deepEqual(resolveClientIp(request('127.0.0.1', { 'cf-connecting-ip': '203.0.113.2' }), options), { address: '203.0.113.2', source: 'verified-proxy' });
  for (const value of ['', 'not-ip', '203.0.113.2, 192.0.2.1', undefined]) assert.deepEqual(resolveClientIp(request('127.0.0.1', { 'cf-connecting-ip': value, 'x-forwarded-for': '203.0.113.9' }), options), { address: '127.0.0.1', source: 'socket' });
});
test('mapped IPv4 is normalized and multiple clients may share the same socket address', () => {
  const a = resolveClientIp(request('::ffff:192.0.2.5')), b = resolveClientIp(request('192.0.2.5'));
  assert.deepEqual(a, b); assert.equal(a.address, '192.0.2.5');
  assert.deepEqual(resolveClientIp(request('invalid')), { address: null, source: 'unknown' });
});
