const {fail}=require('./common.cjs');
const DEMUXERS='wav,flac,mp3,mov,matroska,webm,ogg,aac,aiff,asf';
const n=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
function metadata(json){const streams=(json.streams||[]).filter(s=>s.codec_type==='audio');if(streams.length!==1)fail('UNSUPPORTED_SOURCE','ต้องมี audio stream หนึ่งรายการ');const s=streams[0],f=json.format||{};
 return {durationSeconds:n(s.duration)||n(f.duration),bytes:n(f.size),codec:s.codec_name||null,container:f.format_name||null,sampleRateHz:n(s.sample_rate),bitsPerSample:n(s.bits_per_raw_sample)||n(s.bits_per_sample),channels:n(s.channels)};
}
async function probe(runner,file,control){const {stdout}=await runner.run('ffprobe',['-v','error','-protocol_whitelist','file','-format_whitelist',DEMUXERS,'-show_format','-show_streams','-of','json',file],{control});let raw;try{raw=JSON.parse(stdout);}catch{fail('PROBE_FAILED','ข้อมูลตรวจไฟล์ไม่ถูกต้อง');}return {metadata:metadata(raw),raw};}
function encoder(e){if(e.format==='mp3')return ['-c:a','libmp3lame','-b:a',e.bitrateKbps+'k'];if(e.format==='wav')return ['-c:a','pcm_s'+e.bitsPerSample+'le'];const args=['-c:a',e.format,'-sample_fmt',e.bitsPerSample===16?(e.format==='alac'?'s16p':'s16'):(e.format==='alac'?'s32p':'s32')];if(e.bitsPerSample===24)args.push('-bits_per_raw_sample','24');return args;}
function convertArgs(input,output,e){return ['-hide_banner','-nostdin','-n','-protocol_whitelist','file','-format_whitelist',DEMUXERS,'-i',input,'-map','0:a:0','-vn','-sn','-dn','-map_metadata','-1',...encoder(e),...(e.format!=='mp3'&&e.sampleRateHz!=='source'?['-ar',String(e.sampleRateHz)]:[]),'-progress','pipe:1','-nostats',output];}
function validateOutput(out,e,input){
 if(!out.bytes||!out.durationSeconds||!out.codec||!out.container)fail('PROBE_FAILED','ผลลัพธ์ไม่มีข้อมูลเสียงที่ตรวจสอบได้ครบ');
 const expected={mp3:['mp3','mp3'],wav:['pcm_s'+e.bitsPerSample+'le','wav'],flac:['flac','flac'],alac:['alac','mov']};
 if(e.format==='original'){if(out.codec!==input.codec||out.container!==input.container)fail('PROBE_FAILED','ข้อมูล Original Audio เปลี่ยนไป');return;}
 const [codec,container]=expected[e.format];if(out.codec!==codec||!out.container.split(',').includes(container))fail('PROBE_FAILED','Codec หรือ container ของผลลัพธ์ไม่ตรง');
 if(e.format!=='mp3' && (out.bitsPerSample!==e.bitsPerSample || out.sampleRateHz!==(e.sampleRateHz==='source'?input.sampleRateHz:e.sampleRateHz)))fail('PROBE_FAILED','Sample rate หรือ bit depth ของผลลัพธ์ไม่ตรง');
 if(input.durationSeconds&&Math.abs(out.durationSeconds-input.durationSeconds)>Math.max(.3,input.durationSeconds*.001))fail('PROBE_FAILED','ระยะเวลาไฟล์ผลลัพธ์ไม่ครบ');
}
function ytArgs(node){return ['--ignore-config','--no-config-locations','--no-plugin-dirs','--no-remote-components','--no-js-runtimes','--js-runtimes','node:'+node,'--no-update','--no-cache-dir','--no-playlist','--no-warnings','--socket-timeout','30','--retries','2','--fragment-retries','2','--proxy','','--use-extractors','youtube','--no-write-subs','--no-write-auto-subs','--no-write-thumbnail','--no-write-info-json'];}
function validateVideo(info,url){if(info._type==='playlist'||info.entries||info.is_live||info.live_status&&info.live_status!=='not_live'&&info.live_status!=='was_live'||info.has_drm||!['public',null,undefined].includes(info.availability))fail('UNSUPPORTED_SOURCE','ไม่รองรับ playlist, live, DRM หรือรายการที่ต้องล็อกอิน');if(info.id!==new URL(url).searchParams.get('v')||!info.formats?.some(f=>f.acodec&&f.acodec!=='none'&&f.vcodec==='none'&&!f.has_drm))fail('UNSUPPORTED_SOURCE','ไม่มี audio stream เดี่ยวที่รองรับ');}
function videoMetadata(info){return {durationSeconds:n(info.duration),bytes:n(info.filesize),codec:info.acodec&&info.acodec!=='none'?info.acodec:null,container:info.container||info.ext||null,sampleRateHz:n(info.asr),bitsPerSample:n(info.bits_per_sample),channels:n(info.audio_channels)};}
module.exports={probe,convertArgs,validateOutput,ytArgs,validateVideo,videoMetadata,n};
