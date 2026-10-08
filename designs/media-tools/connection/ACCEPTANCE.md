# Acceptance before connecting/releasing Media Tools

รายการนี้เป็นแผนตรวจรับ **ยังไม่ได้รันทดสอบ media engine จริง** หลักฐาน UI มีอยู่แยกจาก media/native/network acceptance ห้ามใช้ผล UI ผ่านแทนการยืนยัน downloader

| ชุดตรวจ | กรณีที่ต้องผ่าน | หลักฐานที่เก็บ |
| --- | --- | --- |
| Native bridge | ไม่มี bridge, dependency ขาด/ผิด hash, cancel file/folder picker, sender ผิด origin, iframe, arbitrary path/argv, token ของ session อื่น | integration assertions + capability reports |
| Input / folder | WAV/FLAC/ALAC/MP3 จริง, ไฟล์ invalid แต่ชื่อ .wav, path ไทย/ยาว, metadata ที่ไม่ทราบ, แหล่งไฟล์เปลี่ยนหลังเลือก, read-only, junction, drive หลุด | input/output probe + failure result |
| Single job | กดซ้ำ, Start สองหน้าพร้อมกัน, สลับหน้า/reload ระหว่างทำ, sequence event เก่า, retry, invalidated URL/source | มี spawn ครั้งเดียว; snapshot ถูกต้อง |
| Conversion | MP3 bitrate ทั้ง 4 ค่า, WAV16/24, FLAC16/24, ALAC16/24, source/44.1/48 kHz | codec/container/frame count/bit depth จริง; ไม่ใช้ extension เป็นหลักฐาน |
| Lossless / lossy | streamcopy audio packets, lossless เมื่อไม่มี resample/bit-depth change, การลด bit depth และ MP3 | ใช้ packet/hash หรือ PCM hash ตามชนิดงาน; lossy ไม่อ้างว่า PCM เท่าเดิม |
| Download | public authorized video เดี่ยว, Original จริง, conversion preset, unknown filesize, connection ขาด, unsupported/login/live/playlist, expired metadata, EJS runtime | source/output metadata + provider evidence ที่ระบุวันทดสอบ |
| Cancellation | inspect, download, encode, probe, save; worker สร้าง descendants; taskkill/helper failure; crash parent; app close | tree ไม่มี process ค้าง; ไม่ปลด lock ก่อนหยุด; cleanup-required เมื่อหยุดไม่ครบ |
| File preservation | output ชื่อซ้ำ,ไฟล์ใหม่เกิดระหว่าง save, cancel/error ไม่มี output-success, original hash unchanged, path ของงานเดิมไม่เปลี่ยน | source hashes + directory inventory; ไม่มี overwrite |
| Cleanup | ลบเฉพาะ job staging, staging ผ่าน junction, โฟลเดอร์ถูกเปลี่ยน, cleanup error, history clear | original และ successful outputs ยังอยู่ |
| Network boundary | Convert local/offline, UI ไม่มี remote request, Download ไม่มี ATL API/proxy/upload, release check ไม่มี source/job parameters | process-aware network capture; manifest/endpoints list; inspect + download + cancel ใช้ direct provider/CDN |
| UX | 360/768/1440px, keyboard, Thai wrapping, percent null, download100% แต่ยัง encoding, disk full, dependency missing, open file/folder ที่ถูกย้าย | 36 existing UI cases + native state screenshots |
| Packaging | portable on clean Windows x64 user, ไม่มี global Node/FFmpeg, path มีช่องว่าง/ภาษาไทย, app data พื้นที่เขียน, version/hash/NOTICE พร้อม | packaged smoke report + runtime manifest |

การตรวจ network ต้องดู worker processes ด้วย ไม่ใช่เฉพาะ request ของหน้า UI การพิสูจน์ no-media-through-server ต้องรวม metadata inspection, downloader/CDN, conversion และ retry เริ่มจาก provider ที่เลือกไว้เท่านั้น

ลำดับตรวจรับ: native bridge/picker → Convert → cleanup/no-overwrite → Download → network proof → portable package เครื่องสะอาด ไม่มี deploy website หรือ merge backend เป็นส่วนหนึ่งของงานนี้
