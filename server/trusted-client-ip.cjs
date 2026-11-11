'use strict';
// Proposal only: not wired into the current production request path. A caller
// must supply independent proof of a proxy boundary, not merely a loopback IP.
const net = require('node:net');
function validIp(value) {
  if (typeof value !== 'string') return null;
  const address = value.trim();
  if (!net.isIP(address)) return null;
  return address.toLowerCase().startsWith('::ffff:') && net.isIP(address.slice(7)) === 4 ? address.slice(7) : address.toLowerCase();
}
function resolveClientIp(req, { verifiedProxy = () => false } = {}) {
  const peer = validIp(req.socket?.remoteAddress);
  if (verifiedProxy(req) === true) {
    const forwarded = validIp(req.headers?.['cf-connecting-ip']);
    if (forwarded) return { address: forwarded, source: 'verified-proxy' };
  }
  return { address: peer, source: peer ? 'socket' : 'unknown' };
}
module.exports = { resolveClientIp };
