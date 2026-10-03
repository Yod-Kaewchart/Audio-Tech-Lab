'use strict';
// Apply at both the runtime endpoint and the proxy, including proxy failures.
module.exports = Object.freeze({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache',
  Expires: '0'
});
