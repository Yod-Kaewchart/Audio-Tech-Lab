'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Engine}=require('../src/engine.cjs'),{id,MediaError}=require('../src/common.cjs');
async function fixture(t,release,writable=async()=>{}){
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'atl-folder-recovery-'));t.after(()=>fs.rm(dataDir,{recursive:true,force:true}));
 const engine=await new Engine({deps:{},dataDir,io:{safePath:async()=>({identity:{dev:1,ino:2}}),same:()=>true,writable,freeBytes:async()=>1e9}}).init();
 engine.runner.guard=async()=>({release});return {engine,dataDir};
}
test('failed guard release shows durable recovery, clears setupBusy, withholds destination token and blocks all new work',async t=>{
 const {engine,dataDir}=await fixture(t,async()=>{throw Error('release failed');});const events=[];engine.on('job',j=>events.push(j));
 await assert.rejects(engine.registerFolder('C:\\Destination'),{code:'CLEANUP_REQUIRED'});
 assert.equal(engine.setupBusy,false);assert.equal(engine.folders.size,0);assert.equal(engine.job.status,'cleanup-required');
 assert.match(events[0].error.message,/การเลือกโฟลเดอร์ต้องกู้คืน/);assert.equal(engine.job.recovery.manualVerificationRequired,true);
 await assert.rejects(engine.registerFolder('C:\\Other'),{code:'BUSY'});await assert.rejects(engine.registerFile('C:\\input.wav'),{code:'BUSY'});
 await assert.rejects(engine.inspect({requestId:id(),url:'https://www.youtube.com/watch?v=abcdefghijk'}),{code:'BUSY'});
 for(const mode of ['download','convert'])await assert.rejects(engine.start(mode,{requestId:id(),sourceId:id(),folderId:id(),encoding:{format:'mp3',bitrateKbps:192}}),{code:'BUSY'});
 await assert.rejects(engine.resetFinishedJob(),{code:'BUSY'});
 const reopened=await new Engine({deps:{},dataDir}).init();assert.equal(reopened.job.status,'cleanup-required');assert.throws(()=>reopened.assertIdle(),{code:'BUSY'});
});
test('release failure after writable failure keeps explicit recovery rather than the earlier error',async t=>{
 const {engine}=await fixture(t,async()=>{throw Error('release');},async()=>{throw Error('write check failed');});
 await assert.rejects(engine.registerFolder('C:\\Destination'),{code:'CLEANUP_REQUIRED'});assert.equal(engine.setupBusy,false);assert.equal(engine.folders.size,0);
});
test('normal selection publishes token only after release, ordinary failure remains retryable',async t=>{
 let released=false;const {engine}=await fixture(t,async()=>{assert.equal(engine.folders.size,0);released=true;});
 const dto=await engine.registerFolder('C:\\Destination');assert.equal(released,true);assert.ok(engine.folders.has(dto.folderId));assert.equal(engine.setupBusy,false);
 const f=await fixture(t,async()=>{},async()=>{throw Error('write denied');});await assert.rejects(f.engine.registerFolder('C:\\Denied'),/write denied/);
 assert.equal(f.engine.setupBusy,false);assert.equal(f.engine.busy(),false);assert.equal(f.engine.folders.size,0);
});
test('a previous inspection cleanup cannot replace folder recovery or unlock it on restart',async t=>{
 const {engine,dataDir}=await fixture(t,async()=>{throw Error('release failed');});
 await assert.rejects(engine.registerFolder('C:\\Destination'),{code:'CLEANUP_REQUIRED'});const jobId=engine.job.jobId;
 engine.inspectionCleanup(new MediaError('CLEANUP_REQUIRED','inspection cleanup failed'));
 await engine.persistChain;assert.equal(engine.job.jobId,jobId);assert.equal(engine.job.recovery.kind,'folder-selection');assert.match(engine.job.error.message,/inspection cleanup failed/);
 const reopened=await new Engine({deps:{},dataDir}).init();assert.equal(reopened.job.status,'cleanup-required');assert.throws(()=>reopened.assertIdle(),{code:'BUSY'});
});
