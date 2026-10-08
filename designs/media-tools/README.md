# Audio Tech Labs — Media Tools prototype

ต้นแบบหน้าจอ 8 ตุลาคม 2026 ใช้เอกสาร `../YT-DLP-WIN-FFMPEG-DESIGN.md` และรูปแบบจาก `../../dist/index.html`, `../../dist/styles.css`, `../../dist/home.css` โดยให้ข้อกำหนดล่าสุดเป็นหลัก: ทำครั้งละหนึ่งรายการ ใช้ “งานปัจจุบัน” ไม่มีคิวหลายงาน

## ไฟล์

- `download.html` — Download Audio; เริ่มด้วยลิงก์และข้อมูลสมมติพร้อมทดลอง
- `convert.html` — Convert Audio; เริ่มด้วยไฟล์สมมติ และเลือกไฟล์ในเครื่องเพื่อแสดงชื่อ/ขนาดได้
- `media-tools.css` — รูปแบบร่วม, พาเลต Home ที่ปรับแล้ว, ขนาด shell/ปุ่ม/wordmark เดิม, panel radius 8px และ responsive layout
- `media-tools.js` — ส่วนหัวและ navigation ร่วม, ตัวเลือกคุณภาพ, สถานะและความคืบหน้าจำลอง
- `assets/` — DM Sans และ Noto Sans Thai จากโครงการเดิม พร้อม OFL licenses; โหลดในเครื่อง ไม่เรียก Google Fonts
- `preview.cjs` — static preview เฉพาะ loopback พอร์ต 4318 ไม่มี media API
- `verify.cjs` — ตรวจด้วย Playwright และ Chrome
- `qa/` — ภาพหน้าจอทั้งสองหน้าที่ 360 / 768 / 1440px, ภาพแผงงานแต่ละสถานะ และ `results.json`

## เปิดพรีวิว

จาก root ของโครงการ:

```powershell
node designs/media-tools/preview.cjs
```

- Download: http://127.0.0.1:4318/designs/media-tools/download.html
- Convert: http://127.0.0.1:4318/designs/media-tools/convert.html

หรือเปิดไฟล์ HTML โดยตรงในเบราว์เซอร์ รองรับ relative assets โดยไม่ต้อง build ใช้ Ctrl+C หยุด preview server

## ทดลองใช้งาน

เลือก format เพื่อแสดงเฉพาะค่าที่เกี่ยวข้อง: Original คง codec, MP3 เลือก bitrate, WAV / FLAC / ALAC เลือก sample rate และ bit depth พร้อมข้อความ lossless ตามข้อกำหนด ALAC ระบุ container M4A ชัดเจน

กดเริ่มเพื่อแสดงความคืบหน้าจำลองประมาณ 10 วินาที ก่อนแสดงผลสำเร็จ ยกเลิกและลองใหม่ได้ ตัวเลือก “ทดลองดูสถานะหน้าจอ” ใช้ดูพร้อมเริ่ม กำลังทำงาน สำเร็จ ล้มเหลว เครื่องมือไม่พร้อม และยกเลิกแล้วได้ทันที สถานะกำลังทำงานที่เลือกโดยตรงคงไว้ที่ 46% เพื่อใช้ตรวจรูปแบบ

เมื่อแก้ลิงก์ ระบบล้าง metadata เดิมและปิดเริ่มงานจนตรวจสอบจำลองใหม่ ยกเลิกตรวจสอบได้และคำตอบเก่าไม่ย้อนกลับมาเขียนทับ ขณะทำงานล็อกแหล่งเสียงและการตั้งค่า ปลายทางที่แสดงในผลลัพธ์ผูกกับงานนั้น ไม่เปลี่ยนตามการตั้งค่างานถัดไป

## ขอบเขตและข้อจำกัด

- ไม่มีการเรียก yt-dlp, FFmpeg, FFprobe หรือ executable สำหรับประมวลผลสื่อ ไม่มีการติดตั้งเครื่องมือหรือเชื่อม Local Companion
- ไม่มีการตรวจลิงก์จริง ดาวน์โหลด แปลง เลือกโฟลเดอร์จริง หรือเปิดไฟล์จริง ปุ่มเลือกโฟลเดอร์สลับเพียง path สมมติ; ปุ่มเปิดไฟล์/โฟลเดอร์แจ้งข้อจำกัด
- เลือกไฟล์จากเครื่องจริงได้ แต่ใช้เพียง `File.name` / `File.size`; ไม่อ่าน bytes, decode, upload หรือ probe ไฟล์ Metadata อื่นแสดง “ไม่ทราบ” ไม่อนุมานจากนามสกุล
- ข้อมูลเริ่มต้น ความคืบหน้า dependency status และผลลัพธ์ทั้งหมดเป็นตัวอย่าง ไม่ตรวจสถานะเครื่องจริงและไม่มีไฟล์ผลลัพธ์ถูกสร้าง
- ไม่มี fetch / API, telemetry, ประวัติถาวร, localStorage หรือการส่งต่อเข้า Web Demo; โหลด assets ภายในเครื่องเท่านั้น
- Path `C:\Users\Example\...` / `D:\Music\...` เป็นตัวอย่าง ไม่ได้อ้างว่าเป็นโฟลเดอร์ที่มีอยู่จริง
- เมื่อพัฒนาจริงให้ Windows app / Local Companion ทำงานทั้งหมดในเครื่อง ดาวน์โหลดตรงจากต้นทาง ไม่ส่งไฟล์ ลิงก์ ประวัติไป Server ของ Audio Tech Labs ไม่เขียนทับต้นฉบับ ไม่ลบผลลัพธ์อัตโนมัติ
- ไม่ได้แก้ Home หรือระบบเสียงเดิม และไม่ได้เผยแพร่เว็บไซต์

## ผลตรวจ

ตรวจด้วย Chrome ผ่าน Playwright: 2 หน้า × 3 ความกว้าง × 6 สถานะ = 36 กรณี ไม่พบ horizontal overflow หรือ JavaScript error และไม่มีคำขอเครือข่ายภายนอก ตรวจภาพเต็มหน้าทั้ง 6 ภาพเพื่อดูการตัดบรรทัดภาษาไทย

ตรวจการสลับ format, เริ่ม/ยกเลิก/ลองใหม่/สำเร็จ, ปิดเริ่มเมื่อเครื่องมือไม่พร้อม, ล็อกฟอร์มขณะทำงาน, เก็บ path ผลลัพธ์เดิม, ล้าง metadata เมื่อแก้ URL, URL ไม่ถูกต้อง, ยกเลิก/แก้ URL ระหว่างตรวจสอบ, เลือกไฟล์ชื่อไทยยาว, ไฟล์ไม่ใช่เสียง, metadata ที่ไม่ทราบ และ keyboard skip link / radio arrows / focus outline

รันตรวจซ้ำเมื่อมี `playwright` ใน Node module path:

```powershell
node designs/media-tools/verify.cjs
```

การตรวจนี้ยืนยันเฉพาะต้นแบบ UI ไม่ได้ยืนยัน provider, binary, codec, สิทธิ์เขียนไฟล์ หรือความถูกต้องของระบบประมวลผลจริง

## เตรียมเชื่อมต่อในเครื่องผู้ใช้

สำรวจและจัดทำ [แผน Local connection](connection/README.md), [สัญญา native bridge](connection/bridge-contract.d.ts), [รายการ dependency](connection/dependencies.plan.json), [แบบ argv](connection/command-plan.json) และ [เกณฑ์ตรวจรับ](connection/ACCEPTANCE.md) แล้ว ดูผลจริงและข้อจำกัดใน [รายงานเตรียมความพร้อม](connection/SURVEY.md)

ชุดนี้เป็นเอกสารและแบบสำหรับขั้นพัฒนาเท่านั้น ต้นแบบสองหน้ายังคงทำงานจำลองเดิม ยังไม่ติดตั้ง Electron/yt-dlp ไม่เปิด media API และไม่เรียกประมวลผลไฟล์จริง รอคำสั่งผู้ใช้ก่อนเริ่มเชื่อม native
