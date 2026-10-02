'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function handleMerge({ req, res, user, json, send, fail, fileFor, queue, storage, runner, scripts, exportsRoot, userRoot }) {
  const data = await json(req);
  const ids = Array.isArray(data.fileIds) ? data.fileIds.map(String) : [];
  if (ids.length < 2 || ids.length > 50 || new Set(ids).size !== ids.length || ids.some(id => !UUID.test(id)))
    throw fail(400, 'Merge requires 2 to 50 unique files');
  if (!['wav', 'flac'].includes(data.format)) throw fail(400, 'Invalid merge format');
  const name = String(data.name || '').trim();
  if (!name || name.length > 140) throw fail(400, 'Invalid output name');
  if (data.requestId !== undefined && !UUID.test(String(data.requestId))) throw fail(400, 'Invalid request ID');
  const files = ids.map(id => fileFor(user, id));
  const script = path.join(scripts, 'merge-upload.py');
  const outputId = crypto.randomUUID();
  const job = queue.submit({
    owner: user.id, kind: 'merge', fileId: ids[0], fileIds: ids, outputId,
    filename: ids.length + ' tracks', requestId: data.requestId,
    signature: JSON.stringify({ route: '/merge', fileIds: ids, format: data.format, name }),
    execute: async () => {
      const reservation = storage.reserveExport(user.id);
      let stdout;
      try {
        stdout = await runner(script, [...files, userRoot(exportsRoot, user)],
          JSON.stringify({ format: data.format, name, maxOutputBytes: reservation.bytes, jobId: outputId }));
      } finally { reservation.release(); }
      let result;
      try { result = JSON.parse(stdout); } catch { throw new Error('Invalid processing response'); }
      if (!UUID.test(result.jobId) || !Array.isArray(result.files) || result.files.length !== 1)
        throw new Error('Invalid merge response');
      result.files = result.files.map(f => ({ ...f, url: '/download/' + result.jobId + '/' + encodeURIComponent(f.name) }));
      return result;
    }
  });
  return send(res, 202, job);
}
module.exports = { handleMerge };
