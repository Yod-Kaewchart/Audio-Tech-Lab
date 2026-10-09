# ตรวจ taskbar จริง — สำหรับพี่ยอด

สถานะ **BLOCKED**: API Windows ที่รองรับเปิดให้จับเฉพาะหน้าต่างแอป ไม่มี taskbar ใน inventory ที่คืนมา ภาพ `*-app-window-NOT-TASKBAR.png` เป็นหน้าต่างจริงแต่ใช้แทนภาพ taskbar ไม่ได้ PE icon hash, WM_GETICON, shortcut icon และ AppUserModelID ไม่ใช่หลักฐาน visual ในรายการนี้

## ชุดเดียวกันที่ต้องใช้

| ชุด | SHA256 |
| --- | --- |
| Setup `Audio-Tech-Labs-Media-Tools-Setup-0.2.2-beta.2-Win64.exe` | `11549c34e61f94dab4170e781db2176fbd2def6add9de849a2ea8fc0bc901c27` |
| Portable `Media-Tools-0.2.2-beta.2-win-x64-20261008T181605577.zip` | `3b17cfe6d19d03375c86a23a37ce62d8f69f4261a091bedb19db47f5724dbdfc` |
| Main EXE ทั้งสองแบบ | `94b0deb9e81e26c2aec82551c811811de415214666ec1622d9e326946ed8a05d` |

ProductName `Audio Tech Labs Media Tools`; ProductVersion `0.2.2-beta.2`; FileVersion `0.2.2.2`; unsigned ทุกไฟล์ Candidate เดิมอยู่ใน private review kit r2 และชุดก่อนหน้า ไม่มีการ rebuild Setup/Portable

## เตรียมตรวจ

บันทึกชื่อผู้ตรวจ วันเวลา Windows build, display scale, monitor และ taskbar combine/auto-hide ที่ใช้อยู่ ตรวจ hash ก่อนเปิดทุกชุด ปิด Media Tools ที่กำลังทำงานหลังงานและเสียงหยุดแล้ว สำรอง profile/playlist ตามวิธีใช้งานเดิม อย่าลบข้อมูลหรือ overwrite shortcut เดิม ถ้าเครื่องมี installation อื่น ให้ใช้เครื่องทดสอบที่เหมาะสมหรือเก็บ rollback ก่อนเปลี่ยน ไม่เปลี่ยน security settings และไม่ข้าม SmartScreen/Defender เพื่อให้ผ่านรายการนี้

ใช้ profile ทดสอบแยก ถ้าไม่ต้องการแตะ playlist เดิม ให้สร้าง **shortcut ทดสอบชื่อใหม่** โดย Target เป็น EXE ของ candidate และ Arguments เป็น `--user-data-dir="<โฟลเดอร์ทดสอบใหม่>"` บันทึกทั้ง path/arguments ตัวเลือกนี้ตรวจ visual ของ installed EXE ได้ แต่ยังต้องแยกจากการตรวจ shortcut ปกติที่ installer สร้าง

## Normal installed app

1. ติดตั้ง Setup ที่ hash ตรงด้วย normal AppId `AudioTechLabs.MediaTools` บันทึก install path และ target/icon/arguments ของ Start Menu shortcut จริง Default EXE อยู่ใน `%LOCALAPPDATA%\Programs\Audio Tech Labs Media Tools\Audio Tech Labs Media Tools.exe` ระวัง Desktop shortcut เดิมของเครื่องนี้ชี้ Portable 0.1.0 จึงห้ามใช้ shortcut นั้นอ้างเป็น installed beta.2
2. เปิดจาก Start Menu shortcut จริง (หรือระบุชัดว่าเปิดจาก EXE/shortcut ทดสอบแยก profile) เก็บภาพ desktop เต็มที่เห็นหน้าต่างแอปและ **taskbar จริงในภาพเดียวกัน** ใช้ Snipping Tool เลือก full screen ด้วยมือหรือ Print Screen แล้วบันทึก PNG ห้ามใช้ภาพหน้าต่างแอปอย่างเดียว
3. เก็บภาพ taskbar hover thumbnail/ชื่อของปุ่มแอปและ group ถ้า combine taskbar เป็น icon-only ให้เปิด thumbnail เพื่อเห็นชื่อ หน้าต่าง Download มี title `Download Audio — Audio Tech Labs · Windows`; ชื่อ product/shortcut ต้องเป็น `Audio Tech Labs Media Tools` ไอคอนควรเป็น wave ในกรอบเข้มแบบเดียวกับหน้าต่างและ app-icon.ico
4. เปิด launch target เดิมซ้ำด้วย profile เดิม บันทึกว่ามีหน้าต่าง UI เดียวและได้รับ focus ไม่เกิด group เพิ่มจากการเปิดครั้งที่สอง hidden playback host ต้องไม่มี taskbar entry ของตัวเอง เก็บภาพก่อน/หลังและ EXE path/PID ตรวจ process path เพื่อไม่ปะปนกับ Portable
5. เปลี่ยน Download → Convert → Player และกลับ เก็บภาพ taskbar/thumbnail ที่ชื่อเปลี่ยนตามหน้า แต่ไอคอนและการรวมกลุ่มยังถูกต้อง ไม่จำเป็นต้องดาวน์โหลดหรือแปลงเสียงเพื่อรายการนี้
6. ปิดแอป บันทึก taskbar entry หายตามพฤติกรรม pinned/unpinned เดิม ถอนเฉพาะ test installation เมื่อตรวจเสร็จ คืน shortcut/state ที่สำรองไว้ และตรวจข้อมูลเดิมไม่เปลี่ยน

## Portable (ตรวจแยกหลังปิด installed app)

1. แตก ZIP ที่ hash ตรงลงโฟลเดอร์ใหม่ บันทึก extracted EXE path และ hash/version ตามตาราง ใช้ EXE โดยตรง หรือ shortcut ทดสอบชื่อใหม่ที่บันทึก target/arguments อย่าใช้ legacy Desktop shortcut ของ Portable 0.1.0
2. ทำขั้นตอนภาพ full desktop/taskbar, hover/group, เปิดซ้ำ, focus, เปลี่ยนสามหน้าและปิด เช่นเดียวกับ installed app ใช้ profile Portable ทดสอบแยกเพื่อไม่แก้ playlist เดิม
3. ถ้าจะทดสอบ installed และ Portable พร้อมกัน ให้ทำเป็นกรณีเพิ่มต่างหาก บันทึก profile/path ของทั้งสองและผลที่คาดหวังตาม single-instance/profile ไม่ใช้กรณีนี้แทนการตรวจสองแบบแยกกัน

## ส่งหลักฐานและตัดสินผล

ชื่อภาพแนะนำ `normal-taskbar-open.png`, `normal-taskbar-hover.png`, `normal-taskbar-second-launch.png`, `portable-taskbar-open.png`, `portable-taskbar-hover.png`, `portable-taskbar-second-launch.png` เก็บไฟล์ PNG ต้นฉบับไม่ retouch พร้อม SHA256 และ worksheet นี้ อย่าแชร์ข้อมูลแอปอื่นในภาพออก Public; เก็บใน private evidence ตรวจด้วยมือว่า taskbar อยู่ในภาพจริง

| รายการ | Normal | Portable | Evidence path / SHA / ข้อสังเกต |
| --- | --- | --- | --- |
| EXE/ZIP/Setup hash, version และ launch target ตรง candidate | PENDING | PENDING | |
| ภาพ taskbar จริง เห็นไอคอนตรงแอป | BLOCKED | BLOCKED | ยังไม่มีภาพ taskbar |
| ชื่อ/thumbnail/group ตรง และ hidden playback ไม่เพิ่ม entry | BLOCKED | BLOCKED | |
| เปิดซ้ำผ่าน target ที่บันทึกไว้แล้วหน้าต่างเดียว/focus | PASS เฉพาะ EXE test รอบนี้ | PASS เฉพาะ EXE test รอบนี้ | *-single-instance.json; ไม่ใช่ shortcut/taskbar visual PASS |
| profile/playlist/shortcut/ไฟล์เสียงเดิมคงอยู่ | PENDING สำหรับ manual run | PENDING สำหรับ manual run | รอบ automated installed cleanup ตรวจ profile 73 ไฟล์และ Desktop shortcut ตรงเดิม |

เปลี่ยน visual เป็น PASS ได้หลังมีภาพต้นฉบับและผลชื่อ/ไอคอน/group ของทั้งสองแบบครบ อ้าง candidate hashes เดียวกัน หากไม่ตรงให้ FAIL พร้อมภาพและ launch path; หากจับภาพหรือเปิดไม่ได้คง BLOCKED โดยระบุเหตุ ไม่ใช้ภาพจำลองหรือ resource metadata แทน
