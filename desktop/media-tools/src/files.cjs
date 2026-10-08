const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {fail,id}=require('./common.cjs');
async function safePath(input,type){
 if(typeof input!=='string'||!path.isAbsolute(input)||input.startsWith('\\\\')||input.includes('\0')||input.slice(2).includes(':'))fail('ACCESS_DENIED','รองรับไฟล์และโฟลเดอร์ใน local drive เท่านั้น');
 const full=path.resolve(input),root=path.parse(full).root;let at=root;
 for(const part of full.slice(root.length).split(path.sep).filter(Boolean)){at=path.join(at,part);let stat;try{stat=await fs.lstat(at);}catch{fail('FILE_MISSING','ไม่พบไฟล์หรือโฟลเดอร์ที่เลือก');}if(stat.isSymbolicLink())fail('ACCESS_DENIED','ไม่รองรับ symlink หรือ junction');}
 const real=await fs.realpath(full);if(real.toLowerCase()!==full.toLowerCase())fail('ACCESS_DENIED','ตำแหน่งไฟล์เปลี่ยนหรือเป็นลิงก์');
 const s=await fs.stat(full);if(type==='file'&&!s.isFile() || type==='directory'&&!s.isDirectory())fail('ACCESS_DENIED','ชนิดตำแหน่งไม่ถูกต้อง');return {path:full,identity:identity(s),stat:s};
}
function identity(s){return {dev:s.dev,ino:s.ino,birthtimeMs:s.birthtimeMs,size:s.size,mtimeMs:s.mtimeMs};}
function same(a,b,directory=false){return ['dev','ino','birthtimeMs',...(directory?[]:['size','mtimeMs'])].every(k=>a[k]===b[k]);}
async function writable(dir){const f=path.join(dir,'.atl-write-check-'+id());let h;try{h=await fs.open(f,'wx');await h.write('test');await h.sync();}catch{fail('ACCESS_DENIED','ไม่มีสิทธิ์เขียนโฟลเดอร์นี้ กรุณาเลือกโฟลเดอร์ใหม่');}finally{if(h){await h.close();await fs.unlink(f);}}}
async function freeBytes(dir){const s=await fs.statfs(dir);return s.bavail*s.bsize;}
async function hash(file){const h=crypto.createHash('sha256');const f=await fs.open(file,'r');try{for await(const b of f.createReadStream({autoClose:false}))h.update(b);return h.digest('hex');}finally{await f.close();}}
async function rejectIndirect(file){const f=await fs.open(file,'r');try{const b=Buffer.alloc(1024);const {bytesRead}=await f.read(b,0,b.length,0);const text=b.subarray(0,bytesRead).toString('utf8').trimStart();if(/^(#EXTM3U|ffconcat|\[playlist\]|<\?xml|<MPD|<ASX|<!DOCTYPE|<html)/i.test(text))fail('UNSUPPORTED_SOURCE','ไม่รองรับ playlist, manifest หรือไฟล์อ้างอิงแหล่งอื่น');}finally{await f.close();}}
const cleanName=s=>{let n=String(s).normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,110);if(!n||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(n))n='audio-'+n;return n;};
async function cleanup(staging,folder,folderIdentity,stagingIdentity){
 // Never follow links; delete only this internally-created UUID staging and its regular children.
 const f=await safePath(folder,'directory');if(!same(f.identity,folderIdentity,true))fail('CLEANUP_REQUIRED','โฟลเดอร์ปลายทางเปลี่ยน ต้องตรวจ staging ด้วยตนเอง');
 if(path.dirname(staging)!==folder||!/^\.atl-job-[a-f0-9-]{36}$/.test(path.basename(staging)))fail('CLEANUP_REQUIRED','ตำแหน่ง staging ไม่ถูกต้อง');
 const s=await safePath(staging,'directory');if(!same(s.identity,stagingIdentity,true))fail('CLEANUP_REQUIRED','staging ถูกเปลี่ยน ต้องตรวจด้วยตนเอง');
 const entries=await fs.readdir(staging,{withFileTypes:true});for(const e of entries){if(!e.isFile()||e.isSymbolicLink())fail('CLEANUP_REQUIRED','staging มีโฟลเดอร์หรือ junction ที่ไม่คาดหมาย');}
 for(const e of entries){const p=path.join(staging,e.name);await safePath(p,'file');await fs.unlink(p);}await fs.rmdir(staging);
}
module.exports={safePath,same,writable,freeBytes,hash,rejectIndirect,cleanName,cleanup};
