'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {id,startRequest}=require('../src/common.cjs');
const {Dependencies}=require('../src/dependencies.cjs'),{Engine}=require('../src/engine.cjs');
const {wave}=require('./fixtures.cjs');
test('Convert Audio custom name, collision suffix, original preservation, and blank fallback with real FFmpeg',async()=>{
 const root=path.resolve('test-output/convert-rename-'+Date.now());
 await fs.mkdir(root,{recursive:true});
 const input=path.join(root,'ต้นฉบับทดสอบ.wav');
 await wave(input,1);
 const original=await fs.readFile(input);
 const deps=await new Dependencies(path.resolve('vendor')).load();
 const engine=await new Engine({deps,dataDir:path.join(root,'state')}).init();
 const source=await engine.registerFile(input),folder=await engine.registerFolder(root);
 const enc={format:'wav',sampleRateHz:'source',bitsPerSample:16};
 async function convert(name,send=true){
  const req={sourceId:source.sourceId,folderId:folder.folderId,requestId:id(),encoding:enc};
  if(send)req.outputName=name;
  startRequest(req,'convert');
  await engine.start('convert',req);await engine.work;
  assert.equal(engine.job.status,'succeeded',JSON.stringify(engine.job.error));
  const o=engine.snapshot().output;
  assert.equal(path.dirname(o.displayPath),root);
  assert.ok((await fs.stat(o.displayPath)).size>1000);
  assert.deepEqual(await fs.readFile(input),original,'original file preserved');
  return o.fileName;
 }
 assert.equal(await convert('เพลงไทย-ทดสอบ'),'เพลงไทย-ทดสอบ.wav');
 assert.equal(await convert('เพลงไทย-ทดสอบ'),'เพลงไทย-ทดสอบ (1).wav');
 assert.equal(await convert(''),'ต้นฉบับทดสอบ — converted.wav');
 assert.equal(await convert(undefined,false),'ต้นฉบับทดสอบ — converted (1).wav');
 assert.equal(await convert('ต้นฉบับทดสอบ'),'ต้นฉบับทดสอบ (1).wav');
 const invalid=['../wrong','C:\\wrong','song.wav','song.flac','CON','abc.','bad|name','bad\u0000char','A'.repeat(111)];
 for(const name of invalid)assert.throws(()=>startRequest({sourceId:id(),folderId:id(),requestId:id(),encoding:enc,outputName:name},'convert'),{code:'INVALID_REQUEST'},name);
 console.log('CONVERT FILENAME REAL FFMPEG PASS '+root);
});
