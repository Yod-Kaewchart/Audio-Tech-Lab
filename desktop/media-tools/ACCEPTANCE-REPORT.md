# Media Tools internal acceptance — 8 October 2026

## สถานะส่งมอบ

Convert เชื่อมและตรวจด้วยไฟล์จริงแล้ว Download เชื่อมกับ yt-dlp จริงตาม provider policy แต่ยังไม่มีลิงก์ที่ได้รับอนุญาตสำหรับ live acceptance จึง **ไม่อ้างว่าดาวน์โหลดจาก YouTube ผ่านแล้ว** ไม่มีการใช้ mock/UI แทนหลักฐาน provider

## ผลที่ผ่าน

| ชุดตรวจ | หลักฐาน / ขอบเขต |
| --- | --- |
| Dependencies | publisher checksums ก่อนใช้, executable hashes, versions, notices, Node แยกสำหรับ EJS |
| Conversion | 22 presets จริง: MP3 4 bitrate + WAV/FLAC/ALAC × 16/24 bit × source/44.1/48 kHz; probe codec/container/duration/bit-depth และ MP3 bitrate |
| Lossless | PCM SHA256 ตรงต้นทางเมื่อไม่มีการ resample; ไม่ใช้ PCM equality อ้างความเท่ากันของ MP3 |
| Inputs | WAV/FLAC/ALAC/MP3 จริง, invalid WAV, indirect manifest, ชื่อไทย, source identity เปลี่ยน |
| File preservation | source SHA256 ไม่เปลี่ยน; output ชื่อชนและ writer สร้างชื่อเดียวกันก่อน commit จริงไม่ถูกเขียนทับ |
| Native picker | เลือก WAV ภาษาไทยและโฟลเดอร์จาก Windows dialogs จริง → FFprobe → Convert → สำเร็จ; เปิด Explorer ไปยังผลลัพธ์จริง |
| Single job / UI | IPC จริง, งานกลางข้ามหน้าและ reload, cancel real FFmpeg, Start ซ้ำคืน job เดิม, ไม่มี bridge แล้วไม่ fallback demo |
| Security | sandbox/contextIsolation เปิด, nodeIntegration ปิด, strict sender/main-frame/DTO; path/argv ที่ไม่ได้กำหนดถูกปฏิเสธ; checksum missing/empty/ผิดปิด readiness |
| Cancellation | FFmpeg ที่กำลังอ่านจริงถูกยกเลิก; helper ยืนยัน treeEmpty ก่อนปลด lock; parent crash ฆ่า root+grandchild จริง |
| Cleanup | fault injection สำหรับ cleanup/helper acknowledgment failure เก็บ lock และ staging; source-probe cleanup failure ปิดงานใหม่; restart ไม่มี auto-resume |
| Destination | junction จริงถูกปฏิเสธ; โฟลเดอร์ย้ายถูกปฏิเสธ; Windows ACL deny-write จริงถูกปฏิเสธและคืน ACL หลังตรวจ; NO_SPACE ตรวจด้วย fault injection |
| UX | 36 native view status/viewport cases ที่ 360/768/1440px; keyboard skip-link และ IPC หลัง hash navigation; synthetic DTOs ใช้ตรวจ geometry เท่านั้น |
| Renderer network | ไม่พบ remote requests; CSP connect-src none และ local custom protocol ไม่เปิด HTTP media service |
| Worker network | GetExtendedTcpTable/GetExtendedUdpTable IPv4/IPv6 แยก PID ของ helper/FFprobe/FFmpeg ขณะ Convert จริง ไม่พบ connection; เป็น socket sampling 50ms ไม่ใช่ full ETW/packet capture |
| Portable | เปิด executable ใน release จริง (`app.isPackaged=true`, DevTools ปิด), จำกัด PATH เหลือ Windows System32; แปลง WAV ชื่อไทยเป็น ALAC จริงและ source SHA256 ไม่เปลี่ยน; Node CLI/yt-dlp ที่บรรจุมารายงานรุ่นถูกต้อง; ทั้งสองหน้าที่ 360/768/1440px ไม่ล้น |

## หลักฐานในโครงการ

- `test-output/acceptance-1791438285254/results.json` — real media matrix, probe output, source hashes, process events
- `test-output/ui-acceptance-1791438957419/results.json` และ `no-bridge.json` — Electron bridge/UI; ภาพ geometry แต่ละขนาด
- `test-output/lifecycle-1791439046142/results.json` — helper/parent crash, moved result/folder, junction, cleanup
- `test-output/network-1791439119867/result.json` และ `network.json` — real Convert + PID-aware socket sampling
- `evidence/native-picker-convert-success.png`, `evidence/native-picker-job.json` — เส้นทาง Windows picker → real output
- `dependencies.lock.json`, `package-lock.json` — versions/checksums
- `evidence/portable-smoke.json` — portable ผ่านเมื่อ 8 October 2026 พร้อม runtime paths, capabilities, output metadata และ geometry; picker responses ในชุดนี้เป็น test substitution ส่วน Windows dialogs จริงมีหลักฐานแยกข้างต้น
- `evidence/media-acceptance.json`, `ui-acceptance.json`, `lifecycle-acceptance.json`, `network-convert.json`, `network-samples.json`, `no-bridge.json` — สำเนาสรุปหลักฐานสำหรับส่งมอบ รวมใน ZIP โดยไม่มีไฟล์สื่อทดสอบ

ผล test-output แยกจากไฟล์ผู้ใช้และไม่รวม media fixtures ใน portable ZIP

## แก้การวางลิงก์ — 8 ตุลาคม 2026

- เพิ่มปุ่ม **วางลิงก์** ใน Download Audio และเมนูคลิกขวา **วาง** สำหรับช่องข้อความ; Ctrl+V ใช้คำสั่งวางของ Windows ตามเดิม
- native paste รับคำขอจาก main frame ที่อนุญาตเท่านั้น และวางได้เฉพาะช่อง URL ที่มี focus และไม่ถูกปิดใช้งานในหน้า Download; ไม่คืนข้อมูลคลิปบอร์ดผ่าน IPC
- `test/paste-ui.cjs` ตรวจ Ctrl+V, ปุ่มวางที่แทนข้อความเดิม, context-menu handler และการเรียก paste role ที่สร้างจริง; การเลือกเมนูด้วยเมาส์บนเมนู Windows ไม่ได้เป็นส่วนของชุดอัตโนมัตินี้
- ทั้งสองหน้าที่ 360/768/1440px ไม่ล้น, sandbox/context isolation คงเดิม, renderer ไม่มี remote requests และไม่มีการเรียก inspect/download กับ provider
- ชุดตรวจครั้งสุดท้ายอ่านคลิปบอร์ดโดยไม่แก้ค่า; ไม่เก็บข้อมูลคลิปบอร์ดในรายงานหรือรูปภาพ ผลนี้ยืนยันการวางลิงก์ ไม่ทดแทน live YouTube acceptance

## เงื่อนไขการเลือกรูปแบบเสียง — 8 ตุลาคม 2026

หน้า Download เริ่มโดยไม่เลือก radio ล่วงหน้า ปุ่มเริ่มและลองใหม่ต้องมีรูปแบบที่ผู้ใช้เลือก พร้อมต้นทาง/ปลายทางและ readiness; handler ฝั่งหน้าจอป้องกันการส่งงานเมื่อไม่เลือกรูปแบบด้วย ส่วน native validation เดิมปฏิเสธ encoding ที่ว่างอยู่แล้ว

`test/format-selection-ui.cjs` ตรวจสถานะเริ่มต้น, ต้นทาง/โฟลเดอร์พร้อมแต่ยังไม่เลือกรูปแบบ, การ dispatch click ข้ามปุ่ม disabled, การเลือกครบห้ารูปแบบและ encoding ที่ส่ง, reload และค่าเริ่มต้น FLAC ของ Convert ชุดตรวจใช้ต้นทาง/การรับงานจำลองเพื่อทดสอบเงื่อนไขหน้าจอเท่านั้น ไม่ติดต่อ provider หรือสร้างไฟล์สื่อ

## ยังไม่ผ่านการตรวจรับภายนอก

1. Authorized live YouTube: inspect / Original / conversion preset / connection loss / download cancel / EJS runtime กับ provider จริง ยังไม่มีลิงก์ทดสอบที่ได้รับอนุญาต
2. Process-aware network capture ครบ inspect/download/cancel/retry/CDN และ full ETW/packet capture; socket sampling ของ Convert ไม่ทดแทนหลักฐานนี้
3. Windows x64 VM/user ที่สะอาดจริง ไม่มี global Node/FFmpeg; portable smoke ที่จำกัด PATH บนเครื่องพัฒนามีขอบเขตเล็กกว่า
4. อุปกรณ์ปลายทางหลุดจริง, disk-full ระหว่างทุกขั้นตอน, cancellation ระหว่าง atomic commit (หลังเข้า saving ไม่รับ cancel เพื่อป้องกันผลลัพธ์กึ่งสำเร็จ), app-close ทุก timing และ adversarial file races นอกชุดที่ทดสอบ
5. Signing/SmartScreen, clean-room installer/portable distribution, license/source-distribution review ก่อนเผยแพร่

ไม่มีการเปลี่ยน Home, backend, credentials, tunnel, deployment และไม่มีการเผยแพร่แพ็กเกจหรือเว็บไซต์
