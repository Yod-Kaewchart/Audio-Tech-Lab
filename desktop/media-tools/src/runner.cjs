const {spawn}=require('node:child_process');
const path=require('node:path');
const {MediaError}=require('./common.cjs');
// Minimal environment: no NODE_OPTIONS, proxy/config paths, PYTHONPATH, or global tool PATH.
function environment(vendor){const e={};for(const key of ['SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA'])if(process.env[key])e[key]=process.env[key];e.PATH=vendor;e.LANG='en_US.UTF-8';return e;}
class Control {
 constructor(){this.cancelled=false;this.runs=new Set();}
 cancel(){this.cancelled=true;for(const run of this.runs)run();}
 check(){if(this.cancelled)throw new MediaError('INTERRUPTED','ยกเลิกงานแล้ว');}
}
class Runner {
 constructor(deps,audit=()=>{}){this.deps=deps;this.audit=audit;}
 async run(tool,args,{control=new Control(),onLine=()=>{},timeout=120000,cwd=this.deps.root}={}){
  control.check();const exe=await this.deps.verify(tool),helper=await this.deps.verify('processHelper');control.check();
  return new Promise((resolve,reject)=>{
   const p=spawn(helper,['--run',exe,...args],{shell:false,windowsHide:true,cwd,env:environment(this.deps.root),stdio:['pipe','pipe','pipe']});
   this.audit({event:'spawn-helper',pid:p.pid,tool});let stdout='',stderr='',buffer='',ebuffer='',empty=false,overflow=false,timedout=false;
   const cancel=()=>{if(!p.stdin.destroyed)p.stdin.end('cancel\n');};control.runs.add(cancel);if(control.cancelled)cancel();
   const clock=setTimeout(()=>{timedout=true;cancel();},timeout);
   p.stdin.on('error',()=>{});
   p.stdout.setEncoding('utf8');p.stderr.setEncoding('utf8');
   p.stdout.on('data',chunk=>{stdout+=chunk;buffer+=chunk;if(stdout.length>32*1024*1024){overflow=true;cancel();stdout='';}let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);onLine(line);}});
   p.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-32768);ebuffer+=chunk;let i;while((i=ebuffer.indexOf('\n'))>=0){const line=ebuffer.slice(0,i).trim();ebuffer=ebuffer.slice(i+1);if(line.startsWith('ATL_HELPER ')){try{const m=JSON.parse(line.slice(11));if(m.treeEmpty===true)empty=true;this.audit({event:'worker',tool,...m});}catch{}}}});
   p.on('error',()=>{clearTimeout(clock);control.runs.delete(cancel);reject(new MediaError('DEPENDENCY_MISSING','เรียก process helper ไม่ได้'));});
   p.on('close',code=>{
    clearTimeout(clock);control.runs.delete(cancel);this.audit({event:'closed',tool,treeEmpty:empty,exitCode:code});
    if(!empty)return reject(new MediaError('CLEANUP_REQUIRED','ยืนยันการหยุด process tree ไม่ได้ ปิดการเริ่มงานใหม่เพื่อตรวจสอบ',false));
    if(control.cancelled)return reject(new MediaError('INTERRUPTED','ยกเลิกงานแล้ว'));
    if(timedout||overflow)return reject(new MediaError(tool==='ytDlp'?'NETWORK_FAILED':'PROBE_FAILED','เครื่องมือใช้เวลานานเกินกำหนดหรือคืนข้อมูลมากเกินไป',true));
    if(code!==0){const e=new MediaError(tool==='ytDlp'?'NETWORK_FAILED':tool==='ffmpeg'?'ENCODING_FAILED':'PROBE_FAILED',tool==='ytDlp'?'อ่านต้นทางไม่ได้: ตรวจการเชื่อมต่อและลิงก์สาธารณะ รุ่นนี้ไม่ใช้ cookies หรือการล็อกอิน':'เครื่องมืออ่านหรือแปลงเสียงไม่สำเร็จ ตรวจไฟล์และพื้นที่ปลายทาง',true);e.diagnostic=stderr;return reject(e);}
    resolve({stdout,stderr});
   });
  });
 }
 async guard(paths){
  const helper=await this.deps.verify('processHelper');
  return new Promise((resolve,reject)=>{
   const p=spawn(helper,['--guard',...paths],{windowsHide:true,shell:false,env:environment(this.deps.root),stdio:['pipe','pipe','pipe']});let ready=false,buffer='';const timer=setTimeout(()=>{p.stdin.end();reject(new MediaError('ACCESS_DENIED','ล็อกตำแหน่งไฟล์ไม่ได้'));},15000);
   const done=new Promise(r=>p.on('close',r));p.stdin.on('error',()=>{});p.stderr.resume();p.stdout.on('data',b=>{buffer+=b;if(!ready&&buffer.includes('READY')){ready=true;clearTimeout(timer);resolve({release:async()=>{p.stdin.end('release\n');const code=await done;if(code!==0)throw new MediaError('CLEANUP_REQUIRED','ปลด file guard ไม่สำเร็จ');},alive:()=>p.exitCode===null});}});
   p.on('error',()=>{clearTimeout(timer);reject(new MediaError('DEPENDENCY_MISSING','เรียก file guard ไม่ได้'));});p.on('close',()=>{clearTimeout(timer);if(!ready)reject(new MediaError('ACCESS_DENIED','ไฟล์หรือโฟลเดอร์ถูกใช้งาน เปลี่ยนตำแหน่ง หรือเป็น junction'));});
  });
 }
 async publish(from,to){
  const helper=await this.deps.verify('processHelper');
  return new Promise((resolve,reject)=>{const p=spawn(helper,['--publish',from,to],{windowsHide:true,shell:false,env:environment(this.deps.root),stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',b=>out+=b);p.stderr.resume();p.on('error',reject);p.on('close',code=>{if(code===80)resolve(false);else if(code===0&&out.includes('COMMITTED'))resolve(true);else reject(new MediaError('ACCESS_DENIED','บันทึกผลลัพธ์ไม่ได้ ไฟล์เดิมไม่ได้ถูกเขียนทับ',true));});});
 }
}
module.exports={Runner,Control,environment};
