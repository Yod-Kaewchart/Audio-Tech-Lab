# Portable taskbar follow-up — QA ภายใน

9 ตุลาคม 2026 · Asia/Bangkok · **Portable gate BLOCKED เพราะยังไม่มี A. hover/thumbnail** · ไม่เผยแพร่ภาพ/แพ็กเกจ

เริ่ม HEAD `e7e2412685394986fecb7dd9d6d33da9caf05a56` บน `codex/source-taskbar-review-20261009`, Git สะอาด ไม่พบ AGENTS.md ใน ancestor/project/evidence scope ที่ตรวจ รักษา evidence รอบเดิม ไม่ overwrite ภาพ/JSON เดิม ไม่มี reinstall/rebuild เปลี่ยนโปรแกรม/vendor/dependencies/version หรือ push/merge/upload/deploy Source/build commit ยังคง `df183f4970366597d539323760108dbaf234e049`; docs-only review commit ของชุดนี้ดูจาก Git history

## ยืนยันตัวทดสอบและข้อมูลเดิม

EXE จริง: `D:\Sites\Audio Tech Labs\desktop\media-tools\test-output\beta2-portable-extracted\Media-Tools-0.2.2-beta.2-win-x64-20261008T181605577\Audio Tech Labs Media Tools.exe`

ProductVersion **0.2.2-beta.2**, FileVersion **0.2.2.2**, unsigned; 246269440 bytes; EXE SHA256 **`94b0deb9e81e26c2aec82551c811811de415214666ec1622d9e326946ed8a05d`** ตาม manifest/evidence เดิม Portable ZIP SHA256 **`3b17cfe6d19d03375c86a23a37ce62d8f69f4261a091bedb19db47f5724dbdfc`** ไม่เปลี่ยน/แตกใหม่

Player ที่ยังเปิดจากรอบก่อนเป็น main PID **12548**, native window **264400**, BrowserWindow **1**, URL `atl-media://app/player.html` และ profile ทดสอบ `D:\Sites\Audio Tech Labs\desktop\media-tools\test-output\taskbar-elitebook-20261009\portable-profile` ตรวจ command line ว่า `--user-data-dir` ตรงจริง คืนหน้าต่างผ่าน `@oai/sky` ก่อนเริ่ม A ไม่มีการเปิด legacy Desktop shortcut 0.1.0 หรือ Installed รุ่นอื่น

เปิดซ้ำด้วย Playwright `_electron.launch({executablePath: <EXE เดิม>, args: ['--user-data-dir=<profile เดิม>']})` เหมือนรอบก่อน Launcher เพิ่ม `--inspect=0` และ `--remote-debugging-port=0` ตามเดิม เป็นการเปิด EXE จาก harness ไม่ใช่ shortcut/default launch ดู path/arguments/PID/log ใน [second-launch.json](second-launch.json)

## ผลตามลำดับ A → B → C

| กรณี | ผล | หลักฐาน / ขอบเขต |
| --- | --- | --- |
| A. Hover/thumbnail | BLOCKED | [hover-blocked.json](hover-blocked.json), [window inventory](windows-before-repeat.json): Player คืนได้แต่ sky API ไม่มี hover/move และไม่มี taskbar surface; ไม่ได้แสดงหรือจับ thumbnail/ชื่อ ไม่ใช้ window caption เป็นผล hover PASS |
| B. เปิดซ้ำ/focus/grouping | PASS | [ภาพก่อน](portable-before-repeat-full-desktop.png), [ภาพหลัง](portable-after-repeat-full-desktop.png), [second launch](second-launch.json): Player เดิม BrowserWindow 1/native 264400 เปลี่ยน focused false → true, visible UI เดียว; PNG เห็น wave taskbar entry เดียว ไม่มี group เพิ่มหรือ generic Electron |
| B. Process/window correlation | PASS ใน scope นี้ | [processes-after-repeat.json](processes-after-repeat.json): main 12548 อยู่ ตัวที่สอง 18596 ออก code 0; 5 Electron processes ของ instance เดิมเป็นข้อมูลประกอบ ไม่ใช้จำนวน process ตัดสิน single-instance; playback BrowserWindow 2 hidden และไม่มี taskbar entry เพิ่ม |
| C. หลังปิดตามปกติ | PASS | [normal-close.json](normal-close.json), [ภาพหลังปิด](portable-after-close-full-desktop.png), [processes-after-close.json](processes-after-close.json), [final windows](supported-windows-final.json): Alt+F4 เมื่อ Player ready/playlist 0, related EXE/profile processes 0 และ native UI 0 หลัง settle; ไม่มี Media Tools icon/running indicator/thumbnail ในภาพ ไม่มี pin/unpin |
| Profile/shortcut ผู้ใช้จริง | PASS | [preservation.json](preservation.json): profile จริง 73 ไฟล์ SHA/ขนาดตรง baseline เดิมและก่อน–หลัง, shortcut เดิม 4 ไฟล์ hash/target/arguments/icon ตรง; ไม่แก้/ลบ shortcut และไม่เปิด/เขียนไฟล์เสียง |

Native inventory ทันทีหลัง Alt+F4 ยังมี window เดิมช่วงปิด จึงใช้ **settled observation** แยกใน normal-close.json ไม่ตีความ snapshot ระหว่าง cleanup เป็นหน้าต่างค้าง Process exit code ของ instance เดิมไม่ได้บันทึก เพราะ Playwright handle disposed หลังปิด จึงไม่สร้าง code ขึ้นเอง; การตัดสิน C ใช้ภาพ + native window absence + OS process absence

Log second launch มี `Unable to move the cache: Access is denied`, `Unable to create cache`, `Gpu Cache Creation failed: -2` และ Playwright รายงาน connection closed เมื่อตัวที่สองปิด เก็บ log เต็มใน second-launch.json ไม่ยืนยันสาเหตุของ cache warning และไม่ได้แก้ cache/runtime UI เดิมได้ focus ไม่มี UI/group ซ้ำและตัวที่สองออก 0 จึง PASS เฉพาะพฤติกรรม B ที่มีหลักฐาน ไม่อ้างว่า log ไม่มีข้อผิดพลาด Harness พยายาม cleanup เฉพาะ PID 18596 ที่ออกไปแล้ว (taskkill ตอบ process not found); ไม่ได้ kill process ที่ไม่เกี่ยวข้อง

**ไม่มี FAIL ของ taskbar behavior ที่พบใน B/C ที่ตรวจได้** ไม่สรุป A ว่าผ่าน **Portable gate ยัง BLOCKED**, **Installed gate ยังคง BLOCKED** เพราะไม่พบ EXE เดิมและไม่ได้ reinstall; ผล Portable ไม่แทน Installed

## ภาพเต็ม desktop ต้นฉบับ

ใช้ Windows Snipping Tool เดิม ผ่าน supported sky UI เลือก Full screen แล้ว New โปรแกรม auto-save PNG ใหม่ จากนั้น copy ไฟล์ไม่ crop/retouch/composite ตรวจ SHA ของ source กับสำเนาตรงกัน ภาพมี desktop/แอปอื่นรวมข้อมูลในแชต จึงเป็น **private QA evidence ห้ามเผยแพร่** ไม่รวม user package หรือ archived review kit เดิม

| ภาพ | เวลาไทย 9 ต.ค. 2026 | Bytes | SHA256 |
| --- | --- | ---: | --- |
| portable-before-repeat-full-desktop.png | 11:48:11.381 | 369341 | `037f45384ee1938f1f71ee7364b0b099f350b71734a2d111de6e7bc1479bab8a` |
| portable-after-repeat-full-desktop.png | 11:49:43.853 | 370623 | `613b72817a4023977d60908af8403107bf153b4c0a021262a5ade17af26d7e3f` |
| portable-after-close-full-desktop.png | 11:51:14.477 | 747440 | `f8ffdb2c6509ebe7ec451d4cae776744003c12633feb5301a53b75e512b45129` |

ทั้งหมด 1366×768; [captures.json](captures.json) ระบุ source path, UTC/เวลาไทย, วิธีจับภาพและ hashes คง source auto-save เดิมไว้ Snipping Tool ปิดตามปกติแล้ว ไม่มี Save As/overwrite prompt ถูกยอมรับในรอบนี้

## แยก profile จริงออกจาก test profile

profile จริง: `C:\Users\EliteBook\AppData\Roaming\Audio Tech Labs Media Tools` — [ก่อน](real-profile-before.json)/[หลัง](real-profile-after.json) hash/ขนาดตรง 73 ไฟล์ Shortcut [ก่อน](shortcuts-before.json)/[หลัง](shortcuts-after.json) ตรง 4 ไฟล์ตามชุดเดิม ไม่แก้ Windows taskbar settings/pin/unpin

profile ทดสอบ: [ก่อน](test-profile-before.json) 55 ไฟล์ / [หลัง](test-profile-after.json) 58 ไฟล์ ตอนแอปทำงานมี 38 ไฟล์ถูก lock อ่าน SHA ไม่ได้ บันทึก sha256 null/readStatus ชัดเจน หลังปิดอ่าน SHA ได้ครบ มี cache/storage/lock changes ใน profile ทดสอบตาม [preservation.json](preservation.json) ไม่อ้าง hash ก่อนที่อ่านไม่ได้หรือว่า test profile คงเดิม ไม่ restore/delete test profile และไม่ใช้ความเปลี่ยนแปลงนี้นับเป็นข้อมูลผู้ใช้จริงเสียหาย

## Manual ที่เหลือ — เฉพาะ A

Portable ปิดแล้ว ถ้าพี่ยอดพร้อมตรวจ A ให้เปิด **EXE path และ test profile เดิมข้างต้น** (ห้ามใช้ Desktop shortcut 0.1.0/default profile) เปิด Player แล้ววางเมาส์บน wave taskbar entry ด้วยมือ เก็บ PNG เต็ม desktop ที่เห็น taskbar, thumbnail ของ Player และชื่อจริง ใช้ Snipping Tool delay ในโหมดที่ครอบคลุม desktop หรือ Print Screen ตามที่รองรับ บันทึกชื่อไฟล์ใหม่ ไม่ overwrite ภาพเดิม ระบุผู้ตรวจ เวลาไทย EXE path/version/launch arguments แล้วตรวจ SHA จาก PNG ต้นฉบับ ปิดแอปตามปกติเมื่อเสร็จ ไม่แก้ pin/unpin

หากชื่อ/ภาพตัวอย่างผิดหรือมี behavior ผิดปกติ ให้บันทึก FAIL พร้อมภาพ ไม่แก้ runtime โดยอัตโนมัติ ปิด Portable gate ได้เมื่อ A ผ่านพร้อมภาพจริงและ B/C ยังอ้าง candidate เดียวกันครบ ไม่จำเป็นต้องนำ Portable ไปตรวจแทน Installed

Source **BLOCKED / INCOMPLETE — AWAITING RESPONSE**, source requests **SENT — user-reported / AWAITING RESPONSE**, Download live/EJS, clean-machine QA, signing/SmartScreen คง BLOCKED ไม่มี audio regression/build ซ้ำเพราะเป็น docs/evidence-only ดูผล JSON/local links/hashes/diff ใน validation.json

## รายการไฟล์ใน docs-only commit รอบนี้

แก้รายงานเดิม 3 ไฟล์: `desktop/media-tools/PUBLIC-BETA-REVIEW-20261009.md`, `desktop/media-tools/evidence/source-taskbar-20261009/TASKBAR-MANUAL-QA-พี่ยอด.md`, `desktop/media-tools/evidence/taskbar-elitebook-20261009/README-พี่ยอด.md`

เพิ่ม 23 ไฟล์ใน `desktop/media-tools/evidence/taskbar-elitebook-20261009/portable-followup/`:

```text
README-พี่ยอด.md
baseline.json
capture-sources.json
captures.json
hover-blocked.json
normal-close.json
portable-before-repeat-full-desktop.png
portable-after-repeat-full-desktop.png
portable-after-close-full-desktop.png
preservation.json
processes-after-repeat.json
processes-after-close.json
real-profile-before.json
real-profile-after.json
results.json
second-launch.json
shortcuts-before.json
shortcuts-after.json
supported-windows-final.json
test-profile-before.json
test-profile-after.json
validation.json
windows-before-repeat.json
```
