'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { execFileSync } = require('node:child_process');
test('120-minute 24-bit exports fit the 4 GB policy; DOUBLE retains its 64-bit bound', () => {
  const splitter = process.env.ATL_SPLITTER_ROOT || String.raw`D:\Projects\Audio Album Splitter AI`;
  const python = path.join(splitter, '.venv-backend/Scripts/python.exe');
  const bridge = path.resolve(__dirname, '../server/export-upload.py');
  const code = [
    'import runpy,json,sys',
    'module=runpy.run_path(sys.argv[1]); estimate=module["estimate_output_bytes"]; F=module["TargetFormat"]',
    'info={"filepath":"unused.wav","metadata_valid":True,"sample_rate":48000,"frames":345600000,"channel_count":2,"codec":"PCM_24"}',
    'result={"pcm24":estimate(info,F.WAV,1),"split":estimate(info,F.FLAC,3)}',
    'info["codec"]="DOUBLE"; result["double"]=estimate(info,F.WAV,1)',
    'try: estimate(info,F.FLAC,1)',
    'except module["ExportSource"].from_metadata.__globals__["ExportValidationError"]: result["doubleFlacRejected"]=True',
    'print(json.dumps(result))'
  ].join('\n');
  const result = JSON.parse(execFileSync(python, ['-c', code, bridge], {
    cwd: splitter, env: { ...process.env, ATL_SPLITTER_ROOT: splitter }, encoding: 'utf8', windowsHide: true
  }));
  assert.ok(result.pcm24 > 2_073_600_000 && result.pcm24 < 4_000_000_000);
  assert.ok(result.split > result.pcm24 && result.split < 4_000_000_000);
  assert.ok(result.double > 5_529_600_000 && result.double > 4_000_000_000);
  assert.equal(result.doubleFlacRejected, true);
});
