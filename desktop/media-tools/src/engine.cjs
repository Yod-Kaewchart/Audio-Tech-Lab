'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {id,fail,shape,opaque,startRequest,outputName,canonicalUrl,errorDto,MediaError}=require('./common.cjs');
const {Runner,Control}=require('./runner.cjs');
const files=require('./files.cjs'),media=require('./media.cjs');
const ACTIVE=['starting','running','cancelling','cleanup-required'];
class Engine extends EventEmitter {
 constructor({deps,dataDir,audit,io={}}){super();this.deps=deps;this.dataDir=dataDir;this.runner=new Runner(deps,audit);this.io={...files,...io};this.sources=new Map();this.folders=new Map();this.requests=new Map();this.inspections=new Map();this.job=null;this.control=null;this.persistChain=Promise.resolve();this.staging=null;this.stagingIdentity=null;this.work=null;this.setupBusy=false;}
 async init(){await fs.mkdir(this.dataDir,{recursive:true});try{const saved=JSON.parse(await fs.readFile(path.join(this.dataDir,'current-job.json'),'utf8'));if(saved.job){this.job=saved.job;this.staging=saved.staging;
   if(ACTIVE.includes(this.job.status)){let remains=false;try{await fs.lstat(this.staging);remains=true;}catch{}this.job.status=remains?'cleanup-required':'interrupted';this.job.sequence++;this.job.error={code:remains?'CLEANUP_REQUIRED':'INTERRUPTED',message:remains?'งานก่อนหน้าถูกขัดจังหวะ กรุณาตรวจและนำ staging ที่เหลือออกด้วยตนเอง แล้วเปิดแอปใหม่: '+this.staging:'งานก่อนหน้าถูกขัดจังหวะ ไม่มีการเริ่มใหม่อัตโนมัติ',retryable:!remains};}}
  }catch{}return this;}
 busy(){return !!this.job&&ACTIVE.includes(this.job.status);}
 assertIdle(){if(this.busy()||this.setupBusy)fail('BUSY','มีงานปัจจุบันอยู่แล้ว กรุณารอให้เสร็จหรือหยุดครบก่อน');}
 snapshot(){return this.job?structuredClone(this.job):null;}
 persist(){const data=JSON.stringify({job:this.job,staging:this.staging},null,2);this.persistChain=this.persistChain.catch(()=>{}).then(async()=>{const p=path.join(this.dataDir,'current-job.json');await fs.writeFile(p+'.tmp',data);await fs.rename(p+'.tmp',p);});return this.persistChain;}
 update(patch={}){Object.assign(this.job,patch);this.job.sequence++;for(const entry of this.requests.values())if(entry.jobId===this.job.jobId)entry.snapshot=this.snapshot();this.emit('job',this.snapshot());this.persist().catch(()=>{});}
 stage(stage,extra={}){this.control?.check();this.update({status:'running',progress:{stage,stagePercent:null,bytesDownloaded:null,totalBytes:null,processedSeconds:null,durationSeconds:null,...extra}});}
 async capabilities(){return this.deps.capabilities();}
 async registerFile(file){
  this.assertIdle();this.setupBusy=true;let guard;
  try{
   const checked=await this.io.safePath(file,'file');guard=await this.runner.guard([checked.path]);const pinned=await this.io.safePath(file,'file');
   if(!this.io.same(checked.identity,pinned.identity))fail('STALE_SOURCE','ไฟล์เปลี่ยนระหว่างเลือก');await this.io.rejectIndirect(file);
   const {metadata}=await media.probe(this.runner,file);const source={sourceId:id(),mode:'convert',displayName:path.basename(file),metadata,validUntil:new Date(Date.now()+30*60e3).toISOString()};
   this.sources.set(source.sourceId,{dto:source,path:file,identity:pinned.identity,hash:await this.io.hash(file)});return source;
  }catch(e){if(e.code==='CLEANUP_REQUIRED')this.inspectionCleanup(e,'convert','การตรวจไฟล์');throw e;}
  finally{try{if(guard)await guard.release();}catch(e){this.inspectionCleanup(e,'convert','การตรวจไฟล์');throw e;}finally{this.setupBusy=false;}}
 }
 async registerFolder(dir){this.assertIdle();this.setupBusy=true;let guard;try{const selected=await this.io.safePath(dir,'directory');guard=await this.runner.guard([dir]);const pinned=await this.io.safePath(dir,'directory');if(!this.io.same(selected.identity,pinned.identity,true))fail('ACCESS_DENIED','โฟลเดอร์เปลี่ยนระหว่างเลือก');await this.io.writable(dir);const dto={folderId:id(),displayPath:dir,writable:true,freeBytes:await this.io.freeBytes(dir)};this.folders.set(dto.folderId,{dto,identity:pinned.identity});return dto;}finally{if(guard)await guard.release();this.setupBusy=false;}}
 async inspect(request){
  shape(request,['requestId','url']);if(!opaque(request.requestId))fail('INVALID_REQUEST','รหัสคำขอไม่ถูกต้อง');this.assertIdle();const url=canonicalUrl(request.url);
  for(const [key] of this.inspections)await this.cancelInspection({requestId:key});
  for(const [key,s] of this.sources)if(s.dto.mode==='download')this.sources.delete(key);
  const control=new Control(),entry={control,sourceId:null,done:null,finished:false};this.inspections.set(request.requestId,entry);
  entry.done=(async()=>{const node=await this.deps.verify('jsRuntime');const {stdout}=await this.runner.run('ytDlp',[...media.ytArgs(node),'--format','bestaudio','--dump-single-json','--skip-download','--',url],{control,timeout:120000});control.check();let info;try{info=JSON.parse(stdout);}catch{fail('PROBE_FAILED','ข้อมูลต้นทางไม่ถูกต้อง');}media.validateVideo(info,url);const dto={sourceId:id(),mode:'download',displayName:info.title||info.id,metadata:media.videoMetadata(info),validUntil:new Date(Date.now()+5*60e3).toISOString()};entry.sourceId=dto.sourceId;this.sources.set(dto.sourceId,{dto,url});return dto;})();
  try{return await entry.done;}catch(e){if(e.code==='CLEANUP_REQUIRED')this.inspectionCleanup(e);throw e;}finally{entry.finished=true;}
 }
 inspectionCleanup(e,mode='download',sourceName='การตรวจลิงก์'){this.job={jobId:id(),sequence:1,mode,status:'cleanup-required',sourceName,destinationDisplayPath:'',encoding:mode==='download'?{format:'original'}:{format:'mp3',bitrateKbps:192},output:null,error:errorDto(e),progress:{stage:'stopping',stagePercent:null,bytesDownloaded:null,totalBytes:null,processedSeconds:null,durationSeconds:null}};this.emit('job',this.snapshot());this.persist().catch(()=>{});}
 async cancelInspection(request){shape(request,['requestId']);if(!opaque(request.requestId))fail('INVALID_REQUEST','รหัสคำขอไม่ถูกต้อง');const entry=this.inspections.get(request.requestId);if(!entry)return {stopped:true};entry.control.cancel();if(entry.sourceId)this.sources.delete(entry.sourceId);try{await entry.done;}catch(e){if(e.code==='CLEANUP_REQUIRED'){this.inspectionCleanup(e);throw e;}}this.inspections.delete(request.requestId);return {stopped:true};}
 async start(mode,request){
  startRequest(request,mode);const previous=this.requests.get(request.requestId);if(previous){if(previous.signature!==JSON.stringify({mode,...request}))fail('INVALID_REQUEST','requestId นี้ถูกใช้กับข้อมูลอื่นแล้ว');return structuredClone(previous.snapshot);}
  this.assertIdle();for(const e of this.inspections.values())if(!e.finished&&!e.control.cancelled)fail('BUSY','กำลังตรวจลิงก์');
  const source=this.sources.get(request.sourceId),folder=this.folders.get(request.folderId);if(!source||source.dto.mode!==mode||Date.parse(source.dto.validUntil)<Date.now())fail('STALE_SOURCE','เลือกไฟล์หรือตรวจลิงก์ใหม่ ข้อมูลต้นทางหมดอายุ');if(!folder)fail('INVALID_REQUEST','กรุณาเลือกโฟลเดอร์ปลายทางใหม่');
  this.control=new Control();this.staging=null;this.job={jobId:id(),sequence:1,mode,status:'starting',progress:{stage:mode==='convert'?'probing-input':'inspecting',stagePercent:null,bytesDownloaded:null,totalBytes:null,processedSeconds:null,durationSeconds:null},sourceName:source.dto.displayName,destinationDisplayPath:folder.dto.displayPath,outputBaseName:outputName(request.outputName),encoding:structuredClone(request.encoding),output:null,error:null};
  this.requests.set(request.requestId,{signature:JSON.stringify({mode,...request}),jobId:this.job.jobId,snapshot:this.snapshot()});this.emit('job',this.snapshot());const initial=this.snapshot();
  this.work=this.execute(source,folder).catch(e=>{this.update({status:'cleanup-required',error:errorDto(new MediaError('CLEANUP_REQUIRED','ไม่สามารถปิดงานได้อย่างปลอดภัย: '+(this.staging||'ตรวจ process ในเครื่อง')))});});return initial;
 }
 async execute(source,folder){
  let guard,stagingGuard,failure=null,output=null,monitor,stageIdentity;const folderPath=folder.dto.displayPath,e=this.job.encoding,control=this.control;
  try{
   await this.persist();const caps=await this.capabilities();if(!(this.job.mode==='convert'?caps.convertReady:caps.downloadReady))fail('DEPENDENCY_MISSING','เครื่องมือไม่ครบหรือ checksum ไม่ตรง');control.check();
   guard=await this.runner.guard([folderPath,...(source.path?[source.path]:[])]);
   const f=await this.io.safePath(folderPath,'directory');if(!this.io.same(f.identity,folder.identity,true))fail('ACCESS_DENIED','โฟลเดอร์ปลายทางเปลี่ยน');
   await this.io.writable(folderPath);await this.checkSpace(folderPath,source.dto.metadata);
   this.staging=path.join(folderPath,'.atl-job-'+this.job.jobId);await fs.mkdir(this.staging);stageIdentity=(await this.io.safePath(this.staging,'directory')).identity;await this.persist();
   // Hold staging against replacement throughout all worker operations; release before removing it.
   stagingGuard=await this.runner.guard([this.staging]);
   monitor=setInterval(async()=>{try{if(await this.io.freeBytes(folderPath)<32*1024*1024){control.failure=new MediaError('NO_SPACE','พื้นที่ปลายทางเหลือน้อยเกินไป',true);control.cancel();}}catch{control.failure=new MediaError('ACCESS_DENIED','ปลายทางไม่พร้อมใช้งาน',true);control.cancel();}},1000);
   let input=source.path,meta;
   if(this.job.mode==='download'){
    this.stage('inspecting');const node=await this.deps.verify('jsRuntime');const refreshed=await this.runner.run('ytDlp',[...media.ytArgs(node),'--dump-single-json','--skip-download','--',source.url],{control});const info=JSON.parse(refreshed.stdout);media.validateVideo(info,source.url);await this.checkSpace(folderPath,media.videoMetadata(info));
    this.stage('downloading');let resultPath=null;const maxBytes=Math.max(0,(await this.io.freeBytes(folderPath))-128*1024*1024);
    await this.runner.run('ytDlp',[...media.ytArgs(node),'--no-simulate','--format','bestaudio','--fixup','never','--no-overwrites','--ffmpeg-location',this.deps.root,'--paths',this.staging,'--output','source.%(ext)s','--max-filesize',String(maxBytes),'--newline','--progress','--progress-delta','0.5','--progress-template','download:ATL_PROGRESS {"downloadedBytes":%(progress.downloaded_bytes)j,"totalBytes":%(progress.total_bytes)j}','--print','after_move:ATL_RESULT %(filepath)j','--',source.url],{control,cwd:this.staging,timeout:12*3600e3,onLine:line=>{
     if(line.startsWith('ATL_RESULT ')){try{resultPath=JSON.parse(line.slice(11));}catch{}}
     if(line.startsWith('ATL_PROGRESS ')){try{const p=JSON.parse(line.slice(13)),bytes=media.n(p.downloadedBytes),total=media.n(p.totalBytes);this.update({progress:{...this.job.progress,stagePercent:bytes&&total?Math.min(100,100*bytes/total):null,bytesDownloaded:bytes,totalBytes:total}});}catch{}}
    }});
    control.check();if(typeof resultPath!=='string'||path.dirname(path.resolve(resultPath))!==this.staging)fail('PROBE_FAILED','ไม่พบไฟล์ดาวน์โหลดใน staging');input=resultPath;await this.io.safePath(input,'file');
   }else{
    const s=await this.io.safePath(input,'file');if(!this.io.same(s.identity,source.identity)||await this.io.hash(input)!==source.hash)fail('STALE_SOURCE','ไฟล์ต้นฉบับเปลี่ยนหลังเลือก กรุณาเลือกใหม่');
   }
   this.stage('probing-input');await this.io.rejectIndirect(input);meta=(await media.probe(this.runner,input,control)).metadata;await this.checkSpace(folderPath,meta);
   let candidate=input;
   const ext=e.format==='original'?path.extname(input).slice(1):({mp3:'mp3',wav:'wav',flac:'flac',alac:'m4a'})[e.format];if(!/^[a-z0-9]{1,8}$/i.test(ext))fail('PROBE_FAILED','นามสกุลผลลัพธ์ไม่ถูกต้อง');
   if(e.format!=='original'){
    candidate=path.join(this.staging,'output.'+ext);this.stage('converting',{durationSeconds:meta.durationSeconds});
    await this.runner.run('ffmpeg',media.convertArgs(input,candidate,e),{control,cwd:this.staging,timeout:12*3600e3,onLine:line=>{if(line.startsWith('out_time_us=')){const sec=Number(line.slice(12))/1e6;if(Number.isFinite(sec)&&sec>=0)this.update({progress:{...this.job.progress,processedSeconds:sec,stagePercent:meta.durationSeconds?Math.min(100,sec/meta.durationSeconds*100):null}});}}});
   }
   this.stage('probing-output');const {metadata}=await media.probe(this.runner,candidate,control);media.validateOutput(metadata,e,meta);control.check();
   if(!guard.alive()||!stagingGuard.alive())fail('CLEANUP_REQUIRED','file guard หยุดก่อนบันทึก');
   const base=this.job.outputBaseName??(this.io.cleanName(path.parse(source.dto.displayName).name)+(this.job.mode==='convert'?' — converted':' — download'));
   // Commit boundary: cancellation is accepted before this stage; an atomic commit completes once started.
   this.stage('saving');for(let suffix=0;suffix<10000;suffix++){
    const name=base+(suffix?' ('+suffix+')':'')+'.'+ext,full=path.join(folderPath,name);
    if(await this.runner.publish(candidate,full)){output={resultId:id(),fileName:name,displayPath:full,metadata,available:true};this.job.output=output;break;}
   }
   if(!output)fail('ACCESS_DENIED','ไม่พบชื่อผลลัพธ์ที่ว่าง');
  }catch(e){failure=control.failure||e;}
  finally{
   clearInterval(monitor);
   try{if(stagingGuard)await stagingGuard.release();if(this.staging&&stageIdentity&&failure?.code!=='CLEANUP_REQUIRED'){await this.io.cleanup(this.staging,folderPath,folder.identity,stageIdentity);this.staging=null;}}catch(e){failure=new MediaError('CLEANUP_REQUIRED','หยุดแล้วแต่ cleanup ไม่ครบ กรุณาตรวจ: '+this.staging);}
   try{if(guard)await guard.release();}catch(e){failure=e;}
  }
  if(failure){const blocked=failure.code==='CLEANUP_REQUIRED';this.update({status:blocked?'cleanup-required':control.cancelled&&!control.failure?'cancelled':'failed',error:errorDto(failure),output});}
  else this.update({status:'succeeded',output,progress:{stage:'complete',stagePercent:100,bytesDownloaded:null,totalBytes:null,processedSeconds:null,durationSeconds:output.metadata.durationSeconds}});
  await this.persist();
 }
 async resetFinishedJob(){
  const done=['succeeded','failed','cancelled','interrupted'];
  if(this.setupBusy||!this.job||!done.includes(this.job.status)||[...this.inspections.values()].some(entry=>!entry.finished))fail('BUSY','เริ่มงานใหม่ได้เฉพาะงานที่หยุดหรือสิ้นสุดแล้วเท่านั้น');
  const previousId=this.job.jobId;
  this.setupBusy=true;
  try{
   // A terminal status can be emitted just before the previous job's final disk write settles.
   if(this.work)await this.work;
   if(this.job?.jobId!==previousId||!done.includes(this.job.status))fail('BUSY','สถานะงานเปลี่ยน กรุณาตรวจงานปัจจุบันอีกครั้ง');
   if(this.staging){
    try{await fs.lstat(this.staging);fail('CLEANUP_REQUIRED','พบไฟล์ชั่วคราวค้าง ต้องตรวจ cleanup ก่อนเริ่มงานใหม่');}
    catch(e){if(e.code!=='ENOENT')throw e;}
   }
   await this.persistChain;
   const stateFile=path.join(this.dataDir,'current-job.json');
   await fs.writeFile(stateFile+'.tmp',JSON.stringify({job:null,staging:null},null,2));
   await fs.rename(stateFile+'.tmp',stateFile);
   // Never touch the exported output path: only the persisted job record is reset.
   this.job=null;this.control=null;this.work=null;this.staging=null;this.stagingIdentity=null;this.requests.clear();
   this.emit('job',null);
   return {cleared:true};
  }catch(e){
   if(e.code==='BUSY'||e.code==='CLEANUP_REQUIRED')throw e;
   fail('ACCESS_DENIED','บันทึกการเริ่มงานใหม่ไม่ได้ งานเดิมยังคงอยู่ กรุณาตรวจสิทธิ์การเขียนไฟล์สถานะ');
  }finally{this.setupBusy=false;}
 }
 async checkSpace(folder,meta){const pcm=meta.durationSeconds&&meta.sampleRateHz&&meta.channels?meta.durationSeconds*meta.sampleRateHz*meta.channels*4:meta.durationSeconds?meta.durationSeconds*48000*2*4:0;const need=Math.max(meta.bytes||0,pcm)*2+128*1024*1024;if(await this.io.freeBytes(folder)<need)fail('NO_SPACE','พื้นที่ว่างไม่พอสำหรับไฟล์ชั่วคราวและผลลัพธ์ กรุณาเลือกโฟลเดอร์ใหม่',true);}
 async cancelJob(request){shape(request,['jobId']);if(!opaque(request.jobId)||request.jobId!==this.job?.jobId)fail('INVALID_REQUEST','ไม่พบงานนี้');if(!['starting','running','cancelling'].includes(this.job.status)||this.job.progress.stage==='saving')return {accepted:false};this.update({status:'cancelling',progress:{...this.job.progress,stage:'stopping',stagePercent:null}});this.control.cancel();return {accepted:true};}
 async result(request){shape(request,['resultId','target']);if(!opaque(request.resultId)||!['file','folder'].includes(request.target)||this.job?.output?.resultId!==request.resultId)fail('INVALID_REQUEST','ไม่พบผลลัพธ์นี้');const output=this.job.output;try{await this.io.safePath(output.displayPath,'file');}catch{output.available=false;this.update({output});fail('FILE_MISSING','ไฟล์ผลลัพธ์ถูกย้ายหรือลบ ไม่พบที่ตำแหน่งเดิม');}return {path:request.target==='file'?output.displayPath:path.dirname(output.displayPath),target:request.target};}
}
module.exports={Engine,ACTIVE};
