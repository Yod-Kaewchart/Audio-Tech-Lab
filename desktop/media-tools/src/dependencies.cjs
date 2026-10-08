const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {fail}=require('./common.cjs');
class Dependencies {
 constructor(root){this.root=root;this.manifest=null;}
 async load(){this.manifest=JSON.parse(await fs.readFile(path.join(this.root,'manifest.json'),'utf8'));if(this.manifest.schema!==1)throw Error('manifest');return this;}
 async verify(name){
  const t=this.manifest?.tools[name];if(!t)fail('DEPENDENCY_MISSING','ไม่มีข้อมูลเครื่องมือ '+name);
  if(path.basename(t.file)!==t.file)fail('DEPENDENCY_INVALID','ตำแหน่งเครื่องมือไม่ถูกต้อง');
  const file=path.join(this.root,t.file);let b;try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error();b=await fs.readFile(file);}catch{fail('DEPENDENCY_MISSING','ไม่พบเครื่องมือ '+name);}
  if(!b.length || crypto.createHash('sha256').update(b).digest('hex')!==t.sha256)fail('DEPENDENCY_INVALID','Checksum ของ '+name+' ไม่ตรงกับแพ็กเกจ กรุณาใช้แพ็กเกจที่ครบถ้วน');
  return file;
 }
 async capabilities(){
  const tools={};for(const name of ['ytDlp','ffmpeg','ffprobe','jsRuntime','processHelper']){try{await this.verify(name);tools[name]={installed:true,verified:true,version:this.manifest.tools[name].version,reason:null};}catch(e){tools[name]={installed:e.code!=='DEPENDENCY_MISSING',verified:false,version:null,reason:e.message};}}
  const convertReady=['ffmpeg','ffprobe','processHelper'].every(n=>tools[n].verified),downloadReady=convertReady&&['ytDlp','jsRuntime'].every(n=>tools[n].verified);
  return {contractVersion:1,execution:'user-computer',tools,convertReady,downloadReady,downloadProviders:downloadReady?['YouTube (internal testing; live acceptance pending)']:[]};
 }
}
module.exports={Dependencies};
