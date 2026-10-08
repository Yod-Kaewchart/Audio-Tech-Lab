# Audio Tech Labs Media Tools — Windows portable 0.1.1

รุ่นทดสอบภายใน Windows x64 · 8 ตุลาคม 2026 · ยังไม่เผยแพร่

## เปิดใช้งาน

1. แตก ZIP ทั้งโฟลเดอร์ไปยัง local drive ที่เขียนได้ อย่าย้ายเฉพาะ executable ออกมาจาก `resources` และไฟล์อื่น
2. เปิด `Audio Tech Labs Media Tools.exe` ไม่ต้องติดตั้ง Node, FFmpeg หรือ yt-dlp เพิ่มในเครื่อง
3. รอรายการเครื่องมือในเครื่องตรวจ checksum หากมีไฟล์ขาดหรือ hash ไม่ตรง ปุ่มเริ่มงานจะปิดพร้อมเหตุผล
4. Convert Audio: เลือกไฟล์ด้วยหน้าต่าง Windows → เลือกรูปแบบ/คุณภาพ → เลือกโฟลเดอร์ → เริ่มแปลงไฟล์
5. Download Audio: คัดลอกลิงก์ YouTube สาธารณะหนึ่งรายการที่มีสิทธิ์ดาวน์โหลด → กด **วางลิงก์** หรือคลิกช่องแล้วกด **Ctrl+V** / คลิกขวา **วาง** → ตรวจสอบลิงก์ → **เลือกรูปแบบเสียงด้วยตนเอง** และเลือกโฟลเดอร์ → เริ่มดาวน์โหลด

หน้า Download ไม่เลือกรูปแบบเสียงไว้ล่วงหน้า ปุ่มดาวน์โหลดเปิดได้เมื่อเลือกรูปแบบ ตรวจสอบลิงก์ เลือกโฟลเดอร์ และเครื่องมือพร้อมครบแล้ว

เมื่อเปลี่ยนรุ่น portable ให้ปิดหน้าต่างโปรแกรมเดิมก่อนเปิด executable รุ่นใหม่ มิฉะนั้นระบบหนึ่งหน้าต่างจะโฟกัสโปรแกรมรุ่นเดิมที่ยังเปิดอยู่

Download เชื่อม runner จริงแล้ว แต่ **ยังไม่มี authorized live-provider acceptance** สำหรับรุ่นนี้ อย่าใช้การผ่าน Convert หรือภาพ UI เป็นหลักฐานว่า YouTube ดาวน์โหลดสำเร็จ

ไฟล์อยู่ในโฟลเดอร์ที่เลือก ปุ่มเปิดโฟลเดอร์/เปิดไฟล์ตรวจว่าผลลัพธ์ยังอยู่ก่อนเปิด ไฟล์ชื่อซ้ำจะเพิ่ม `(1)`, `(2)` ฯลฯ ไม่เขียนทับไฟล์เดิม ไม่ลบต้นฉบับ และไม่ลบผลลัพธ์อัตโนมัติ

## งานปัจจุบัน

ปุ่ม **เริ่มงานใหม่** จะแสดงหลังงานสำเร็จ ล้มเหลว ยกเลิก หรือถูกขัดจังหวะเท่านั้น เมื่อกดสำเร็จ จะเคลียร์ทั้ง **01 ต้นทาง** (ลิงก์/ข้อมูลไฟล์), **02 รูปแบบและปลายทาง** (Format, Quality, โฟลเดอร์, ชื่อไฟล์ที่กำหนดเอง), **03 งานปัจจุบัน** (ผลลัพธ์บนหน้าจอ/Progress) แล้วกลับเป็น **พร้อมเริ่ม** ต้องเลือกข้อมูลสำหรับงานใหม่อีกครั้ง ไม่ลบหรือแตะไฟล์เสียงจริง และไม่ปลดล็อกงานที่กำลังทำหรือ cleanup-required

มีงาน active ได้หนึ่งงานร่วมกันทั้งสองหน้า สลับหน้าหรือ reload แล้วงานเดิมยังอยู่ ไม่เริ่มใหม่เอง เริ่มแอปครั้งที่สองจะโฟกัสหน้าต่างเดิม

ความคืบหน้าเป็นของ **ขั้นตอนปัจจุบัน** จาก worker จริง ถ้าไม่ทราบจะแสดง indeterminate ดาวน์โหลดถึง 100% ยังต้องตรวจ/แปลง/บันทึกก่อนสำเร็จ

ยกเลิกต้องรอ process tree หยุดและ cleanup ครบก่อนเริ่มใหม่ ในช่วง `saving` ที่เริ่ม atomic commit แล้ว การยกเลิกจะไม่ถูกรับและต้องรอการบันทึกสั้น ๆ ให้จบ

หากขึ้น `cleanup-required` จะไม่ปลดล็อก Start: ตรวจข้อความและ staging `.atl-job-<jobId>` ที่ระบุ ปิดแอป ตรวจว่า worker ไม่มีงานค้าง แล้วนำเฉพาะ staging นั้นออกด้วยตนเองก่อนเปิดใหม่ ห้ามลบต้นฉบับหรือไฟล์ผลลัพธ์ การเปิดแอปหลัง crash ไม่ resume network อัตโนมัติ

## ความเป็นส่วนตัวและขอบเขต

- UI/assets/fonts โหลดจาก `atl-media://app/` ในเครื่อง ไม่มี media HTTP service, upload, proxy, telemetry หรือ auto update
- ใช้ native bridge แบบ context isolation + sandbox, ปิด nodeIntegration; renderer ไม่มีสิทธิ์ส่ง executable/argv/path เพื่อเรียกโปรแกรมเอง
- Convert ใช้ FFmpeg/FFprobe ในเครื่อง ปิด network protocol และปฏิเสธ playlist/manifest/symlink/junction/UNC
- Download ใช้ yt-dlp ติดต่อ provider โดยตรง ไม่อ่าน browser cookies ไม่รับ login/live/playlist/DRM ปิด config/plugin/remote components และใช้ Node executable ที่บรรจุแยกสำหรับ EJS
- เก็บเฉพาะ snapshot งานปัจจุบันใน `%APPDATA%\Audio Tech Labs Media Tools\local-media\` ไม่มี sync server และไม่มี source URL ใน snapshot
- Source/folder tokens เก็บใน memory และหมดสภาพเมื่อเปิดแอปใหม่ ต้องเลือกต้นทาง/ปลายทางใหม่ ไม่เก็บ credential

## รูปแบบ

Original Audio ใช้เฉพาะ Download คง codec/container และ extension ของไฟล์ที่ดาวน์โหลดจริง MP3 เลือก 128/192/256/320 kbps; WAV/FLAC/ALAC เลือก 16/24 bit และ sample rate ตามต้นทาง/44.1/48 kHz ALAC ใช้ M4A

**การแปลงเป็น lossless ไม่ได้เพิ่มรายละเอียดที่ต้นทางไม่มี** Metadata ที่ไม่ทราบเก็บเป็น `null` และแสดง “ไม่ทราบ”

## ข้อจำกัดรุ่นภายใน

- Windows 10/11 x64 พร้อม .NET Framework 4.x ของ Windows สำหรับ ProcessHost; ไม่ต้อง .NET SDK
- ยังไม่ลงนามโปรแกรม และยังไม่ทดสอบบน Windows VM/user ที่สะอาดจริง การทดสอบที่จำกัด PATH เหลือ Windows System32 แยกไว้ในรายงาน
- ใช้ local drive ปกติ ไม่รองรับ junction/symlink/UNC หรือ manifest ที่อ้างไฟล์อื่น
- การตรวจพื้นที่เผื่อ staging ก่อนเริ่ม และตรวจระหว่าง worker ทำงาน ไม่รับประกันกรณีอุปกรณ์หลุดหรือพื้นที่เต็มในทุก timing
- รองรับหนึ่ง audio stream ต่อไฟล์ ไม่มี batch/queue/mixing/normalization
- งานตรวจที่ยังเหลือและระดับหลักฐานอยู่ใน `ACCEPTANCE-REPORT.md`

## สำหรับพัฒนา

โค้ดแยกใน `desktop/media-tools/` ไม่เปลี่ยนหน้า Home/backend/credentials/tunnel/deployment เดิม

```powershell
npm ci --ignore-scripts
node scripts/prepare-vendor.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-helper.ps1
node scripts/prepare-ui.cjs
```

Electron distribution มาจาก archive ที่ตรวจ publisher checksum แล้วใน `cache/`; แตกไป `node_modules/electron/dist` และตั้ง `node_modules/electron/path.txt` เป็น `electron.exe` ก่อน `npm start`

ตรวจเฉพาะส่วนที่เปลี่ยน: `npm test` (validation/security), `node test/acceptance.cjs` (real media matrix), `node test/lifecycle.cjs`, `node test/network.cjs`, `node test/ui-acceptance.cjs` (ต้องมี Playwright ใน NODE_PATH)

สร้างโฟลเดอร์ portable ด้วย `node scripts/package.cjs --directory-only` ตรวจ portable แล้วสร้าง ZIP ครั้งสุดท้ายด้วย `node scripts/package.cjs --finalize` ผลล่าสุดดู `release/latest.json` ห้ามเผยแพร่ก่อนปิดรายการตรวจรับที่ค้าง
