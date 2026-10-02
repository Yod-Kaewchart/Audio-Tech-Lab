'use strict';
const { demoOrigin } = require('../tools/deployment-config.cjs');
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https://i.scdn.co https://mosaic.scdn.co",
  "media-src 'self' blob:", "connect-src 'self'", "object-src 'none'", "base-uri 'self'",
  "form-action 'self'", "frame-ancestors 'none'"
].join('; ');
const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
function webSecurity(publicOrigin) {
  const origin = demoOrigin(publicOrigin);
  const publicHost = origin && new URL(origin).host;
  return (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Content-Security-Policy', CSP);
    const host = String(req.headers.host || '').toLowerCase();
    const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host);
    const local = localHost && loopback(req.socket.remoteAddress);
    if (!local && (!publicHost || host !== publicHost)) {
      res.writeHead(421); res.end('Unrecognized host'); return false;
    }
    // Only a local Tunnel/proxy may supply the forwarded protocol.
    const secure = !!req.socket.encrypted || (loopback(req.socket.remoteAddress) && req.headers['x-forwarded-proto'] === 'https');
    if (!local && !secure) {
      if (['GET', 'HEAD'].includes(req.method) && req.url.startsWith('/') && !req.url.startsWith('//') && !req.url.includes('\\')) {
        res.writeHead(308, { Location: origin + req.url }); res.end();
      } else { res.writeHead(403); res.end('HTTPS required'); }
      return false;
    }
    // Start with a short, host-only policy; do not include unrelated subdomains.
    if (!local && secure) res.setHeader('Strict-Transport-Security', 'max-age=86400');
    return true;
  };
}
module.exports = { webSecurity };
