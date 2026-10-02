'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { execFile } = require('node:child_process'), { promisify } = require('node:util');
const { pipeline } = require('node:stream/promises'), { Readable } = require('node:stream');
const { createServer } = require('../server/upload-server.js');
const execute = promisify(execFile), project = path.resolve(__dirname, '..');
const splitter = process.env.ATL_SPLITTER_ROOT || String.raw`D:\Projects\Audio Album Splitter AI`;
const python = path.join(splitter, '.venv-backend/Scripts/python.exe');
process.env.ATL_SPLITTER_ROOT = splitter; process.env.ATL_AUDIO_PYTHON = python;
const helper = path.join(__dirname, 'backend-fixtures.py');
const minutes = Number(process.argv[2]);
if (![80, 120].includes(minutes)) throw new Error('Use 80 or 120 minutes');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-backend-load-')), source = path.join(root, 'album.flac');
  const report = { minutes, host: os.hostname(), startedAt: new Date().toISOString(), stages: [] };
  const py = async args => JSON.parse((await execute(python, [helper, ...args], { cwd: splitter, windowsHide: true, timeout: 1800000 })).stdout.trim());
  let server, base, client;
  const origin = 'http://127.0.0.1:8788';
  async function request(route, data, extra = {}) {
    const headers = { Origin: origin, ...extra.headers };
    if (client) { headers.Cookie = client.cookie; headers['X-CSRF-Token'] = client.csrf; }
    if (data !== undefined) headers['Content-Type'] = Buffer.isBuffer(data) ? 'application/octet-stream' : 'application/json';
    const res = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST', headers,
      body: data === undefined ? undefined : Buffer.isBuffer(data) ? data : JSON.stringify(data), signal: AbortSignal.timeout(60000) });
    assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
    return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie') };
  }
  async function upload(file) {
    const size = fs.statSync(file).size, init = await request('/upload/init', { name: path.basename(file), size }); assert.equal(init.status, 200);
    const handle = fs.openSync(file, 'r'), buffer = Buffer.alloc(init.data.chunkSize);
    try {
      let offset = 0, index = 0;
      while (offset < size) {
        const read = fs.readSync(handle, buffer, 0, Math.min(buffer.length, size - offset), offset);
        const result = await request('/upload/chunk', buffer.subarray(0, read), { headers: { 'X-Upload-Id': init.data.uploadId, 'X-Chunk-Index': String(index++) } });
        assert.equal(result.status, 200); offset += read;
      }
    } finally { fs.closeSync(handle); }
    const result = await request('/upload/complete', { uploadId: init.data.uploadId }); assert.equal(result.status, 200); return result.data.fileId;
  }
  async function job(route, data) {
    const start = Date.now(), result = await request(route, { ...data, requestId: crypto.randomUUID() }); assert.equal(result.status, 202);
    let state = result.data;
    while (['queued', 'running'].includes(state.status)) {
      assert.ok(Date.now() - start < 1800000, 'Job timed out');
      await new Promise(resolve => setTimeout(resolve, 500));
      state = (await request('/jobs/' + state.jobId)).data;
    }
    assert.equal(state.status, 'succeeded', state.error);
    const elapsedMs = Date.now() - start; report.stages.push({ stage: route, elapsedMs }); console.log(minutes + 'm ' + route + ' passed in ' + Math.round(elapsedMs / 1000) + 's');
    return state.result;
  }
  async function download(url, file) {
    const response = await fetch(base + url, { headers: { Cookie: client.cookie }, signal: AbortSignal.timeout(300000) });
    assert.equal(response.status, 200);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(file)); return file;
  }
  try {
    console.log(minutes + 'm generating lossless 48k/24bit/stereo fixture');
    const fixture = await py(['create-long', source, String(minutes * 60)]); report.fixture = fixture;
    report.uploadBytes = fs.statSync(source).size;
    const reference = await py(['fingerprint', source]); assert.equal(reference.frames, fixture.frames);
    server = createServer({ root, splitter, python, scripts: path.join(project, 'server'), origin });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
    const password = fs.readFileSync(path.join(root, 'tools/runtime/security/first-login.txt'), 'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
    const login = await request('/auth/login', { username: 'yod', password }); assert.equal(login.status, 200);
    client = { cookie: login.cookie.split(';')[0], csrf: login.data.csrf };
    const changed = await request('/auth/password', { currentPassword: password, newPassword: crypto.randomBytes(24).toString('base64url') }); assert.equal(changed.status, 200); client.csrf = changed.data.csrf;
    const startUpload = Date.now(), id = await upload(source);
    report.stages.push({ stage: '/upload', elapsedMs: Date.now() - startUpload }); console.log(minutes + 'm upload passed');
    const analysis = await job('/analyze', { fileId: id });
    assert.equal(analysis.total_samples, fixture.frames); assert.equal(analysis.channels, 2); assert.equal(analysis.sample_rate, 48000);
    const qc = await job('/qc', { fileId: id }); assert.equal(qc.overall.sample_count, fixture.frames); assert.equal(qc.format.bit_depth, 24);
    const preview = await job('/preview', { fileId: id });
    const previewFile = await download(preview.url, path.join(root, 'preview.flac'));
    assert.deepEqual(await py(['fingerprint', previewFile]), reference);
    const exported = await job('/export', { fileId: id, format: 'wav', boundaries: [] }); assert.equal(exported.success, 1);
    const wav = await download(exported.files[0].url, path.join(root, 'export.wav'));
    report.wavBytes = fs.statSync(wav).size; assert.deepEqual(await py(['fingerprint', wav]), reference);
    const split = await job('/export', { fileId: id, format: 'flac', boundaries: [minutes * 30 + 0.12345] }); assert.equal(split.success, 2);
    const halves = [], ids = [];
    for (const [index, file] of split.files.entries()) {
      const half = await download(file.url, path.join(root, 'half-' + index + '.flac')); halves.push(half); ids.push(await upload(half));
    }
    assert.deepEqual(await py(['fingerprint', ...halves]), reference);
    const merged = await job('/merge', { fileIds: ids, format: 'flac', name: 'Long roundtrip' });
    const mergedFile = await download(merged.files[0].url, path.join(root, 'merged.flac'));
    assert.deepEqual(await py(['fingerprint', mergedFile]), reference);
    report.pcmExact = true; report.status = 'passed';
    console.log(minutes + 'm ALL STAGES PASSED; exact PCM and ' + fixture.frames + ' frames');
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    report.status ||= 'failed'; report.finishedAt = new Date().toISOString();
    const directory = path.join(project, 'tools/runtime/backend-verification'); fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'load-' + minutes + '.json'), JSON.stringify(report, null, 2));
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
