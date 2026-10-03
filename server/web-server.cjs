'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { webSecurity } = require('./web-security.cjs');
const healthHeaders = require('./health-headers.cjs');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2' };
function createWebServer({ root = path.resolve(__dirname, '..', 'dist'), backendPort = 8787, publicOrigin = process.env.ATL_DEMO_ORIGIN } = {}) {
const secureRequest = webSecurity(publicOrigin);
return http.createServer((req, res) => {
  if (!secureRequest(req, res)) return;
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    const health = req.url.split('?')[0] === '/api/health';
    if (health) for (const [name, value] of Object.entries(healthHeaders)) res.setHeader(name, value);
    const headers = { ...req.headers };
    if (health) {
      headers['cache-control'] = 'no-store, no-cache'; headers.pragma = 'no-cache';
      delete headers['if-none-match']; delete headers['if-modified-since'];
    }
    const forwarded = headers['x-forwarded-proto'];
    headers['x-forwarded-proto'] = forwarded === 'https' ? 'https' : 'http';
    const upstream = http.request({ host: '127.0.0.1', port: backendPort, path: req.url.slice(4) || '/', method: req.method, headers }, response => {
      response.on('error', () => res.destroy());
      res.on('close', () => { if (!response.complete) response.destroy(); });
      res.writeHead(response.statusCode, { ...response.headers, ...(health ? healthHeaders : {}) }); response.pipe(res);
    });
    let healthTimedOut = false;
    const healthDeadline = health ? setTimeout(() => { healthTimedOut = true; upstream.destroy(new Error('Backend health timeout')); }, 4000) : null;
    res.on('close', () => clearTimeout(healthDeadline));
    upstream.on('error', () => { if (!res.headersSent) { res.writeHead(healthTimedOut ? 504 : 502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Backend is restarting. Please retry' })); } else res.destroy(); });
    upstream.setTimeout(120000, () => upstream.destroy(new Error('Backend timeout')));
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream); return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (urlPath.includes('\\') || urlPath.includes('\0') || urlPath.split('/').some(x => x.startsWith('.'))) throw new Error('Invalid path');
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.resolve(root, '.' + urlPath);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    const stat = fs.statSync(file);
    if (stat.isDirectory()) { res.writeHead(302, { Location: urlPath + '/' }); res.end(); return; }
    const contentType = mime[path.extname(file).toLowerCase()];
    if (!stat.isFile() || !contentType) throw new Error('Not found');
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stat.size });
    if (req.method === 'HEAD') res.end(); else { const stream = fs.createReadStream(file); stream.on('error', () => res.destroy()); stream.pipe(res); }
  } catch { res.writeHead(404); res.end('Not found'); }
});
}
if (require.main === module) createWebServer().listen(8080, '127.0.0.1', () => console.log('Web Demo listening on loopback port 8080'));
module.exports = { createWebServer };
