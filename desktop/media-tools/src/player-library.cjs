'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Readable}=require('node:stream');
const {id,fail,opaque}=require('./common.cjs');
const files=require('./files.cjs'),media=require('./media.cjs');
const {Control}=require('./runner.cjs');
const EXTENSIONS=new Set(['wav','flac','mp3','m4a','aac','ogg','opus','aiff','aif','wma','webm']);
const LIMIT=500;
function mime(metadata){
 const c=metadata.container?.split(',')||[],codec=metadata.codec;
 if(c.includes('wav'))return 'audio/wav';if(c.includes('flac'))return 'audio/flac';if(c.includes('mp3'))return 'audio/mpeg';
 if(c.includes('ogg'))return codec?`audio/ogg; codecs="${codec}"`:'audio/ogg';
 if(c.includes('mov'))return 'audio/mp4';
 if(c.includes('aac'))return 'audio/aac';if(c.includes('webm')||c.includes('matroska'))return `audio/webm; codecs="${codec}"`;
 return null;
}
function tags(raw){const stream=raw.streams.find(s=>s.codec_type==='audio');const result={};for(const source of [raw.format?.tags,stream?.tags])for(const [k,v] of Object.entries(source||{}))if(typeof v==='string')result[k.toLowerCase()]=v.slice(0,1000);return result;}
function range(header,size){
 if(!header)return {start:0,end:size-1,status:200};
 const match=/^bytes=(\d*)-(\d*)$/.exec(header);if(!match||(!match[1]&&!match[2]))return null;
 let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]&&match[2]?Number(match[2]):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null;
 return {start,end:Math.min(end,size-1),status:206};
}
class PlayerLibrary {
 constructor(runner){this.runner=runner;this.entries=new Map();this.order=[];this.generation=0;this.control=null;this.loading=false;this.done=null;this.streams=new Set();}
 snapshot(){return this.order.map(key=>this.entries.get(key).dto);}
 async candidates(inputs,control){
  const result=[],errors=[];let visited=0;
  const visit=async(file,fromFolder=false)=>{
   control.check();if(++visited>10000||result.length>=LIMIT){if(!errors.length)errors.push('เพิ่มได้สูงสุด 500 เพลงต่อครั้ง');return;}
   try{const checked=await files.safePath(file),stat=checked.stat;
    if(stat.isDirectory()){for(const name of (await fs.readdir(checked.path)).sort())await visit(path.join(checked.path,name),true);}
    else if(stat.isFile()&&(!fromFolder||EXTENSIONS.has(path.extname(file).slice(1).toLowerCase())))result.push(file);
   }catch(e){if(control.cancelled)throw e;errors.push(path.basename(file)+': '+(e.message||'อ่านไม่ได้'));}
  };
  for(const input of inputs)await visit(input);return {result,errors};
 }
 async add(inputs){
  if(this.loading)fail('BUSY','กำลังเพิ่มเพลง กรุณารอสักครู่');
  if(!Array.isArray(inputs)||inputs.length>LIMIT||inputs.some(p=>typeof p!=='string'))fail('INVALID_REQUEST','รายการไฟล์ไม่ถูกต้อง');
  const generation=this.generation,control=new Control();this.control=control;this.loading=true;
  let finish;const done=new Promise(resolve=>{finish=resolve;});this.done=done;
  try{
   const {result,errors}=await this.candidates(inputs,control);
   for(const file of result){
    control.check();if(this.entries.size>=LIMIT){errors.push('Playlist เพิ่มได้สูงสุด 500 เพลง');break;}
    let guard;
    try{
     const checked=await files.safePath(file,'file');await files.rejectIndirect(checked.path);
     if([...this.entries.values()].some(e=>e.path.toLowerCase()===checked.path.toLowerCase()))continue;
     guard=await this.runner.guard([checked.path]);control.check();
     const {metadata,raw}=await media.probe(this.runner,checked.path,control);control.check();
     const pinned=await files.safePath(checked.path,'file');if(!files.same(pinned.identity,checked.identity))fail('STALE_SOURCE','ไฟล์เปลี่ยนระหว่างอ่าน');
     const trackId=id(),tag=tags(raw),artwork=await this.artwork(checked.path,raw,control);control.check();
     const dto={trackId,fileName:path.basename(file),title:tag.title||path.basename(file),artist:tag.artist||null,album:tag.album||null,metadata,mimeType:mime(metadata),mediaUrl:`atl-media://app/media/${trackId}`,artworkUrl:artwork?`atl-media://app/artwork/${trackId}`:null};
     if(generation===this.generation){this.entries.set(trackId,{path:checked.path,identity:checked.identity,dto,artwork});this.order.push(trackId);}
    }catch(e){if(control.cancelled)throw e;errors.push(path.basename(file)+': '+(e.code==='PROBE_FAILED'?'อ่านเสียงไม่ได้ ไฟล์อาจเสียหรือเป็นรูปแบบที่ไม่รองรับ':e.message));}
    finally{if(guard)await guard.release();}
   }
   return {tracks:this.snapshot(),errors};
  }finally{if(this.control===control){this.control=null;this.loading=false;}finish();if(this.done===done)this.done=null;}
 }
 async artwork(file,raw,control){
  const picture=raw.streams.find(s=>s.codec_type==='video'&&s.disposition?.attached_pic===1);if(!picture)return null;
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atl-player-art-')),out=path.join(dir,'cover.png');
  try{await this.runner.run('ffmpeg',['-v','error','-nostdin','-protocol_whitelist','file','-format_whitelist','wav,flac,mp3,mov,matroska,webm,ogg,aac,aiff,asf','-i',file,'-map',`0:${picture.index}`,'-frames:v','1','-vf','scale=600:600:force_original_aspect_ratio=decrease','-an',out],{control,timeout:15000});const stat=await fs.stat(out);return stat.size<=4*1024*1024?await fs.readFile(out):null;}
  catch(e){if(control.cancelled)throw e;return null;}
  finally{await fs.rm(dir,{recursive:true,force:true});}
 }
 remove(trackId){if(!opaque(trackId))fail('INVALID_REQUEST','รหัสเพลงไม่ถูกต้อง');this.entries.delete(trackId);this.order=this.order.filter(key=>key!==trackId);for(const stream of this.streams)if(stream.trackId===trackId)stream.destroy();return this.snapshot();}
 reorder(order){if(!Array.isArray(order)||order.length!==this.order.length||new Set(order).size!==order.length||order.some(key=>!this.entries.has(key)))fail('INVALID_REQUEST','ลำดับเพลงไม่ถูกต้อง');this.order=[...order];return this.snapshot();}
 async reset(){this.generation++;const done=this.done;this.control?.cancel();this.entries.clear();this.order=[];for(const stream of this.streams)stream.destroy();if(done)await done;return this.snapshot();}
 async response(request,kind,trackId){
  const entry=this.entries.get(trackId);if(!opaque(trackId)||!entry)return new Response('',{status:404});
  if(kind==='artwork')return entry.artwork?new Response(entry.artwork,{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}}):new Response('',{status:404});
  let handle;
  try{const current=await files.safePath(entry.path,'file');if(!files.same(current.identity,entry.identity))return new Response('',{status:410});
   handle=await fs.open(current.path,'r');const stat=await handle.stat();if(!files.same({dev:stat.dev,ino:stat.ino,birthtimeMs:stat.birthtimeMs,size:stat.size,mtimeMs:stat.mtimeMs},entry.identity)){await handle.close();return new Response('',{status:410});}
   if(this.entries.get(trackId)!==entry){await handle.close();return new Response('',{status:404});}
   const part=range(request.headers.get('range'),stat.size);if(!part){await handle.close();return new Response('',{status:416,headers:{'Content-Range':`bytes */${stat.size}`}});}
   const stream=handle.createReadStream({start:part.start,end:part.end,autoClose:true});stream.trackId=trackId;this.streams.add(stream);stream.on('close',()=>this.streams.delete(stream));
   const headers={'Content-Type':entry.dto.mimeType||'application/octet-stream','Content-Length':String(part.end-part.start+1),'Accept-Ranges':'bytes','Cache-Control':'no-store'};
   if(part.status===206)headers['Content-Range']=`bytes ${part.start}-${part.end}/${stat.size}`;
   return new Response(Readable.toWeb(stream),{status:part.status,headers});
  }catch{if(handle)await handle.close().catch(()=>{});return new Response('',{status:410});}
 }
}
module.exports={PlayerLibrary,mime,tags,range};
