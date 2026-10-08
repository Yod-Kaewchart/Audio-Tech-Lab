'use strict';
(()=>{
 const $=id=>document.getElementById(id),suggested='Acoustic Session — Lab — download';
 const extensions={mp3:'.mp3',wav:'.wav',flac:'.flac',alac:'.m4a'};
 let folder=null,sourceReady=false;
 function sourceVideoId(value){
  let url;try{url=new URL(value.trim());}catch{return null;}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.searchParams.has('list'))return null;
  let videoId;
  if(url.hostname==='youtu.be')videoId=url.pathname.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)){
   if(url.pathname==='/watch')videoId=url.searchParams.get('v');
   else if(url.pathname.startsWith('/shorts/'))videoId=url.pathname.slice(8);
  }
  return /^[A-Za-z0-9_-]{11}$/.test(videoId||'')?videoId:null;
 }
 function inspectLink(){
  const videoId=sourceVideoId($('source-url').value);
  sourceReady=!!videoId;
  $('source-url').setAttribute('aria-invalid',String(!sourceReady));
  $('link-error').textContent=sourceReady?'รูปแบบลิงก์ถูกต้อง · ชื่อวิดีโอต่อไปนี้เป็นตัวอย่าง ไม่ได้อ่านข้อมูลจาก YouTube':'กรุณาใช้ลิงก์ HTTPS ของ YouTube แบบ watch / youtu.be / shorts หนึ่งรายการ ไม่รับ playlist';
  $('source-title').textContent=sourceReady?'Acoustic Session — Lab (ชื่อจำลอง)':'ยังไม่ได้ตรวจลิงก์';
  $('source-caption').textContent=sourceReady?'Video ID: '+videoId+' · ข้อมูลสำหรับทดลองตั้งชื่อเท่านั้น':'ตรวจรูปแบบลิงก์ให้ผ่านก่อนตั้งชื่อไฟล์';
  $('output-name').value=sourceReady?suggested:'';render();
 }
 const nameError=value=>{
  if(!value.trim())return 'กรุณาตั้งชื่อไฟล์ หรือกดใช้ชื่อต้นทาง';
  if(/[<>:"/\\|?*\x00-\x1f\x7f]/.test(value))return 'ชื่อนี้มีอักขระที่ใช้ไม่ได้: < > : " / \\ | ? *';
  if(/[. ]$/.test(value)||value==='.'||value==='..')return 'ชื่อไฟล์ต้องไม่ลงท้ายด้วยจุดหรือช่องว่าง';
  if(/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(value))return 'ชื่อนี้สงวนไว้สำหรับ Windows กรุณาใช้ชื่ออื่น';
  if(value.length>110)return 'ชื่อไฟล์ยาวเกินไป กรุณาย่อชื่อ';
  if(/\.(mp3|wav|flac|m4a|aac|ogg|opus|webm|aiff|aif|wma)$/i.test(value))return 'ใส่เฉพาะชื่อ โปรแกรมเติมนามสกุลให้เอง';
  return '';
 };
 function render(){
  const format=document.querySelector('input[name="format"]:checked')?.value,name=$('output-name').value,error=sourceReady?nameError(name):'';
  $('output-name').disabled=!sourceReady;
  $('name-help').textContent=sourceReady?'พิมพ์เฉพาะชื่อ ไม่ต้องใส่นามสกุลไฟล์':'ตรวจรูปแบบลิงก์ก่อนตั้งชื่อไฟล์';
  $('name-error').textContent=error;$('output-name').setAttribute('aria-invalid',String(!!error));$('reset-name').hidden=!sourceReady||name===suggested;
  $('extension').textContent=format?(extensions[format]||'นามสกุลตามต้นทาง'):'เลือกรูปแบบเสียง';
  $('format-note').textContent=!format?'กรุณาเลือกรูปแบบเสียง':format==='original'?'ใช้ codec และนามสกุลจากไฟล์ต้นทางจริง':format==='mp3'?'ตัวอย่างคุณภาพ 192 kbps':'ตัวอย่างคุณภาพ 16 bit · ตาม sample rate ต้นทาง';
  const display=sourceReady&&format&&!error?name+(extensions[format]||' [นามสกุลตามต้นทาง]'):null;
  $('planned-name').textContent=!sourceReady?'ตรวจรูปแบบลิงก์ก่อนตั้งชื่อไฟล์':error?'แก้ชื่อไฟล์ก่อนเริ่ม':display||'เลือกรูปแบบเสียงเพื่อดูชื่อไฟล์';
  $('planned-path').textContent=display?(folder?folder+'\\'+display:'เลือกโฟลเดอร์ปลายทางเพื่อดูตำแหน่งบันทึก'):'';
  $('folder-path').textContent=folder||'ยังไม่ได้เลือกโฟลเดอร์';
  $('start').disabled=!sourceReady||!format||!!error||!folder;
  $('start-help').textContent=!sourceReady?'กรุณาตรวจรูปแบบลิงก์ก่อน':!format?'กรุณาเลือกรูปแบบเสียงก่อนดาวน์โหลด':error?'กรุณาแก้ชื่อไฟล์ก่อนดาวน์โหลด':!folder?'กรุณาเลือกโฟลเดอร์ปลายทาง':'พร้อมทดลองปุ่มดาวน์โหลดในต้นแบบ';
  $('demo-message').textContent='';
 }
 $('output-name').addEventListener('input',render);
 $('check-link').addEventListener('click',inspectLink);
 $('source-url').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();inspectLink();}});
 $('source-url').addEventListener('input',()=>{sourceReady=false;$('source-url').removeAttribute('aria-invalid');$('link-error').textContent='';$('source-title').textContent='รอตรวจรูปแบบลิงก์';$('source-caption').textContent='ลิงก์เปลี่ยนแล้ว กรุณาตรวจใหม่ก่อนตั้งชื่อไฟล์';render();});
 $('use-sample').addEventListener('click',()=>{$('source-url').value='https://youtu.be/abcdefghijk';inspectLink();$('output-name').focus();});
 $('output-name').addEventListener('blur',()=>{$('output-name').value=$('output-name').value.trim().normalize('NFC');render();});
 document.querySelectorAll('input[name="format"]').forEach(input=>input.addEventListener('change',render));
 $('reset-name').addEventListener('click',()=>{$('output-name').value=suggested;render();$('output-name').focus();});
 $('pick-folder').addEventListener('click',()=>{folder=folder==='D:\\Music\\Audio Tech Labs'?'C:\\Users\\Example\\Downloads':'D:\\Music\\Audio Tech Labs';render();});
 $('start').addEventListener('click',()=>{if($('start').disabled)return;$('demo-message').textContent='ตัวอย่างเท่านั้น · ไม่มีการดาวน์โหลดหรือสร้างไฟล์ ชื่อที่ตั้งไว้: '+$('planned-name').textContent;});
 render();
})();
