# Dependency notices — distribution review incomplete

Audio Tech Labs Media Tools เรียกเครื่องมือเหล่านี้เป็น executable แยกผ่าน ProcessHost ข้อมูลรุ่น/ไฟล์/SHA256 อยู่ใน dependencies.lock.json

| Component | Version | Notice / source requirement |
| --- | --- | --- |
| Electron / Chromium / Node in Electron | Electron 44.7.0 | LICENSE และ LICENSES.chromium.html ที่โฟลเดอร์โปรแกรม; upstream https://github.com/electron/electron |
| Node JS runtime | 24.19.0 | resources/vendor/notices/Node-LICENSE.txt; https://nodejs.org/download/release/v24.19.0/ |
| FFmpeg + FFprobe (Gyan static essentials) | 9.0.2 | GPLv3, not an LGPL-only build; FFmpeg-GPLv3.txt และ FFmpeg-README.txt มี configure/build information; https://www.gyan.dev/ffmpeg/builds/ |
| yt-dlp Windows standalone | 2026.08.19 | main source Unlicense, combined PyInstaller executable GPLv3+; yt-dlp-LICENSE.txt และ yt-dlp-THIRD_PARTY_LICENSES.txt; https://github.com/yt-dlp/yt-dlp/tree/2026.08.19 |
| DM Sans / Noto Sans Thai | bundled WOFF2 and TTF | SIL OFL 1.1; ui/assets/DM-Sans-OFL.txt และ Noto-Sans-Thai-OFL.txt |
| ProcessHost | 1.0.0 | source in notices/ProcessHost-source; exact source SHA in dependency lock; built with Windows .NET Framework compiler |

## Corresponding source gate: BLOCKED

ชุด source review ที่เตรียมแยกจาก Portable/Setup มี source ของ FFmpeg ตาม commit ที่ผู้สร้าง binary ระบุ และ yt-dlp release source พร้อม notices/build config ที่มีอยู่ เป็นชุดตรวจที่ยังไม่ครบ ห้ามถือว่าเป็น complete corresponding source

FFmpeg static binary รวม external libraries ต้องได้ exact matching source, patch และ build scripts ของทุกส่วนที่มีข้อกำหนด corresponding source จากผู้สร้าง binary ไม่ใช่เพียง FFmpeg tarball สำหรับ yt-dlp.exe ต้องครอบคลุม bundled GPL components/PyInstaller และ scripts/dependency versions ที่ใช้ประกอบ binary ด้วย

ยังไม่มีหลักฐานยืนยัน completeness หรือ rebuild จาก source kit ให้ตรง binary ที่ bundle การเผยแพร่ต้องรอ gate นี้ ห้ามอ้างว่าลิงก์ source upstream อย่างเดียวทำให้ผ่าน ตรวจข้อกำหนดจาก upstream โดยตรง:

- https://ffmpeg.org/legal.html
- https://www.gnu.org/licenses/gpl-3.0.html (Corresponding Source และ conveying object code)
- https://github.com/yt-dlp/yt-dlp/blob/2026.08.19/README.md#licensing
- https://www.gyan.dev/ffmpeg/builds/

ไม่มี public upload หรือ written source offer ที่อนุมัติไว้ในรอบนี้
