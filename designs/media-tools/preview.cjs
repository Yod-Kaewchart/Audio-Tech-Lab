// Loopback-only static preview. No backend or processing endpoints.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function createServer() {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (pathname === '/') pathname = '/designs/media-tools/download.html';
    const file = path.resolve(root, '.' + pathname);
    const allowed = [path.join(root,'designs/media-tools') + path.sep, path.join(root,'dist') + path.sep];
    const type = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.ttf':'font/ttf','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)];
    if (!['GET','HEAD'].includes(req.method) || !type || !allowed.some(dir => file.startsWith(dir))) {res.writeHead(403).end();return;}
    fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(req.method === 'HEAD' ? undefined : body);});
  });
}
module.exports = {createServer};
if (require.main === module) createServer().listen(4318,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:4318/designs/media-tools/download.html'));
