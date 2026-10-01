'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { createAuth, fail } = require('./auth.cjs');
const { ProcessingQueue } = require('./processing-queue.cjs');
const { createProcessRunner } = require('./process-runner.cjs');
const { createStorageLimits } = require('./storage-limits.cjs');
const { download } = require('./download.cjs');
const { handleMerge } = require('./merge-handler.cjs');
const { createSpotify } = require('./spotify.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function createServer(options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  const splitter = options.splitter || String.raw`D:\Projects\Audio Album Splitter AI`;
  const python = path.join(splitter, '.venv', 'Scripts', 'python.exe');
  const security = path.join(root, 'tools', 'runtime', 'security');
  const uploads = path.join(root, 'uploads'), exports = path.join(root, 'exports');
  const auth = createAuth(security), sessions = new Map();
  let spotify;
  const runner = options.runJob || createProcessRunner({ marker: path.join(security, 'worker.json'), python, cwd: splitter, worker: path.join(options.scripts || __dirname, 'queue-worker.py'), timeout: options.workerTimeout });
  const queue = new ProcessingQueue({ file: path.join(security, 'processing-jobs.json') });
  const MAX = 2000 * 1000 * 1000, CHUNK = 8 * 1024 * 1024, RETENTION = 59 * 60 * 1000;
  for (const directory of [uploads, exports]) fs.mkdirSync(directory, { recursive: true });
  const storage = createStorageLimits({ uploads, exports, sessions, limits: options.storageLimits, freeBytes: options.freeBytes });
  const migration = path.join(security, 'owner-migration-v1.done');
  if (!fs.existsSync(migration)) {
    const ownerId = auth.ownerId();
    for (const base of [uploads, exports]) {
      const owner = path.join(base, ownerId); fs.mkdirSync(owner, { recursive: true });
      for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
        if (entry.name === ownerId) continue;
        if ((base === uploads && entry.isFile()) || (base === exports && entry.isDirectory() && UUID.test(entry.name))) fs.renameSync(path.join(base, entry.name), path.join(owner, entry.name));
      }
    }
    fs.writeFileSync(migration, new Date().toISOString());
  }
  function allowedOrigins() {
    const origins = new Set(['http://127.0.0.1:8080', 'http://localhost:8080']);
    try { const state = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'runtime', 'state.json'), 'utf8')); if (state.webUrl) origins.add(state.webUrl); } catch {}
    if (options.origin) origins.add(options.origin);
    if (process.env.ATL_DEMO_ORIGIN) origins.add(new URL(process.env.ATL_DEMO_ORIGIN).origin);
    return origins;
  }
  function send(res, code, data) {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data));
  }
  spotify = createSpotify({ auth, send, allowedOrigins, redirectUri: options.spotifyRedirectUri });
  async function body(req, limit = 1024 * 1024) {
    const parts = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > limit) throw fail(413, 'Request is too large'); parts.push(chunk); }
    return Buffer.concat(parts);
  }
  async function json(req, limit) { try { return JSON.parse((await body(req, limit)).toString('utf8') || '{}'); } catch (error) { if (error.status) throw error; throw fail(400, 'Invalid JSON request'); } }
  function userRoot(base, user) { const directory = path.join(base, user.id); fs.mkdirSync(directory, { recursive: true }); return directory; }
  function fileFor(user, id) {
    if (!UUID.test(String(id || ''))) throw fail(400, 'Invalid file ID');
    const directory = userRoot(uploads, user), matches = fs.readdirSync(directory, { withFileTypes: true }).filter(x => x.isFile() && x.name.startsWith(id + '-'));
    if (matches.length !== 1) throw fail(404, 'Uploaded file not found');
    return path.join(directory, matches[0].name);
  }
  function exportJob(user, id) {
    if (!UUID.test(String(id || ''))) throw fail(400, 'Invalid export job');
    const directory = path.join(userRoot(exports, user), id);
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) throw fail(404, 'Export job not found');
    return directory;
  }
  function cleanup() {
    const now = Date.now();
    for (const owner of fs.readdirSync(uploads, { withFileTypes: true })) {
      if (!owner.isDirectory() || !UUID.test(owner.name)) continue;
      const directory = path.join(uploads, owner.name);
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const file = path.join(directory, entry.name), id = entry.name.slice(0, 36);
        if (queue.isBusy(owner.name, id) || sessions.has(id)) continue;
        if (now - fs.statSync(file).mtimeMs >= RETENTION) fs.unlinkSync(file);
      }
    }
    for (const [id, session] of sessions) if (now - session.updated >= RETENTION) { fs.rmSync(session.file, { force: true }); sessions.delete(id); }
    for (const owner of fs.readdirSync(exports, { withFileTypes: true })) {
      if (!owner.isDirectory() || !UUID.test(owner.name)) continue;
      for (const entry of fs.readdirSync(path.join(exports, owner.name), { withFileTypes: true })) {
        if (!entry.isDirectory() || !UUID.test(entry.name)) continue;
        const directory = path.join(exports, owner.name, entry.name);
        const newest = Math.max(fs.statSync(directory).mtimeMs, ...fs.readdirSync(directory).map(name => fs.statSync(path.join(directory, name)).mtimeMs));
        if (now - newest >= RETENTION) fs.rmSync(directory, { recursive: true, force: true });
      }
    }
  }
  cleanup();
  const timer = setInterval(() => { try { cleanup(); } catch { console.error('Cleanup could not complete'); } }, 60 * 1000); timer.unref();
  const server = http.createServer(async (req, res) => {
    try {
      const rawPath = req.url.split('?')[0];
      const route = rawPath.startsWith('/download/') ? rawPath : new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && route === '/health') return send(res, 200, { ok: true, service: 'audio-tech-labs-demo', apiVersion: 1, maxMB: 2000, chunkMB: 8, authentication: true, processingConcurrency: 1 });
      if (await spotify.handle(req, res, route)) return;
      if (await auth.handle(req, res, route, json, send, allowedOrigins)) return;
      auth.originOK(req, allowedOrigins);
      const { user } = auth.requireUser(req);
      if (['GET', 'HEAD'].includes(req.method) && req.url.startsWith('/download/')) return download(req, res, exports, user);
      if (req.method === 'GET' && route === '/storage') return send(res, 200, storage.summary(user.id));
      if (req.method === 'GET' && route === '/admin/storage') {
        if (user.role !== 'admin') throw fail(403, 'Administrator access required');
        const db = JSON.parse(fs.readFileSync(path.join(security, 'users.json'), 'utf8'));
        const usernames = new Map(db.users.map(entry => [entry.id, entry.username]));
        const items = [];
        for (const owner of fs.readdirSync(uploads, { withFileTypes: true })) {
          if (!owner.isDirectory() || !UUID.test(owner.name)) continue;
          const directory = path.join(uploads, owner.name);
          for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isFile() || entry.name.endsWith('.part')) continue;
            const id = entry.name.slice(0, 36), stat = fs.statSync(path.join(directory, entry.name));
            items.push({ type: 'upload', ownerId: owner.name, username: usernames.get(owner.name) || 'unknown', id, name: entry.name.slice(37), size: stat.size, modified: stat.mtimeMs, busy: queue.isBusy(owner.name, id) });
          }
        }
        for (const owner of fs.readdirSync(exports, { withFileTypes: true })) {
          if (!owner.isDirectory() || !UUID.test(owner.name)) continue;
          const directory = path.join(exports, owner.name);
          for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isDirectory() || !UUID.test(entry.name)) continue;
            const target = path.join(directory, entry.name), files = fs.readdirSync(target, { withFileTypes: true }).filter(item => item.isFile());
            const stat = fs.statSync(target), modified = Math.max(stat.mtimeMs, ...files.map(item => fs.statSync(path.join(target, item.name)).mtimeMs));
            const size = files.reduce((total, item) => total + fs.statSync(path.join(target, item.name)).size, 0);
            items.push({ type: 'export', ownerId: owner.name, username: usernames.get(owner.name) || 'unknown', id: entry.name, name: entry.name, size, modified, busy: false });
          }
        }
        return send(res, 200, { retentionMs: RETENTION, items: items.sort((a, b) => b.modified - a.modified) });
      }
      if (req.method === 'GET' && route === '/jobs') return send(res, 200, { jobs: queue.list(user.id) });
      const jobRoute = route.match(/^\/jobs\/([0-9a-f-]{36})(\/cancel)?$/);
      if (jobRoute && req.method === 'GET' && !jobRoute[2]) return send(res, 200, queue.get(user.id, jobRoute[1]));
      if (jobRoute && req.method === 'POST' && jobRoute[2]) return send(res, 200, queue.cancel(user.id, jobRoute[1]));
      if (req.method === 'GET' && route === '/uploads') {
        const directory = userRoot(uploads, user);
        const files = fs.readdirSync(directory, { withFileTypes: true }).filter(x => x.isFile() && !x.name.endsWith('.part')).map(entry => { const stat = fs.statSync(path.join(directory, entry.name)); return { fileId: entry.name.slice(0, 36), name: entry.name.slice(37), size: stat.size, modified: stat.mtimeMs }; }).sort((a, b) => b.modified - a.modified);
        return send(res, 200, { files });
      }
      if (req.method === 'POST' && route === '/upload/init') {
        const data = await json(req), name = path.basename(String(data.name || '')).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
        if (!['.wav', '.flac', '.m4a'].includes(path.extname(name).toLowerCase())) throw fail(415, 'Unsupported file type');
        if (!Number.isSafeInteger(data.size) || data.size <= 0 || data.size > MAX) throw fail(413, 'File exceeds 2,000 MB limit');
        if ([...sessions.values()].filter(x => x.owner === user.id).length >= 4) throw fail(429, 'Too many incomplete uploads');
        storage.check(user.id, data.size);
        const id = crypto.randomUUID(), file = path.join(userRoot(uploads, user), id + '.part'); fs.writeFileSync(file, '');
        sessions.set(id, { owner: user.id, id, name, size: data.size, file, received: 0, next: 0, updated: Date.now(), writing: false });
        return send(res, 200, { uploadId: id, chunkSize: CHUNK });
      }
      if (req.method === 'POST' && route === '/upload/chunk') {
        const session = sessions.get(req.headers['x-upload-id']);
        if (!session || session.owner !== user.id) throw fail(404, 'Upload session not found');
        if (session.writing || Number(req.headers['x-chunk-index']) !== session.next) throw fail(409, 'Unexpected upload chunk');
        session.writing = true;
        try { const chunk = await body(req, CHUNK); if (session.received + chunk.length > session.size) throw fail(413, 'Upload exceeds declared size'); storage.check(user.id); fs.appendFileSync(session.file, chunk); session.received += chunk.length; session.next++; session.updated = Date.now(); return send(res, 200, { received: session.received, size: session.size }); } finally { session.writing = false; }
      }
      if (req.method === 'POST' && route === '/upload/complete') {
        const data = await json(req), session = sessions.get(data.uploadId);
        if (!session || session.owner !== user.id) throw fail(404, 'Upload session not found');
        if (session.writing || session.received !== session.size) throw fail(409, 'Upload is incomplete');
        fs.renameSync(session.file, path.join(userRoot(uploads, user), session.id + '-' + session.name)); sessions.delete(session.id);
        return send(res, 200, { ok: true, fileId: session.id, name: session.name, size: session.size });
      }
      if (req.method === 'GET' && route.startsWith('/audio/')) {
        const fileId = decodeURIComponent(route.slice(7));
        if (!UUID.test(fileId)) throw fail(400, 'Invalid file ID');
        const file = fileFor(user, fileId), stat = fs.statSync(file), ext = path.extname(file).toLowerCase();
        const type = ext === '.wav' ? 'audio/wav' : ext === '.flac' ? 'audio/flac' : ext === '.m4a' ? 'audio/mp4' : 'application/octet-stream';
        const range = req.headers.range;
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!match) { res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); return res.end(); }
          let start = match[1] ? Number(match[1]) : 0, end = match[2] ? Number(match[2]) : stat.size - 1;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= stat.size || end < start) { res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); return res.end(); }
          end = Math.min(end, stat.size - 1);
          res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          return fs.createReadStream(file, { start, end }).pipe(res);
        }
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return fs.createReadStream(file).pipe(res);
      }
      if (req.method === 'POST' && route === '/admin/storage/delete') {
        if (user.role !== 'admin') throw fail(403, 'Administrator access required');
        const data = await json(req), ownerId = String(data.ownerId || ''), id = String(data.id || ''), type = String(data.type || '');
        if (!UUID.test(ownerId) || !UUID.test(id) || !['upload', 'export'].includes(type)) throw fail(400, 'Invalid storage item');
        if (type === 'upload') {
          if (queue.isBusy(ownerId, id)) throw fail(409, 'File has a queued or running job');
          const directory = path.join(uploads, ownerId);
          const matches = fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => name.startsWith(id + '-') && !name.endsWith('.part')) : [];
          if (matches.length !== 1) throw fail(404, 'Uploaded file not found');
          fs.unlinkSync(path.join(directory, matches[0]));
        } else {
          const target = path.join(exports, ownerId, id);
          if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) throw fail(404, 'Export job not found');
          fs.rmSync(target, { recursive: true, force: true });
        }
        return send(res, 200, { ok: true, type, id });
      }
      if (req.method === 'POST' && route === '/upload/remove') {
        const data = await json(req), file = fileFor(user, data.fileId);
        if (queue.isBusy(user.id, data.fileId)) throw fail(409, 'File has a queued or running job');
        fs.unlinkSync(file); return send(res, 200, { ok: true, fileId: data.fileId });
      }
      if (req.method === 'POST' && route === '/merge') {
        return handleMerge({
          req, res, user, json, send, fail, fileFor, queue, storage, runner,
          scripts: options.scripts || __dirname,
          exportsRoot: exports, userRoot
        });
      }
      if (req.method === 'POST' && (route === '/analyze' || route === '/export')) {
        const data = await json(req), file = fileFor(user, data.fileId);
        const exporting = route === '/export';
        if (exporting && (!['wav', 'flac'].includes(data.format) || !Array.isArray(data.boundaries) || data.boundaries.length > 1000 || !data.boundaries.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0))) throw fail(400, 'Invalid export request');
        if (data.requestId !== undefined && !UUID.test(String(data.requestId))) throw fail(400, 'Invalid request ID');
        const script = path.join(options.scripts || __dirname, exporting ? 'export-upload.py' : 'analyze-upload.py');
        const args = exporting ? [file, userRoot(exports, user)] : [file];
        const job = queue.submit({ owner: user.id, kind: exporting ? 'export' : 'analyze', fileId: data.fileId, filename: path.basename(file).slice(37), requestId: data.requestId,
          signature: JSON.stringify({ route, fileId: data.fileId, format: data.format, boundaries: data.boundaries }),
          execute: async () => {
            const reservation = exporting ? storage.reserveExport(user.id) : null;
            let stdout;
            try {
              const input = exporting ? JSON.stringify({ format: data.format, boundaries: data.boundaries, maxOutputBytes: reservation.bytes }) : undefined;
              stdout = await runner(script, args, input);
            } finally { reservation?.release(); }
            let result;
            try { result = JSON.parse(stdout); } catch { throw new Error('Invalid processing response'); }
            if (exporting) {
              if (!UUID.test(result.jobId) || !Array.isArray(result.files)) throw new Error('Invalid export response');
              result.files = result.files.map(f => ({ ...f, url: '/download/' + result.jobId + '/' + encodeURIComponent(f.name) }));
            }
            return result;
          } });
        return send(res, 202, job);
      }
      if (req.method === 'POST' && route === '/export/delete') {
        const data = await json(req), directory = exportJob(user, data.jobId);
        fs.rmSync(directory, { recursive: true, force: true }); return send(res, 200, { ok: true, jobId: data.jobId });
      }
      throw fail(404, 'Not found');
    } catch (error) { send(res, error.status || 500, { error: error.status ? error.message : 'Request could not be completed' }); }
  });
  server.on('close', () => { clearInterval(timer); queue.close(); runner.close?.(); spotify.close(); auth.close(); });
  return server;
}
if (require.main === module) {
  try { require('./spotify-config.cjs').loadSpotifyConfig(); }
  catch (error) {
    delete process.env.SPOTIFY_CLIENT_ID; delete process.env.SPOTIFY_CLIENT_SECRET; delete process.env.SPOTIFY_REDIRECT_URI;
    console.error(error.message);
  }
  createServer().listen(8787, '127.0.0.1', () => console.log('Authenticated backend listening on loopback port 8787'));
}
module.exports = { createServer };
