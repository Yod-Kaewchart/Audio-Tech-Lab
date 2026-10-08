# Pinned dependencies and notices

Candidate versions จากแผน connection ถูกตรวจจากผู้เผยแพร่ก่อนเตรียมไฟล์ ไม่มีการใช้ yt-dlp 0-byte ที่พบในการสำรวจ

| Component | Version | Verification / notices |
| --- | --- | --- |
| Electron | 44.7.0 win32-x64 | GitHub release SHASUMS256; npm lockfile integrity; `LICENSE`, `LICENSES.chromium.html` ใน portable |
| yt-dlp.exe | 2026.08.19 | SHA2-256SUMS ของ release; LICENSE และ THIRD_PARTY_LICENSES จาก tag ตรงรุ่น รวม EJS ตาม distribution |
| FFmpeg / FFprobe | 9.0.2-essentials_build | archive SHA256 ของ gyan.dev, hash executable แยก; FFmpeg GPLv3 และ build README |
| Node CLI for EJS | 24.19.0 win-x64 | SHASUMS256 ของ nodejs.org; LICENSE รวม third-party notices; ใช้ `node.exe` แยก ไม่ใช้ electron.exe แทน |
| ProcessHost | 1.0.0 x64 | สร้างจาก `native/ProcessHost.cs`; hash source/binary ใน manifest; ใช้ .NET Framework 4.x และ Windows Job Object APIs |
| DM Sans / Noto Sans Thai | Google Fonts v17 / v29 ตาม CSS ของ Public Home ที่ตรวจ 8 ตุลาคม 2026 | WOFF2 ทั้ง 5 subsets พร้อม OFL licenses ใน `ui/assets/`; URL และ SHA256 ใน `evidence/home-theme/font-manifest.json` |

`dependencies.lock.json` และ `resources/vendor/manifest.json` บันทึก SHA256 ของ executable จริงทั้งหมด พร้อม source URL และ publisher archive hashes Runtime ตรวจ hash ก่อน spawn และไม่ค้นหา global PATH สำหรับเครื่องมือเสียง

ฟอนต์ใช้ไฟล์ WOFF2 เดียวกับที่ Public Home ส่งจริง โดยเก็บไฟล์ไม่แก้ข้อมูลภายในและเก็บ copyright/license เดิม DM Sans และ Noto Sans Thai ใช้ SIL Open Font License 1.1 ซึ่งอนุญาต bundle/redistribute กับซอฟต์แวร์เมื่อแนบ notices ไม่ขายฟอนต์แยก ตรวจเทียบกับ [DM Sans OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt) และ [Noto Sans Thai OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/OFL.txt) แล้ว `prepare-ui.cjs` และ package ไม่โหลดฟอนต์จากเครือข่าย การ refresh จาก Public ต้องเรียก `prepare-home-fonts.cjs` โดยตั้งใจหลังเก็บหลักฐาน reference ใหม่เท่านั้น

แหล่งอ้างอิง:

- https://github.com/electron/electron/releases/tag/v44.7.0
- https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19
- https://nodejs.org/dist/v24.19.0/SHASUMS256.txt
- https://www.gyan.dev/ffmpeg/builds/
- https://github.com/yt-dlp/yt-dlp/wiki/EJS
- https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects

FFmpeg essentials distribution นี้เป็น GPLv3 เก็บ notices ของ build ไว้ครบ แพ็กเกจนี้เป็นการทดสอบภายใน ยังไม่เป็นข้อสรุปเรื่องการแจกภายนอก ต้องตรวจ corresponding source/ภาระการแจกตาม license และ code signing ก่อนเผยแพร่จริง
