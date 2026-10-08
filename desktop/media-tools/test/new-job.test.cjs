'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Engine}=require('../src/engine.cjs'),{id}=require('../src/common.cjs');
const finished=['succeeded','failed','cancelled','interrupted'];
async function setup(status='succeeded'){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'atl-new-job-'));
 const dataDir=path.join(root,'state');
 const output=path.join(root,'preserved audio.flac');
 await fs.writeFile(output,'KEEP_EXISTING_AUDIO_UNCHANGED');
 const engine=await new Engine({deps:{},dataDir}).init();
 engine.job={jobId:id(),sequence:4,status,mode:'download',sourceName:'Track',output:{displayPath:output,fileName:'preserved audio.flac'},progress:{stage:'complete',stagePercent:100}};
 await engine.persist();
 return {root,dataDir,output,engine,jobId:engine.job.jobId};
}
test('new job reset preserves result file and survives restart for all terminal statuses',async()=>{
 for(const status of finished){
  const {dataDir,output,engine}=await setup(status);const events=[];
  engine.on('job',job=>events.push(job));
  assert.deepEqual(await engine.resetFinishedJob(),{cleared:true});
  assert.equal(engine.snapshot(),null,status);
  assert.deepEqual(events,[null],status);
  assert.equal(await fs.readFile(output,'utf8'),'KEEP_EXISTING_AUDIO_UNCHANGED',status);
  const saved=JSON.parse(await fs.readFile(path.join(dataDir,'current-job.json'),'utf8'));
  assert.deepEqual(saved,{job:null,staging:null},status);
  assert.equal((await new Engine({deps:{},dataDir}).init()).snapshot(),null,status);
  await assert.rejects(engine.resetFinishedJob(),{code:'BUSY'});
 }
});
test('never reset active jobs or cleanup-required',async()=>{
 for(const status of ['starting','running','cancelling','cleanup-required']){
  const {dataDir,engine,jobId}=await setup(status);
  await assert.rejects(engine.resetFinishedJob(),{code:'BUSY'},status);
  assert.equal(engine.job.jobId,jobId);
  assert.equal(JSON.parse(await fs.readFile(path.join(dataDir,'current-job.json'),'utf8')).job.status,status);
 }
});
test('terminal status with remaining staging blocks reset and preserves the staged files',async()=>{
 const {root,engine}=await setup('interrupted');
 const staging=path.join(root,'.atl-job-test');
 await fs.mkdir(staging);await fs.writeFile(path.join(staging,'partial.wav'),'PARTIAL');
 engine.staging=staging;await engine.persist();
 await assert.rejects(engine.resetFinishedJob(),{code:'CLEANUP_REQUIRED'});
 assert.equal(engine.job.status,'interrupted');
 assert.equal(await fs.readFile(path.join(staging,'partial.wav'),'utf8'),'PARTIAL');
});
test('reset waits for final worker promise, blocks concurrent start, and clears atomically',async()=>{
 const {dataDir,engine}=await setup('succeeded');
 let complete;
 engine.work=new Promise(resolve=>{complete=resolve;});
 const resetting=engine.resetFinishedJob();
 assert.equal(engine.setupBusy,true);
 assert.throws(()=>engine.assertIdle(),{code:'BUSY'});
 assert.equal(engine.job.status,'succeeded');
 complete();await resetting;
 assert.equal(engine.setupBusy,false);
 assert.equal(JSON.parse(await fs.readFile(path.join(dataDir,'current-job.json'),'utf8')).job,null);
});
test('disk persistence failure keeps current job and output record intact',async()=>{
 const {engine,output}=await setup('succeeded');
 const jobId=engine.job.jobId;
 engine.persistChain=Promise.reject(new Error('simulated earlier persistence failure'));
 await assert.rejects(engine.resetFinishedJob(),{code:'ACCESS_DENIED'});
 assert.equal(engine.job.jobId,jobId);
 assert.equal(engine.setupBusy,false);
 assert.equal(await fs.readFile(output,'utf8'),'KEEP_EXISTING_AUDIO_UNCHANGED');
});
