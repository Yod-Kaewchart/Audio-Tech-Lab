# 0.2.2-beta.1 — review candidate

- แก้การเลือกโฟลเดอร์เมื่อ file guard release ล้มเหลว: แสดง cleanup-required, ไม่ออก destination token, ไม่ปล่อย setupBusy ค้าง และคงการบล็อกข้ามการเปิดแอปใหม่จนผู้ดูแลยืนยัน process/cleanup ตามคู่มือ
- การสร้าง Setup ตรวจทุกไฟล์ src/ui/assets รวมฟอนต์ และ package version กับ source ตรวจ vendor กับ dependencies.lock.json ตรวจ runtime/ไอคอน/notices และ SHA256SUMS ปฏิเสธไฟล์ขาด เปลี่ยน เก่า และไฟล์เกินก่อน compile
- ProductName/FileDescription ของ EXE ใช้ Audio Tech Labs Media Tools; ProductVersion 0.2.2-beta.1; Windows FileVersion 0.2.2.1 (เลขท้าย 1 คือ beta iteration)
- EXE, window, installer, shortcuts และ uninstall ใช้ media-tools.ico เดียวกัน; app/shortcuts ใช้ AudioTechLabs.MediaTools AppUserModelID
- Portable/Setup รวมเฉพาะ runtime, app, fonts, dependency notices, helper source และคู่มือ ไม่รวม developer evidence, test profile หรือ log

ฟอนต์ พื้นหลัง layout โลโก้ ข้อความและฟังก์ชัน Download/Convert/Player เดิมยังใช้มาตรฐาน shared theme ของ 0.2.1 ไม่มีฟีเจอร์ใหม่ ไม่มี migration ข้อมูลผู้ใช้

ยังไม่เผยแพร่: live Download/EJS, clean-machine installer QA, signing/SmartScreen และ complete corresponding source ยังต้องผ่าน review gate รายงานผลทดสอบอยู่ในชุดส่งตรวจซึ่งแยกจาก payload รุ่นติดตั้ง/Portable
