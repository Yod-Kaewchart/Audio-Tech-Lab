'use strict';
const crypto=require('node:crypto');
class MediaError extends Error {constructor(code,message,retryable=false){super(message);this.code=code;this.retryable=retryable;}}
const fail=(code,message,retryable=false)=>{throw new MediaError(code,message,retryable);};
const id=()=>crypto.randomUUID();
const opaque=v=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
function shape(v,keys){if(!v || typeof v!=='object' || Array.isArray(v) || Object.keys(v).some(k=>!keys.includes(k)) || keys.some(k=>!(k in v)))fail('INVALID_REQUEST','คำขอไม่ถูกต้อง');}
function encoding(e,mode){
 if(!e||typeof e!=='object')fail('INVALID_REQUEST','เลือกรูปแบบเสียง');
 if(e.format==='original' && mode==='download'){shape(e,['format']);return e;}
 if(e.format==='mp3'){shape(e,['format','bitrateKbps']);if([128,192,256,320].includes(e.bitrateKbps))return e;}
 if(['wav','flac','alac'].includes(e.format)){shape(e,['format','sampleRateHz','bitsPerSample']);if(['source',44100,48000].includes(e.sampleRateHz)&&[16,24].includes(e.bitsPerSample))return e;}
 fail('INVALID_REQUEST','รูปแบบหรือคุณภาพเสียงไม่ถูกต้อง');
}
// Optional filename stem; never trust a renderer-supplied path or extension.
function outputName(value){
 if(value===undefined||value==='')return null;
 if(typeof value!=='string')fail('INVALID_REQUEST','ชื่อไฟล์ปลายทางไม่ถูกต้อง');
 const name=value.normalize('NFC').trim();
 if(!name)return null;
 if(name.length>110||/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|conin\$|conout\$)(?:\.|$)/i.test(name))fail('INVALID_REQUEST','ชื่อไฟล์ปลายทางมีอักขระหรือชื่อสงวนที่ Windows ไม่อนุญาต');
 if(/\.(?:flac|mp3|wav|m4a|aac|ogg|opus|aif|aiff|wma|webm)$/i.test(name))fail('INVALID_REQUEST','ไม่ต้องใส่นามสกุลไฟล์ โปรแกรมจะเติมให้อัตโนมัติ');
 return name;
}
function startRequest(v,mode){
 const required=['sourceId','folderId','requestId','encoding'];
 shape(v,Object.hasOwn(v,'outputName')?[...required,'outputName']:required);
 if(![v.sourceId,v.folderId,v.requestId].every(opaque))fail('INVALID_REQUEST','รหัสคำขอไม่ถูกต้อง');
 encoding(v.encoding,mode);outputName(v.outputName);
}
function canonicalUrl(value){
 if(typeof value!=='string'||value.length>2048)fail('INVALID_REQUEST','ลิงก์ไม่ถูกต้อง');let u;try{u=new URL(value);}catch{fail('INVALID_REQUEST','กรุณาใส่ลิงก์ HTTPS');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.searchParams.has('list'))fail('UNSUPPORTED_SOURCE','รองรับวิดีโอ YouTube สาธารณะหนึ่งรายการ ไม่รับ playlist');
 let video;const host=u.hostname.toLowerCase();
 if(host==='youtu.be')video=u.pathname.slice(1);
 else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)){if(u.pathname==='/watch')video=u.searchParams.get('v');else if(u.pathname.startsWith('/shorts/'))video=u.pathname.slice(8);}
 if(!/^[A-Za-z0-9_-]{11}$/.test(video||''))fail('UNSUPPORTED_SOURCE','รุ่นนี้รองรับ YouTube watch / youtu.be / shorts หนึ่งรายการเท่านั้น');
 return 'https://www.youtube.com/watch?v='+video;
}
const errorDto=e=>({code:e.code||'UNAVAILABLE',message:e.code?e.message:'ทำงานไม่สำเร็จ กรุณาตรวจไฟล์ โฟลเดอร์ และเครื่องมือในเครื่อง',retryable:!!e.retryable});
const reply=async fn=>{try{return {ok:true,value:await fn()};}catch(e){return {ok:false,error:errorDto(e)};}};
module.exports={MediaError,fail,id,opaque,shape,encoding,outputName,startRequest,canonicalUrl,errorDto,reply};
