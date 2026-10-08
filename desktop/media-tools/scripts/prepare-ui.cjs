// Copy design assets; extract only the static view builder, never its demo event handlers.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),design=path.resolve(root,'../../designs/media-tools'),ui=path.join(root,'ui');fs.mkdirSync(ui,{recursive:true});
fs.cpSync(path.join(design,'assets'),path.join(ui,'assets'),{recursive:true});fs.copyFileSync(path.join(design,'media-tools.css'),path.join(ui,'media-tools.css'));
let view=fs.readFileSync(path.join(design,'media-tools.js'),'utf8').split('  const $ = id =>')[0]+'})();\n';
view=view.replace('/* UI simulation only. No fetch, upload, storage, executable, or media processing. */','/* Shared static view derived from the approved prototype. No demo controller. */');
view=view.replace('href="../../dist/index.html" aria-label="Audio Tech Labs หน้า Home ในเครื่อง"','href="download.html" aria-label="Audio Tech Labs Media Tools"');
view=view.replace('<b>PROTOTYPE</b>','<b>WINDOWS · LOCAL</b>');
view=view.replace(/<aside class="prototype-note">[\s\S]*?<\/aside>/,'<aside class="prototype-note">${icon("local")}<p><strong>ทำงานภายในเครื่องคุณ</strong> — ไฟล์และลิงก์ไม่ผ่าน Server ของ Audio Tech Labs · รุ่นทดสอบภายใน</p></aside>');
view=view.replace(/value="https:\/\/example.com\/audio\/acoustic-session"/,'value=""');
view=view.replace('ตัวอย่างลิงก์สมมติ · ไม่เชื่อมต่อกับต้นทาง','YouTube สาธารณะหนึ่งรายการ · ใช้ลิงก์ที่คุณมีสิทธิ์ดาวน์โหลด');
view=view.replace('<button id="check-link"','<button id="paste-link" class="button" type="button">วางลิงก์</button><button id="check-link"');
view=view.replace('YouTube สาธารณะหนึ่งรายการ · ใช้ลิงก์ที่คุณมีสิทธิ์ดาวน์โหลด','คัดลอกลิงก์ YouTube แล้วกดวางลิงก์ หรือ Ctrl+V / คลิกขวา → วาง · ใช้ลิงก์ที่คุณมีสิทธิ์ดาวน์โหลด');
view=view.replace('ยกเลิกการตรวจสอบจำลอง','ยกเลิกการตรวจสอบ');
view=view.replace('อ่านเฉพาะชื่อและขนาดเพื่อแสดงในต้นแบบ','อ่านข้อมูลเสียงด้วย FFprobe ภายในเครื่อง');
view=view.replace(/<button id="use-sample"[\s\S]*?<\/button>/,'');
view=view.replace(/<input id="file-input"[\s\S]*?>/,'');
view=view.replace('เก็บ codec ต้นทาง ไม่เข้ารหัสเสียงใหม่<br>ตัวอย่างนี้เป็น Opus ในไฟล์ .webm','เก็บ codec และ container ที่ดาวน์โหลดได้จริง ไม่เข้ารหัสเสียงใหม่');
view=view.replace('<span class="help">(ตัวอย่าง)</span>','');
view=view.replace('สาธิตการทำงานครั้งละหนึ่งรายการ · ไม่มีการสร้างไฟล์จริง','ทำงานครั้งละหนึ่งรายการร่วมกันทั้งสองหน้า');
view=view.replace(/<aside class="preview-controls"[\s\S]*?<\/aside>/,'<aside class="preview-controls"><div><strong>เครื่องมือในเครื่อง</strong><p id="capability-status" role="status">กำลังตรวจสอบเครื่องมือ…</p></div><button id="refresh-tools" type="button" class="button">ตรวจสอบอีกครั้ง</button></aside>');
view=view.replace('ลองใหม่ (จำลอง)','ลองใหม่').replace('ความคืบหน้าจำลอง','ความคืบหน้าของขั้นตอนปัจจุบัน').replace('<p>ผลลัพธ์ตัวอย่าง · ยังไม่มีไฟล์นี้ในเครื่อง</p>','<p>ผลลัพธ์อยู่ในเครื่อง ไม่มีวันหมดอายุและไม่ถูกลบอัตโนมัติ</p>');
view=view.replace('เมื่อพัฒนาจริง yt-dlp','yt-dlp').replace('หน้าจอนี้เตรียมสำหรับโปรแกรม Windows หรือ Local Companion เบราว์เซอร์ไม่ได้เรียก executable โดยตรง','โปรแกรม Windows นี้ใช้ native bridge ที่จำกัดคำสั่งเพื่อเรียกเครื่องมือภายในเครื่อง').replace('LOCAL FIRST / SCREEN PROTOTYPE · 01','LOCAL FIRST / WINDOWS · 0.1.0');
fs.writeFileSync(path.join(ui,'view.js'),view);
for(const page of ['download','convert']){let html=fs.readFileSync(path.join(design,page+'.html'),'utf8').replace('· ต้นแบบ','· Windows').replace('<script src="media-tools.js" defer></script>','<link rel="stylesheet" href="native.css">\n  <script src="view.js" defer></script>\n  <script src="adapters.js" defer></script>\n  <script src="controller.js" defer></script>').replace('ต้นแบบนี้ใช้ JavaScript เพื่อแสดงหน้าจอและสถานะจำลอง กรุณาเปิด JavaScript ไม่มีการประมวลผลเสียงจริง','โปรดเปิดหน้านี้ผ่านโปรแกรม Media Tools บน Windows');fs.writeFileSync(path.join(ui,page+'.html'),html);}
