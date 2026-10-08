'use strict';
// Invoke the real installer entry point with isolated invalid payloads. Source,
// candidate bytes and receipts are preserved; no Download is performed.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),latest=path.join(root,'release/latest.json'),before=fs.readFileSync(latest),record=JSON.parse(before),out=path.join(root,'release/validation-probe-'+Date.now());
const exe=path.join(out,'Audio Tech Labs Media Tools.exe'),app=path.join(out,'resources/app'),rows=[];
fs.mkdirSync(app,{recursive:true});fs.copyFileSync(record.executable,exe);fs.cpSync(path.join(record.directory,'resources/app'),app,{recursive:true});
const candidateFile=JSON.parse(fs.readFileSync(path.join(root,'release/installers/installer-candidate.json'),'utf8')).file,{sha256}=require('../scripts/verify-payload.cjs'),candidateHash=sha256(candidateFile);
function reject(name,expected){
 fs.writeFileSync(latest,JSON.stringify({...record,directory:out,executable:exe}));
 // The nonexistent compiler is a sentinel: reaching its check would produce
 // "Missing Inno Setup compiler" rather than the expected payload error.
 const result=cp.spawnSync(process.execPath,['scripts/build-installer.cjs'],{cwd:root,env:{...process.env,INNO_ISCC:path.join(out,'COMPILER-MUST-NOT-BE-REACHED.exe')},encoding:'utf8',windowsHide:true,timeout:60000});
 assert.notEqual(result.status,0);assert.match(result.stderr,expected);assert.doesNotMatch(result.stderr,/Missing Inno Setup compiler|ISCC failed/);rows.push({name,exitCode:result.status,rejectedBeforeCompiler:true,error:result.stderr.split('\n')[0]});
}
try{
 const font=path.join(app,'ui/assets/noto-sans-thai-thai.woff2'),bytes=fs.readFileSync(font);fs.unlinkSync(font);reject('missing actual Thai WOFF2',/not synced to checked-out source: ui/);fs.writeFileSync(font,Buffer.concat([bytes,Buffer.from('CORRUPT')]));reject('corrupt actual Thai WOFF2',/not synced to checked-out source: ui/);fs.writeFileSync(font,bytes);
 fs.cpSync(path.join(record.directory,'resources/vendor'),path.join(out,'resources/vendor'),{recursive:true});fs.appendFileSync(path.join(out,'resources/vendor/ffmpeg.exe'),'CORRUPT');reject('corrupt actual FFmpeg payload',/Vendor checksum mismatch: ffmpeg.exe/);
}finally{fs.writeFileSync(latest,before);}
assert.equal(sha256(candidateFile),candidateHash);assert.deepEqual(fs.readFileSync(latest),before);
fs.writeFileSync(path.join(root,'evidence/public-beta/installer-rejection.json'),JSON.stringify({status:'PASS',installerSha256:candidateHash,portableSha256:record.sha256,candidateUnchanged:true,latestReceiptRestored:true,rows},null,2));console.log('REAL INSTALLER ENTRY POINT REJECTED INVALID PAYLOADS BEFORE COMPILER');
