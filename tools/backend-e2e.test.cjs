'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createServer } = require('../server/upload-server.js');
const project = path.resolve(__dirname, '..');
const splitter = process.env.ATL_SPLITTER_ROOT || String.raw`D:\Projects\Audio Album Splitter AI`;
const python = path.join(splitter, '.venv-backend', 'Scripts', 'python.exe');
process.env.ATL_SPLITTER_ROOT = splitter;
process.env.ATL_AUDIO_PYTHON = python;
test('Backend-only real HTTP pipeline preserves lossless PCM for WAV, FLAC and ALAC', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-backend-e2e-'));
  const fixtures = path.join(root, 'fixtures'), origin = 'http://127.0.0.1:8788';
  const helper = path.join(__dirname, 'backend-fixtures.py');
  const py = args => JSON.parse(execFileSync(python, [helper, ...args], { cwd: splitter, encoding: 'utf8', windowsHide: true, timeout: 60000 }).trim());
  const fixture = py(['create', fixtures]), reference = path.join(fixtures, 'fixture.wav');
  const report = { timestamp: new Date().toISOString(), host: os.hostname(), python, fixture, formats: [], checks: [] };
  let server, base, client;
  async function request(route, data, extra = {}) {
    const headers = { Origin: origin, ...extra.headers };
    if (client && !extra.anonymous) { headers.Cookie = client.cookie; headers['X-CSRF-Token'] = client.csrf; }
    if (data !== undefined) headers['Content-Type'] = Buffer.isBuffer(data) ? 'application/octet-stream' : 'application/json';
    const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST', headers,
      body: data === undefined ? undefined : Buffer.isBuffer(data) ? data : JSON.stringify(data),
      signal: AbortSignal.timeout(30000), redirect: 'error' });
    const result = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    return { status: response.status, data: result, cookie: response.headers.get('set-cookie') };
  }
  async function upload(file, name = path.basename(file)) {
    const bytes = fs.readFileSync(file);
    const init = await request('/upload/init', { name, size: bytes.length }); assert.equal(init.status, 200);
    let chunks = 0;
    for (let start = 0; start < bytes.length; start += 256 * 1024) {
      const chunk = bytes.subarray(start, start + 256 * 1024);
      const sent = await request('/upload/chunk', chunk, { headers: { 'X-Upload-Id': init.data.uploadId, 'X-Chunk-Index': String(chunks++) } });
      assert.equal(sent.status, 200); assert.equal(sent.data.received, start + chunk.length);
    }
    const complete = await request('/upload/complete', { uploadId: init.data.uploadId }); assert.equal(complete.status, 200);
    assert.equal(complete.data.size, bytes.length);
    return complete.data.fileId;
  }
  async function job(route, data) {
    const start = Date.now(), submitted = await request(route, { ...data, requestId: crypto.randomUUID() });
    assert.equal(submitted.status, 202);
    let state = submitted.data;
    while (['queued', 'running'].includes(state.status)) {
      if (Date.now() - start > 120000) throw new Error(route + ' timed out');
      await new Promise(resolve => setTimeout(resolve, 100));
      const polled = await request('/jobs/' + state.jobId); assert.equal(polled.status, 200); state = polled.data;
    }
    assert.equal(state.status, 'succeeded', state.error);
    return { ...state.result, elapsedMs: Date.now() - start };
  }
  async function saveDownload(url, filename) {
    const result = await request(url); assert.equal(result.status, 200); assert.ok(Buffer.isBuffer(result.data));
    const file = path.join(root, filename); fs.writeFileSync(file, result.data); return file;
  }
  const compare = files => py(['compare', reference, ...files]);
  try {
    const check = execFileSync(python, ['-c', 'import importlib.util,json; print(json.dumps({m:bool(importlib.util.find_spec(m)) for m in ("PySide6","pyqtgraph","sounddevice","pyaudio")}))'], { cwd: splitter, encoding: 'utf8', windowsHide: true });
    report.guiDependencies = JSON.parse(check);
    assert.ok(Object.values(report.guiDependencies).every(value => value === false));
    server = createServer({ root, splitter, python, scripts: path.join(project, 'server'), origin });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
    assert.equal((await request('/uploads', undefined, { anonymous: true })).status, 401);
    const password = fs.readFileSync(path.join(root, 'tools/runtime/security/first-login.txt'), 'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
    const logged = await request('/auth/login', { username: 'yod', password }); assert.equal(logged.status, 200);
    client = { cookie: logged.cookie.split(';')[0], csrf: logged.data.csrf };
    const changed = await request('/auth/password', { currentPassword: password, newPassword: crypto.randomBytes(24).toString('base64url') });
    assert.equal(changed.status, 200); client.csrf = changed.data.csrf;
    report.checks.push('isolated authentication and no GUI dependencies');
    for (const ext of ['wav', 'flac', 'm4a']) {
      await t.test(ext + ': Upload, Analyze, QC, Preview, Export and Merge', async () => {
        const summary = { format: ext, exports: [], merges: [] };
        const id = await upload(path.join(fixtures, 'fixture.' + ext));
        const analysis = await job('/analyze', { fileId: id });
        assert.equal(analysis.total_samples, fixture.frames); assert.equal(analysis.sample_rate, fixture.rate);
        assert.equal(analysis.channels, 2); assert.ok(analysis.waveform.minimum.length > 0);
        assert.ok(Array.isArray(analysis.detections));
        summary.analyzeMs = analysis.elapsedMs; summary.detections = analysis.detections.length;
        const qc = await job('/qc', { fileId: id });
        assert.equal(qc.format.sample_rate, fixture.rate); assert.equal(qc.format.channels, 2); assert.equal(qc.format.bit_depth, 24);
        assert.equal(qc.overall.sample_count, fixture.frames); assert.equal(qc.overall.nan_count, 0); assert.equal(qc.overall.inf_count, 0);
        assert.equal(qc.channels.length, 2); assert.equal(typeof qc.loudness.integrated_lufs, 'number');
        summary.qcMs = qc.elapsedMs;
        const preview = await job('/preview', { fileId: id });
        const previewFile = await saveDownload(preview.url, ext + '-preview.flac'); assert.equal(compare([previewFile]).pcmExact, true);
        const range = await request(preview.url, undefined, { headers: { Range: 'bytes=0-3' } });
        assert.equal(range.status, 206); assert.equal(range.data.toString(), 'fLaC');
        assert.equal((await request(preview.url, undefined, { anonymous: true })).status, 401);
        assert.equal((await job('/preview', { fileId: id })).cached, true);
        summary.previewMs = preview.elapsedMs;
        for (const fmt of ['wav', 'flac']) {
          for (const boundaries of [[], [4.12345, 9.33333]]) {
            const exported = await job('/export', { fileId: id, format: fmt, boundaries });
            assert.equal(exported.success, boundaries.length + 1); assert.equal(exported.failed, 0);
            const downloaded = [];
            for (const [index, file] of exported.files.entries()) downloaded.push(await saveDownload(file.url, ext + '-' + fmt + '-' + boundaries.length + '-' + index + '.' + fmt));
            assert.equal(compare(downloaded).frames, fixture.frames);
            summary.exports.push({ format: fmt, tracks: downloaded.length, pcmExact: true, elapsedMs: exported.elapsedMs });
            if (boundaries.length) {
              const fileIds = [];
              for (const file of downloaded) fileIds.push(await upload(file));
              const merged = await job('/merge', { fileIds, format: fmt, name: ext + '-roundtrip-' + fmt });
              assert.equal(merged.tracks, downloaded.length); assert.equal(merged.files.length, 1);
              const mergedFile = await saveDownload(merged.files[0].url, ext + '-merged.' + fmt);
              assert.equal(compare([mergedFile]).frames, fixture.frames);
              summary.merges.push({ format: fmt, tracks: merged.tracks, pcmExact: true, elapsedMs: merged.elapsedMs });
              for (const fileId of fileIds) assert.equal((await request('/upload/remove', { fileId })).status, 200);
            }
          }
        }
        assert.equal((await request('/upload/remove', { fileId: id })).status, 200);
        assert.equal((await request(preview.url)).status, 404);
        report.formats.push(summary);
      });
    }
    await t.test('Merge accepts mixed lossless containers and rejects invalid track counts', async () => {
      const ids = [];
      for (const ext of ['wav', 'flac', 'm4a']) ids.push(await upload(path.join(fixtures, 'fixture.' + ext)));
      assert.equal((await request('/merge', { fileIds: [ids[0]], format: 'flac', name: 'invalid' })).status, 400);
      assert.equal((await request('/merge', { fileIds: Array.from({ length: 51 }, () => crypto.randomUUID()), format: 'flac', name: 'invalid' })).status, 400);
      const merged = await job('/merge', { fileIds: ids, format: 'flac', name: 'Mixed lossless' });
      const file = await saveDownload(merged.files[0].url, 'mixed.flac');
      const proc = execFileSync(python, [helper, 'compare', file, reference, reference, reference], { cwd: splitter, encoding: 'utf8', windowsHide: true });
      assert.equal(JSON.parse(proc).frames, fixture.frames * 3);
      report.checks.push('mixed WAV/FLAC/ALAC merge exact PCM; 2-50 track guard');
    });
    await t.test('50-track merge preserves the full PCM sequence', async () => {
      const ids = [], input = path.join(fixtures, 'fixture.flac');
      for (let index = 0; index < 50; index++) ids.push(await upload(input, 'maximum-' + index + '.flac'));
      const merged = await job('/merge', { fileIds: ids, format: 'flac', name: 'Maximum 50 tracks' });
      assert.equal(merged.tracks, 50);
      const output = await saveDownload(merged.files[0].url, 'maximum.flac');
      const fingerprint = files => py(['fingerprint', ...files]);
      assert.deepEqual(fingerprint([output]), fingerprint(Array(50).fill(reference)));
      report.checks.push('50-track merge exact PCM');
    });
    assert.equal(report.formats.length, 3);
    assert.equal(report.checks.length, 3);
    report.status = 'passed';
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    report.status ||= 'failed';
    const destination = path.join(project, 'tools/runtime/backend-verification'); fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'latest.json'), JSON.stringify(report, null, 2));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
