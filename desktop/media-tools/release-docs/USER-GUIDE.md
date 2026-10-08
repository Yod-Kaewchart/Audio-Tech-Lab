# Audio Tech Labs Media Tools — 0.2.2-beta.2 candidate

ชุดนี้จัดไว้เพื่อส่งตรวจภายใน ยังไม่อนุมัติให้เผยแพร่ Public Beta และยังไม่มี code signature

รองรับ Windows 10/11 x64 ใช้งานด้วยสิทธิ์ผู้ใช้ปกติ หน้าต่างขั้นต่ำ 360 × 600 และขนาดเริ่มต้น 1280 × 940

## ติดตั้งและอัปเดต

ตรวจชื่อรุ่นและ SHA256 ของ Setup/Portable กับ release manifest ก่อนใช้ Setup ติดตั้งต่อผู้ใช้ใน `%LOCALAPPDATA%\Programs\Audio Tech Labs Media Tools` อัปเดตโดยปิดแอปและติดตั้ง Setup รุ่นใหม่ในตำแหน่งเดิม ห้ามเปิดสองรุ่นพร้อมกัน สำรอง `%APPDATA%\Audio Tech Labs Media Tools` และไฟล์เสียงที่ต้องเก็บก่อนอัปเดต

Portable: แตก ZIP ทั้งโฟลเดอร์ในตำแหน่งใหม่ แล้วเปิด `Audio Tech Labs Media Tools.exe` ต้องเก็บ resources/vendor และ resources/app ทั้งหมดคู่กับ EXE Portable ใช้ profile ของผู้ใช้เหมือนรุ่นติดตั้ง ไม่ได้แยกข้อมูลตามโฟลเดอร์ Portable ฟอนต์ DM Sans และ Noto Sans Thai bundle ในแอป ใช้งาน UI และ Convert/Player ได้โดยไม่ต้องดาวน์โหลดฟอนต์

ถอนการติดตั้งผ่าน Windows Installed apps/Apps & features หรือ unins000.exe ตัวถอนติดตั้งลบไฟล์โปรแกรมและ shortcuts ข้อมูลใน profile และไฟล์เสียงที่ส่งออกอยู่นอกโฟลเดอร์ติดตั้ง หากนำเสียงไปเก็บในโฟลเดอร์ติดตั้งเอง ให้ย้ายและสำรองก่อนถอนติดตั้ง

## ใช้งาน

Download Audio: ใช้เฉพาะ URL YouTube ที่คุณมีสิทธิ์ดาวน์โหลด ตรวจลิงก์ เลือกโฟลเดอร์และรูปแบบ แล้วเริ่มงาน Original เก็บรูปแบบเสียงที่ผู้ให้บริการส่งมา MP3 แปลงเป็นไฟล์บีบอัด WAV/FLAC/ALAC ไม่ทำให้เสียงต้นทางที่บีบอัดกลับมามีรายละเอียดเพิ่ม รุ่นนี้ยังไม่มี live YouTube acceptance ที่ได้รับอนุญาต จึงยังไม่รับรองความสำเร็จของ Download หรือ EJS กับผู้ให้บริการจริง

Convert Audio: เลือกไฟล์เสียงในเครื่อง เลือกปลายทาง ตั้งชื่อไฟล์โดยไม่ใส่นามสกุล แล้วเลือกรูปแบบ/คุณภาพ เริ่มงานใหม่ใช้ได้เมื่องานจบหรือยกเลิกและ cleanup ครบแล้ว แอปไม่เขียนทับไฟล์ปลายทางที่มีชื่อซ้ำ

Player: เพิ่มไฟล์ลง Playlist แล้วใช้ Play/Pause/Seek และเลือกรายการเพลง การเล่นใช้ playback host เดิมเมื่อเปลี่ยนหน้า Download/Convert/Player

หากสถานะขึ้น cleanup-required หรือการเลือกโฟลเดอร์ต้องกู้คืน แอปจะบล็อกงานใหม่ ให้ทำตาม RECOVERY.md อย่าลบ profile หรือไฟล์เสียงเพื่อแก้ปัญหา

## ข้อจำกัดการส่งตรวจ

Live Download, normal installer บน Windows สะอาด, code signing และ SmartScreen reputation ยัง BLOCKED ต้องตรวจใบอนุญาตและ complete corresponding source ของ bundled GPL binaries ให้ครบก่อนเผยแพร่ ดู THIRD-PARTY-NOTICES.md และรายงานส่งตรวจภายนอกแพ็กเกจ ห้ามปิด Defender/SmartScreen เพื่อข้ามคำเตือน
