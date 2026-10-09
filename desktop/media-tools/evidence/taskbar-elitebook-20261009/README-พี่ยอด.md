# EliteBook taskbar visual — 0.2.2-beta.2

วันที่ 9 ตุลาคม 2026 (Asia/Bangkok) · **private review evidence** · ไม่เผยแพร่ · **Taskbar visual รวม BLOCKED**

## สถานะล่าสุดหลัง follow-up 11:48–11:51 ไทย

**A. Hover/thumbnail BLOCKED**, **B. เปิดซ้ำ/focus/grouping PASS**, **C. หลังปิด PASS** โดยใช้ EXE/profile/launcher เดิม มีภาพเต็ม desktop ใหม่ 3 ภาพ, native window observations และ OS process snapshots ดู [รายงาน follow-up](portable-followup/README-พี่ยอด.md), [captures/SHA256](portable-followup/captures.json) และ [validation](portable-followup/validation.json) Portable taskbar gate ยัง BLOCKED จน A มีภาพชื่อ/thumbnail จริง; Installed/source/gate อื่นคงเดิม

Player และ Snipping Tool ปิดตามปกติแล้ว ไม่เหลือ Portable native window หรือ related EXE/profile processes ข้อมูลผู้ใช้จริง 73 ไฟล์และ shortcut 4 ไฟล์คงเดิม Test profile เปลี่ยนแยกต่างหากและไม่ได้ restore/delete ข้อความว่า Player/Snipping Tool เปิดค้างและขั้นตอนที่ยังขาดด้านล่างเป็น **snapshot รอบ 11:13 ก่อน follow-up** ตอนนี้เหลือ manual เฉพาะ A ตามรายงานล่าสุด ไม่ต้องทำ B/C ซ้ำเพราะเหตุว่า A ยัง BLOCKED

## Snapshot รอบ 11:13 ก่อน follow-up

เริ่มที่ `9fe2cf2a8c692882ca9a8110ed0e310e63ed1f84` บน `codex/source-taskbar-review-20261009`, Git สะอาด ไม่มี AGENTS.md ใน ancestor/scope ที่ตรวจ (`agents-scope.json`) Source/build commit เดิม `df183f4970366597d539323760108dbaf234e049` แยกจาก docs-only review commit ของชุดนี้ซึ่งดูได้จาก Git history ไม่มีการเปลี่ยนโปรแกรม, dependencies, vendor, version หรือแพ็กเกจ ไม่ rebuild/reinstall/push/upload/deploy

เครื่อง HP EliteBook 840r G4, Windows 11 Pro 10.0.26300 build 26300 (`baseline.json`) ภาพ PNG 1366×768; ไม่ได้เปลี่ยน display scale, combine, auto-hide หรือ pin settings และยังไม่ได้ตรวจค่าการตั้งค่าเหล่านี้แยกจากภาพ

## Candidate และวิธีเปิด

| รายการ | Path / ผล | SHA256 |
| --- | --- | --- |
| Setup เดิมที่ตรวจ hash | `release/review-0.2.2-beta.2-r2-11549c34e61f/candidate/Audio-Tech-Labs-Media-Tools-Setup-0.2.2-beta.2-Win64.exe` — 210937650 bytes; ไม่เปิดติดตั้ง | `11549c34e61f94dab4170e781db2176fbd2def6add9de849a2ea8fc0bc901c27` |
| Portable ZIP เดิม | `release/review-0.2.2-beta.2-r2-11549c34e61f/candidate/Media-Tools-0.2.2-beta.2-win-x64-20261008T181605577.zip` — 288706248 bytes | `3b17cfe6d19d03375c86a23a37ce62d8f69f4261a091bedb19db47f5724dbdfc` |
| Portable EXE ที่เปิดจริง | `D:\Sites\Audio Tech Labs\desktop\media-tools\test-output\beta2-portable-extracted\Media-Tools-0.2.2-beta.2-win-x64-20261008T181605577\Audio Tech Labs Media Tools.exe` — 246269440 bytes | `94b0deb9e81e26c2aec82551c811811de415214666ec1622d9e326946ed8a05d` |

ProductName `Audio Tech Labs Media Tools`; ProductVersion `0.2.2-beta.2`; FileVersion `0.2.2.2`; signature `NotSigned` ตรง manifest ใช้ extracted artifact เดิม ไม่สร้าง binary หรือแตก ZIP ใหม่

เปิด EXE ผ่าน Playwright `_electron.launch` เพื่อใช้ profile ทดสอบแยก: `D:\Sites\Audio Tech Labs\desktop\media-tools\test-output\taskbar-elitebook-20261009\portable-profile` Launcher เพิ่ม `--inspect=0` และ `--remote-debugging-port=0` นอกเหนือจาก `--user-data-dir` จึงไม่อ้างว่าเป็น shortcut/default launch ตรวจ command line/path ของ main PID 12548 และ child processes ใน `execution-and-preservation.json` (PID 4484 เป็น parent harness ไม่ใช่ main app) ใช้ Computer Use `@oai/sky` เลือก Player ผ่าน UI จริง ไม่มีงาน Download/Convert/เล่นเสียงหรือเปิด playlist ผู้ใช้

Installed: EXE เดิม `C:\Users\EliteBook\AppData\Local\Programs\Audio Tech Labs Media Tools\Audio Tech Labs Media Tools.exe` ไม่พบ ไม่พบ Audio Tech Labs uninstall entry ใน HKCU/HKLM/32-bit registry ที่ตรวจ หลักฐาน [normal-cleanup.json](../source-taskbar-20261009/normal-cleanup.json) ระบุถอน test installation แล้ว ผู้ใช้ยืนยันให้ **BLOCKED**, ไม่ reinstall และไม่ใช้รุ่นอื่นแทน Desktop shortcut เดิมชี้ Portable 0.1.0 และไม่ได้ใช้

## ภาพจริงและขอบเขตตัดสินผล

ใช้ Windows Snipping Tool ที่ติดตั้งอยู่ เลือก **Full screen** ผ่าน UI ที่รองรับ แล้วกด New โปรแกรมบันทึก PNG เต็ม desktop อัตโนมัติที่ `C:\Users\EliteBook\Pictures\Screenshots\สกรีนช็อต 2026-10-09 111301.png` CreationTimeUtc `2026-10-09T04:13:01.9193085Z` (11:13:01.919 ไทย) ตอนคัดลอกครั้งแรก LastWriteTimeUtc เป็น `2026-10-09T04:13:02.033346Z`; เมื่อตรวจซ้ำเป็น `2026-10-09T04:17:39.1781947Z` แต่ bytes/SHA ของต้นทางและสำเนายังตรงค่าเดิม ไม่อนุมานสาเหตุจาก timestamp คัดลอกโดยไม่ crop/retouch/วาด/ประกอบภาพ Agent ไม่ได้กด Yes/ยอมรับ overwrite

หลักฐาน [portable-player-full-desktop.png](portable-player-full-desktop.png) — **218781 bytes**, SHA256 **`015863ed53e9afd25fcf7bec11f79e685e616645bf2c6c158ba49163bb1d36cc`** (`capture.json`) ภาพเห็นทั้ง Player และ taskbar ของ Windows จริง เวลาใน taskbar 11:13 วันที่ 9/10/2569 ภาพมีแอปอื่นด้านหลังจึงเก็บ private; ไม่รวมใน user package หรือ archived r2 kit

| กรณี | Installed | Portable | หลักฐาน / ขอบเขต |
| --- | --- | --- | --- |
| EXE รุ่น/hash ตรงก่อนเปิด | BLOCKED — ไม่มี EXE | PASS | manifest, baseline.json, execution-and-preservation.json |
| ไอคอน taskbar ตรง native app icon ไม่มี generic Electron | BLOCKED | PASS เฉพาะ Player ในภาพนี้ | PNG เทียบด้วยตากับ [expected-icon-32.png](../public-beta/expected-icon-32.png); native waveform ในกรอบเข้มตรงกัน ไม่ใช้ PE/WM_GETICON แทนภาพ |
| Active และจำนวน entry ในภาพเปิดครั้งเดียว | BLOCKED | PASS เฉพาะภาพนี้ | entry Media Tools ที่เห็นหนึ่งรายการ มีแถบ active สีน้ำเงิน ไม่เห็น playback host เป็น entry เพิ่ม |
| Window title หน้า Player | BLOCKED | PASS เฉพาะ window title | `Player — Audio Tech Labs · Windows` ใน caption และ supported-windows-after.json; ไม่ใช่ชื่อ hover/taskbar thumbnail PASS |
| ชื่อ hover/thumbnail และการรวมกลุ่มหลังเปิดซ้ำ | BLOCKED | BLOCKED | ยังไม่มีภาพ hover/second-launch sequence; single-instance ผลเดิมไม่แทน taskbar visual |
| Taskbar หลังปิด และความสัมพันธ์กับ pin เดิม | BLOCKED | BLOCKED | ไม่ได้ปิดในรอบนี้ ทิ้ง Player ไว้ตรวจด้วยมือ ไม่แก้ pin/unpin; ไม่พบ Media Tools .lnk ใน pinned-folder inventory แต่ไม่อ้างว่า inventory นี้ยืนยันสถานะ pin ทั้งหมดของ Windows |
| ข้อมูลผู้ใช้/shortcut เดิม | ไม่เปิด Installed | PASS ใน scope นี้ | profile เดิม 73 ไฟล์ SHA/ขนาดตรงทุกไฟล์; 4 shortcut hashes/targets/arguments/icons ตรงก่อน–หลัง รวม 3 taskbar .lnk และ legacy Desktop .lnk |

**ไม่มี FAIL ที่พบในขอบเขตภาพเดียวนี้** และ **ไม่ปิด taskbar visual gate รวม** การรวมกลุ่มเมื่อเปิดซ้ำ/ชื่อ hover/after-close ยังต้องมีหลักฐานจริง และ Installed ยังเปิดไม่ได้ API มีเฉพาะ app windows ไม่มี taskbar target หรือ hover method (`supported-windows-before/after.json`); capture เต็ม desktop ทำได้ผ่าน Snipping Tool แต่ไม่ได้ทำให้ API ควบคุม taskbar ได้

## ภาพที่พี่ยอดต้องเก็บต่อ

Player ยังเปิดใน profile ทดสอบแยกและถูกย่อหน้าต่างไว้ (window ID 264400; main PID ตาม execution record) เปิดกลับด้วยปุ่ม wave บน taskbar ไม่ใช้ Desktop shortcut รุ่น 0.1.0 ยังไม่เปิด Installed พร้อมกัน และไม่ต้องสร้าง/แก้ shortcut

1. เปิด Player กลับ แล้ววางเมาส์บน entry ของแอป เก็บภาพเต็ม desktop ที่เห็น hover thumbnail/ชื่อและไอคอนจริง ใช้ Snipping Tool delay ในโหมดที่ครอบคลุม desktop หรือ Print Screen ตามที่เครื่องรองรับ บันทึก PNG ชื่อใหม่ ไม่ overwrite ภาพเดิม
2. ถ้าตรวจเปิดซ้ำ ให้เปิด **EXE path ตามตารางและ `--user-data-dir` เดิม** เท่านั้น บันทึก launch method/arguments/time และภาพก่อน–หลังว่า Player เดิมได้รับ focus มี UI/entry/group เดียว ไม่ใช้ profile default หรือ legacy shortcut ขั้นตอนนี้ยังไม่ได้ทำในรอบนี้
3. เมื่อเก็บครบ ปิดด้วย X หรือ Alt+F4 ตามปกติหลังยืนยันไม่มีงาน/เสียง แล้วเก็บ taskbar หลังปิด บันทึก pin ที่มีอยู่จริงโดยไม่เปลี่ยน pin/unpin ห้าม kill process ที่ไม่เกี่ยวข้อง
4. ส่ง PNG ต้นฉบับพร้อมวันเวลา/path/version/ผู้ตรวจให้ตรวจ SHA และอัปเดตผล ไม่เปลี่ยนเป็น PASS จากคำคาดเดา

Snipping Tool ยังถูกย่อไว้หลัง capture การ Save As เพิ่มเติมเจอ prompt ว่าไฟล์ auto-save เดิมมีอยู่แล้วและ **ไม่ได้กด Yes/overwrite** ถ้าเปิดเครื่องมือแล้วพบ prompt ให้เลือก No แล้ว Cancel; ภาพ auto-save และสำเนาหลักฐานตรวจ hash แล้ว ปัจจุบันโหมด Full screen ไม่ได้ยืนยันว่าคืน Rectangle เดิมแล้ว ไม่มีการอ้าง cleanup ของหน้าต่าง Snipping Tool ว่าผ่าน

Source requests คง **SENT — user-reported / AWAITING RESPONSE**; corresponding source **BLOCKED / INCOMPLETE**; Download live/EJS, clean-machine QA, signing/SmartScreen **BLOCKED** ไม่ได้รัน audio regression/build ซ้ำเพราะแก้เฉพาะเอกสาร/evidence ดูผล JSON/hash/preservation/scope/diff checks ใน `validation.json`
