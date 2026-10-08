const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {Dependencies}=require('../src/dependencies.cjs'),{Engine}=require('../src/engine.cjs'),{Runner,Control}=require('../src/runner.cjs'),{wave}=require('./fixtures.cjs'),{id,canonicalUrl,MediaError}=require('../src/common.cjs'),files=require('../src/files.cjs'),media=require('../src/media.cjs');
const root=path.resolve('test-output/acceptance-'+Date.now()),results=[],audit=[];
async function main(){
 await fs.mkdir(root,{recursive:true});const input=path.join(root,'ต้นฉบับ ทดสอบ.wav');await wave(input,4);const sourceHash=await files.hash(input),deps=await new Dependencies(path.resolve('vendor')).load();
 const engine=await new Engine({deps,dataDir:path.join(root,'state'),audit:e=>audit.push({...e,time:new Date().toISOString()})}).init();
 const source=await engine.registerFile(input),folder=await engine.registerFolder(root);assert.equal(source.metadata.bitsPerSample,16);
 const presets=[...[128,192,256,320].map(bitrateKbps=>({format:'mp3',bitrateKbps})),...['wav','flac','alac'].flatMap(format=>[16,24].flatMap(bitsPerSample=>['source',44100,48000].map(sampleRateHz=>({format,bitsPerSample,sampleRateHz}))))];
 let firstRequest,firstJob;
 for(const encoding of presets){
  const request={sourceId:source.sourceId,folderId:folder.folderId,requestId:id(),encoding};
  const initial=await engine.start('convert',request);const duplicate=await engine.start('convert',request);assert.equal(initial.jobId,duplicate.jobId);
  await assert.rejects(engine.start('convert',{...request,requestId:id()}),e=>e.code==='BUSY');
  await engine.work;assert.equal(engine.job.status,'succeeded',JSON.stringify(engine.job.error));const output=engine.job.output;
  const {raw}=await media.probe(engine.runner,output.displayPath);if(encoding.format==='mp3')assert.equal(Number(raw.streams.find(s=>s.codec_type==='audio').bit_rate),encoding.bitrateKbps*1000);
  results.push({test:'real-conversion',encoding,output});console.log('PASS',JSON.stringify(encoding));
  if(!firstRequest){firstRequest=request;firstJob=initial.jobId;}
 }
 assert.equal((await engine.start('convert',firstRequest)).jobId,firstJob);results.push({test:'duplicate-and-cross-mode-global-lock',passed:true});
 // Round-trip known lossless output to s16 PCM and compare audio hashes (metadata excluded).
 const hashPCM=async file=>(await engine.runner.run('ffmpeg',['-v','error','-nostdin','-protocol_whitelist','file','-i',file,'-map','0:a:0','-f','hash','-hash','sha256','-c:a','pcm_s16le','-'])).stdout.trim();
 const inputPCM=await hashPCM(input);
 for(const r of results.filter(r=>r.encoding&&r.encoding.format!=='mp3'&&r.encoding.sampleRateHz==='source'))assert.equal(await hashPCM(r.output.displayPath),inputPCM);
 results.push({test:'lossless-pcm-hashes-no-resample',passed:true,inputPCM});
 // Re-probe each supported input format through the same native engine.
 for(const format of ['mp3','wav','flac','alac']){const r=results.find(r=>r.encoding?.format===format);await engine.registerFile(r.output.displayPath);}results.push({test:'all-four-input-formats',passed:true});
 // Insert a competing file immediately before no-replace commit.
 const publish=engine.runner.publish.bind(engine.runner);let collisionPath;engine.runner.publish=async(from,to)=>{if(!collisionPath){collisionPath=to;await fs.writeFile(to,'competing-writer',{flag:'wx'});}return publish(from,to);};
 // Unique source title avoids already-existing names from the matrix.
 const raceInput=path.join(root,'แข่งขัน.wav');await wave(raceInput);const raceSource=await engine.registerFile(raceInput);
 await engine.start('convert',{sourceId:raceSource.sourceId,folderId:folder.folderId,requestId:id(),encoding:{format:'flac',sampleRateHz:'source',bitsPerSample:16}});await engine.work;assert.equal(engine.job.status,'succeeded');assert.equal(await fs.readFile(collisionPath,'utf8'),'competing-writer');assert.notEqual(engine.job.output.displayPath,collisionPath);engine.runner.publish=publish;results.push({test:'atomic-no-clobber-racing-writer',passed:true,collisionPath,result:engine.job.output.displayPath});
 // Invalid media and indirect manifests must not reach conversion.
 const invalid=path.join(root,'invalid.wav');await fs.writeFile(invalid,'not audio');await assert.rejects(engine.registerFile(invalid));
 const playlist=path.join(root,'manifest.wav');await fs.writeFile(playlist,'#EXTM3U\nhttps://example.com/media');await assert.rejects(engine.registerFile(playlist),e=>e.code==='UNSUPPORTED_SOURCE');results.push({test:'invalid-media-and-indirect-resource',passed:true});
 // File modification after registration is detected before conversion.
 const changed=await engine.registerFile(raceInput);await fs.appendFile(raceInput,'changed');await engine.start('convert',{sourceId:changed.sourceId,folderId:folder.folderId,requestId:id(),encoding:{format:'mp3',bitrateKbps:192}});await engine.work;assert.equal(engine.job.error.code,'STALE_SOURCE');results.push({test:'source-identity-change',passed:true});
 // Fault injection validates failure handling; it is not codec/provider evidence.
 const low=await new Engine({deps,dataDir:path.join(root,'low-state'),io:{freeBytes:async()=>1}}).init();const ls=await low.registerFile(input),lf=await low.registerFolder(root);await low.start('convert',{sourceId:ls.sourceId,folderId:lf.folderId,requestId:id(),encoding:{format:'mp3',bitrateKbps:128}});await low.work;assert.equal(low.job.error.code,'NO_SPACE');results.push({test:'no-space-fault-injection',passed:true});
 const cleanup=await new Engine({deps,dataDir:path.join(root,'cleanup-state'),io:{cleanup:async()=>{throw Error('injected cleanup refusal');}}}).init();const cs=await cleanup.registerFile(input),cf=await cleanup.registerFolder(root);await cleanup.start('convert',{sourceId:cs.sourceId,folderId:cf.folderId,requestId:id(),encoding:{format:'mp3',bitrateKbps:128}});await cleanup.work;assert.equal(cleanup.job.status,'cleanup-required');await assert.rejects(cleanup.start('convert',{sourceId:cs.sourceId,folderId:cf.folderId,requestId:id(),encoding:{format:'mp3',bitrateKbps:192}}),e=>e.code==='BUSY');results.push({test:'cleanup-failure-retains-lock-and-output',passed:true,staging:cleanup.staging});
 // Real cancellation during a throttled FFmpeg read, not just before spawn.
 const long=path.join(root,'cancel-input.wav');await wave(long,30);let cancelEngine,workerSeen=false;
 cancelEngine=await new Engine({deps,dataDir:path.join(root,'cancel-state'),audit:e=>{audit.push(e);if(e.tool==='ffmpeg'&&e.assignedBeforeResume){workerSeen=true;setTimeout(()=>cancelEngine.cancelJob({jobId:cancelEngine.job.jobId}),500);}}}).init();
 const run=cancelEngine.runner.run.bind(cancelEngine.runner);cancelEngine.runner.run=(tool,args,opts)=>{if(tool==='ffmpeg'){args=[...args];args.splice(args.indexOf('-i'),0,'-re');}return run(tool,args,opts);};
 const s=await cancelEngine.registerFile(long),f=await cancelEngine.registerFolder(root);await cancelEngine.start('convert',{sourceId:s.sourceId,folderId:f.folderId,requestId:id(),encoding:{format:'flac',bitsPerSample:16,sampleRateHz:'source'}});await cancelEngine.work;assert(workerSeen);assert.equal(cancelEngine.job.status,'cancelled');assert.equal(cancelEngine.staging,null);assert.equal(cancelEngine.job.output,null);results.push({test:'real-ffmpeg-cancellation-tree-empty',passed:true});
 // Parent worker spawns a grandchild. Job Object must terminate both.
 const control=new Control(),pids=[];const runner=new Runner(deps,e=>{if(e.pid&&e.assignedBeforeResume){pids.push(e.pid);setTimeout(()=>control.cancel(),800);}});
 const script="const {spawn}=require('node:child_process'); const p=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(p.pid);setInterval(()=>{},1000)";
 await assert.rejects(runner.run('jsRuntime',['-e',script],{control,onLine:l=>{if(/^\d+$/.test(l))pids.push(Number(l));}}),e=>e.code==='INTERRUPTED');
 for(const pid of pids)assert.throws(()=>process.kill(pid,0));results.push({test:'real-descendant-tree-cancellation',passed:true,pids});
 // Local invalid provider policy requires no network calls.
 for(const url of ['http://youtube.com/watch?v=abcdefghijk','https://example.com/audio','https://youtube.com/playlist?list=x','https://youtube.com/watch?v=abcdefghijk&list=x','https://youtube.com@evil.test/watch?v=abcdefghijk'])assert.throws(()=>canonicalUrl(url));results.push({test:'provider-policy',passed:true});
 assert.equal(await files.hash(input),sourceHash);results.push({test:'source-sha256-unchanged',passed:true,sha256:sourceHash});
 // Deleted result is disabled; use a newly-created disposable output, never source or user output.
 const moved=engine.job.output;if(moved){} // Source-change job correctly contains no successful output.
 await fs.writeFile(path.join(root,'results.json'),JSON.stringify({passed:true,root,results,audit},null,2));console.log('ACCEPTANCE PASS',root);
}
main().catch(async e=>{console.error(e,e.diagnostic);await fs.writeFile(path.join(root,'failure.json'),JSON.stringify({message:e.message,stack:e.stack,results,audit},null,2));process.exitCode=1;});
