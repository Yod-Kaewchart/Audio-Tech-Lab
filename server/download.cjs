'use strict';
const fs = require('node:fs'), path = require('node:path');
const { pipeline } = require('node:stream');
const { fail } = require('./auth.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Called only after the existing session and origin checks. No public file route.
function download(req, res, exportsRoot, user) {
  // Parse the raw path: URL normalization must not hide dot-segment traversal.
  let parts;
  try { parts = req.url.split('?')[0].slice('/download/'.length).split('/').map(decodeURIComponent); }
  catch { throw fail(400, 'Invalid download encoding'); }
  const [jobId, name] = parts;
  if (parts.length !== 2 || !UUID.test(jobId) || !name || name.startsWith('.') ||
      /[\x00-\x1f\x7f-\x9f/\\<>:"|?*]/.test(name) || /[. ]$/.test(name) ||
      !/\.(wav|flac)$/i.test(name)) throw fail(400, 'Invalid download');

  const owner = path.join(exportsRoot, user.id), directory = path.join(owner, jobId), file = path.join(directory, name);
  let fd;
  try {
    // Reject symlinks/junctions at every untrusted component, including owner/job.
    for (const dir of [owner, directory]) {
      const stat = fs.lstatSync(dir);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail(404, 'Export job not found');
    }
    const entry = fs.lstatSync(file);
    if (entry.isSymbolicLink() || !entry.isFile()) throw fail(404, 'File not found');
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw fail(404, 'File not found');
    const ascii = name.replace(/[^a-zA-Z0-9._ -]/g, '_');
    const encoded = encodeURIComponent(name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    res.writeHead(200, {
      'Content-Type': /\.flac$/i.test(name) ? 'audio/flac' : 'audio/wav',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="' + ascii + '"; filename*=UTF-8\'\'' + encoded,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') { fs.closeSync(fd); fd = undefined; res.end(); return; }
    const stream = fs.createReadStream(file, { fd, autoClose: true });
    fd = undefined; // The stream owns this descriptor, including on disconnect.
    pipeline(stream, res, () => {});
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    if (res.headersSent) { res.destroy(); return; }
    if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) throw fail(404, 'File not found');
    throw error;
  }
}
module.exports = { download };
