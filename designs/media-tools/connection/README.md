# Media Tools — Local connection readiness

สำรวจและเตรียมแบบ 8 ตุลาคม 2026 (Asia/Bangkok)

**สถานะ: พร้อมเสนอแบบและเริ่มพัฒนาการเชื่อมต่อหลังผู้ใช้สั่งต่อ ยังไม่ใช่ระบบที่เชื่อมแล้วหรือพร้อมแจกใช้งานจริง** รอบนี้จัดทำเอกสาร สัญญาการเชื่อมต่อ รายการ dependency และเกณฑ์ทดสอบ ไม่ติดตั้งเครื่องมือ ไม่เรียก provider ไม่ดาวน์โหลด/แปลงสื่อ ไม่แก้หน้า UI เดิมหรือบริการ production

## ข้อกำหนดที่ยึดถือ

- ใช้ Download Audio และ Convert Audio เดิม ฟอนต์และสี Home เดิม
- ผู้ใช้เลือกไฟล์และโฟลเดอร์ด้วย Windows ทุกไฟล์อยู่ในเครื่องผู้ใช้
- รับสื่อจากต้นทางลงเครื่องผู้ใช้โดยตรง FFmpeg / FFprobe ทำงานในเครื่องเดียวกัน
- ไม่มี media API, upload, proxy, telemetry หรือบัญชี/ประวัติบน Server ของ Audio Tech Labs สำหรับเครื่องมือนี้
- หนึ่งงานปัจจุบันรวมทั้งสองหน้า ไม่มีคิวหลายงาน ไม่เริ่มงานซ้ำเมื่อสลับหน้า
- ผลลัพธ์ไม่หมดอายุ ไม่ลบเอง ไม่เขียนทับไฟล์เดิม

## ข้อเสนอสำหรับเชื่อมหน้าจอ

ใช้ **แอป Windows x64 ที่บรรจุหน้าจอ HTML/CSS/JavaScript เดิมด้วย Electron** และเปิด native bridge เฉพาะคำสั่งที่กำหนดไว้ใน `bridge-contract.d.ts` วิธีนี้ใช้หน้าจอเดิมได้และไม่ต้องมี HTTP listener หรือ companion port บนเครื่องผู้ใช้

```text
หน้าจอ Download / Convert (local assets + fonts)
    ↓ คำสั่งเฉพาะผ่าน preload bridge
Electron main process (validate, native picker, one active job)
    ↓ argument arrays / local worker
yt-dlp.exe → local staging → FFmpeg / FFprobe → selected folder
    ↑ status events                         ↑ open folder/file
```

หน้าจอสำเร็จจึงอ้างถึงไฟล์ที่บันทึกลงเครื่องแล้ว ไม่ใช่ลิงก์ดาวน์โหลดจาก Server เว็บไซต์ Audio Tech Labs ใช้เป็นหน้าข้อมูล/ดาวน์โหลดตัวโปรแกรมแยกจากงานสื่อ

Electron เป็นข้อเสนอที่ยังรอคำสั่งให้พัฒนา ข้อแลกเปลี่ยนคือแพ็กเกจรวม Chromium จึงใหญ่กว่าบางแนวทางที่ใช้ WebView2 แต่ใช้ JavaScript เดิมและไม่ต้องติดตั้ง .NET SDK / Rust บนเครื่องพัฒนานี้ ส่วน WebView2 หรือ browser + companion เป็นทางเลือกในอนาคต ไม่พัฒนาพร้อมกันในรุ่นแรก

## ผลสำรวจจริง

| รายการ | หลักฐานที่ตรวจ | สถานะ |
| --- | --- | --- |
| สองหน้า UI | `download.html`, `convert.html`, `media-tools.js`, CSS และ local fonts | ใช้ต่อได้; ฟังก์ชันสื่อยังเป็น simulation |
| Node บนเครื่องพัฒนา | `node --version`: v24.19.0 | ใช้พัฒนาได้; ไม่ถือว่าเครื่องผู้ใช้มี Node |
| FFmpeg / FFprobe | version 9.0.2 essentials จาก audio-core tools; สั่ง version/encoders เท่านั้น | พบและ probe ได้ ใช้เป็น dev reference; ไม่ใช่ dependency ที่ package แล้ว |
| Encoder | libmp3lame, pcm_s16le, pcm_s24le, flac, alac | รูปแบบที่ UI เสนอมี encoder ใน build ที่ตรวจ |
| yt-dlp executable | ไม่พบใน PATH; `D:/Projects/Audio Album Splitter AI/tools/yt-dlp` เป็นไฟล์ 0 bytes | ยังไม่พร้อม ไม่ใช่ executable |
| Electron | ไม่พบใน dependency workspace ที่ตรวจ | ต้องติดตั้งในขั้นพัฒนาหลังสั่งต่อ |
| .NET / Rust | .NET runtime 7.0.7 มี แต่ `dotnet --list-sdks` ว่าง; ไม่พบ rustc/cargo ใน PATH | ไม่เลือกเป็น toolchain รุ่นแรก |
| Prototype browser checks | ตรวจใหม่ 36 viewport/state cases + interaction/keyboard | หลักฐานอยู่ใน `tools/runtime/media-connection-readiness/ui-qa/results.json` |

การสำรวจนี้ครอบคลุมเครื่องพัฒนาและตำแหน่งที่ระบุ ไม่ใช่การตรวจเครื่องผู้ใช้ทุกคน และไม่ค้นหาดิสก์ทั้งหมด ผู้ใช้ปลายทางต้องตรวจ readiness ในแอปแต่ละครั้ง

## จุดที่ต้องเปลี่ยนเมื่อได้รับคำสั่งให้พัฒนา

| UI ปัจจุบัน | การเชื่อมจริงที่ออกแบบ |
| --- | --- |
| `sample()`, `checked=true` ตอนเริ่ม | เริ่มว่างและ disabled จนมี source ที่ native ตรวจผ่าน |
| `#check-link` + timeout | `inspectUrl`; bind request ID, cancel และทิ้งคำตอบเก่าหาก URL เปลี่ยน |
| `#pick-file` + browser File.name/size | `chooseInputFile` native; native probe เนื้อหาและคืน token + metadata |
| `#pick-folder` สลับ path สมมติ | `chooseOutputDirectory`; native คืน token และ display path หลังตรวจสิทธิ์เขียน |
| `capture()` สร้างชื่อ/codec/container จาก preset | native สร้างผลลัพธ์จากไฟล์จริง; Original Audio ไม่ hardcode .webm หรือ Opus |
| `start()` / interval 650ms | `startDownload` / `startConvert`; progress มาจาก worker เท่านั้น |
| `#cancel` | `cancelJob` และรอ process tree หยุดก่อนแสดง cancelled |
| `#retry` | เริ่มงานใหม่และตรวจ source/folder อีกครั้ง ไม่แก้ประวัติงานเก่า |
| `#open-folder`, `#open-file` | `openResult(resultId, target)` ตรวจผลลัพธ์ยังอยู่ แล้วเปิดในเครื่อง |
| `#preview-state` และข้อความตัวอย่าง | อยู่เฉพาะ demo mode; ไม่มีใน production build |
| สลับหน้า download/convert | `getCurrentJob` คืน snapshot + subscribe events ใหม่; main process เก็บ job กลาง |

ห้ามเชื่อม native แบบเพิ่ม event listener ทับ simulation เดิม เพราะจะเกิดการเรียกสองครั้ง แยก view/controller ออกจาก `DemoAdapter` / `NativeAdapter` ให้ชัดเจนและเลือกได้เพียงตัวเดียว ไม่เปิด demo อัตโนมัติเมื่อ bridge หาย

ส่วนโลโก้ที่ปัจจุบันชี้ `../../dist/index.html` ต้องปรับเป็นข้อมูลแอปหรือเปิด Home ในเบราว์เซอร์ภายนอกเมื่อผู้ใช้กด โดยไม่ส่ง URL ต้นทาง/ชื่อไฟล์ไปด้วย หน้าจอ remote ห้ามโหลดแทนหน้าจอ local ที่มี bridge

## การเรียก executable

แยกงาน Download เป็นอ่าน metadata → รับ audio stream → probe → convert เมื่อเลือก preset → probe output → publish local result ส่วน Convert เป็น native input → probe → convert → probe output → publish

- ทุกคำสั่งใช้ executable path จาก dependency ที่ตรวจแล้ว + argument array, `shell:false`, `windowsHide:true` ไม่รับ command line / executable / output path โดยตรงจาก renderer
- yt-dlp ใช้ JSON metadata และ structured progress ไม่ parse console ปกติ; ปิด config/plugin/remote component ที่ไม่ได้ควบคุม ตาม command plan
- รุ่นแรกเสนอ public YouTube video เดี่ยว รับ `youtube.com/watch`, `youtu.be`, shorts ผ่าน canonicalizer ที่ main; playlist-only, live, login-required, cookies และ DRM ไม่อยู่ในรุ่นแรก provider allowlist ต้องผ่านการตรวจรับจริงก่อนประกาศรองรับ
- ใช้ Node executable แยกที่ pin รุ่นสำหรับ EJS; ไม่สมมติว่า electron.exe เป็น Node CLI แทนกันได้ และไม่สมมติว่า Electron main runtime ถูกค้นพบโดย yt-dlp
- Download ต้องอ้าง `sourceId` ที่ main ตรวจแล้ว metadata อาจหมดอายุ ต้อง refresh ใน native ก่อนทำงานจริงและตรวจว่าเป็นรายการเดียว
- Original Audio เก็บ codec/container ต้นทางที่ตรวจจริง ไม่ convert เพื่อบังคับ extension
- FFmpeg รับ input ในเครื่องเท่านั้น ปิด stdin, ห้าม overwrite, map audio stream ชัดเจน; FFmpeg / FFprobe ห้ามเปิด network protocol สำหรับงาน Convert; ปฏิเสธ playlist/manifest ที่อ้าง resource อื่นและ protocol/path ที่ไม่ได้เลือก
- MP3 ใช้ libmp3lame ตาม bitrate; WAV PCM16/PCM24; FLAC และ ALAC เลือก sample representation ที่ encoder รองรับจริง แล้ว probe `bits_per_raw_sample` แทนการกล่าวว่าปลายทางเป็น 24 bit จากชื่อ preset อย่างเดียว

ตัวอย่าง argv ใน `command-plan.json` เป็นแบบให้ reviewer ตรวจ ไม่ใช่ runner หรือคำสั่งที่ execute แล้ว ต้องยืนยันกับ executable รุ่นที่ติดตั้งในขั้นพัฒนาจริง

## สถานะและการหยุดงาน

main process เป็นเจ้าของ job และ global lock ทั้งสองหน้า Native สร้าง jobId, sourceId, folderId และ resultId แบบ opaque; renderer ไม่ส่ง path สำหรับเปิด/ลบ/เขียนไฟล์เอง

Progress มี stage + stagePercent โดยค่าที่ไม่ทราบเป็น null ไม่สร้าง ETA หรือเปอร์เซ็นต์รวมปลอม ดาวน์โหลดครบ 100% ยังไม่เป็น succeeded จน output probe และการบันทึกเสร็จ Event มี sequence number เพื่อไม่ให้คำตอบเก่าทับสถานะล่าสุด

Cancel ต้องหยุด child tree รวม FFmpeg/EJS ที่อาจถูก yt-dlp เรียก เก็บ process handles และใช้ Windows Job Object/helper ที่ตรวจรับแล้ว ไม่ใช้ PID ที่อ่านจากหน้า UI ไม่มีการแจ้ง cancelled ก่อนหยุดครบ หากหยุดหรือ cleanup ไม่ได้ให้สถานะ `cleanup-required` และล็อก Start แสดงตำแหน่ง staging เพื่อให้ผู้ใช้ตรวจ โดยไม่ลบผลลัพธ์สำเร็จ

ก่อนปิดหน้าต่างให้เลือกทำงานต่อหรือยกเลิกและรอหยุด เมื่อ crash/restart งานที่ยัง active เป็น interrupted ไม่ resume network หรือเริ่มซ้ำอัตโนมัติ Job Object ต้องถูกสร้างและ attach แบบไม่ปล่อยให้ process สร้าง descendants ก่อนถูกควบคุม (เช่น helper เริ่ม suspended แล้ว assign ก่อน resume)

## บันทึกไฟล์และขอบเขตข้อมูล

- Resolve Downloads จาก Windows known folder/native app API ไม่ hardcodeชื่อผู้ใช้ และให้เลือกใหม่ได้
- main ตรวจ canonical path, junction/symlink และ file identity เฉพาะ source/folder ที่ผู้ใช้เลือก ตรวจใหม่ก่อนใช้งาน ไฟล์ต้นฉบับไม่เปลี่ยนและไม่ลบ
- staging เฉพาะ job อยู่ในโฟลเดอร์ปลายทางที่เลือก เพื่อตรวจพื้นที่และบันทึกบน volume เดียวกัน ชื่อ staging สร้างจาก ID ไม่ใช้ title ต้นทาง
- จองชื่อผลลัพธ์ไม่ชนแบบ exclusive ไม่ใช้การตรวจ exists แล้ว rename ที่อาจ overwrite ไฟล์ซึ่งเพิ่งเกิดระหว่างทาง หากชนเลือก suffix ใหม่ด้วยขั้นตอนแบบ no-clobber
- Probe exit code, จำนวน audio streams, codec/container, duration และ sample information ผ่านแล้วจึง publish; stage output ไม่แสดงในผลสำเร็จ
- Cleanup ลบได้เฉพาะ staging/job-owned files ภายใต้ resolved selected directory ห้าม recursive delete จาก path ที่ renderer ส่ง ไม่มี auto-delete output หรือ source
- เก็บ last folder และ job snapshot เท่าที่จำเป็นใน app data ของ Windows user; ไม่ sync server และไม่บันทึก URL ที่มี token ลง log โดยปริยาย
- UI assets/font โหลด local, renderer `connect-src 'none'`, network ของงานสื่อมาจาก yt-dlp ในเครื่องผู้ใช้ Update/release เป็นช่องทางแยกที่ไม่แนบ source/job data

## Packaging ที่เตรียมไว้

แยกโค้ดจริงภายหลังไว้ `desktop/media-tools/` ไม่เพิ่ม media routes ใน `server/`, `functions/` หรือ proxy ปัจจุบัน Pin dependency/lockfile, package local UI + font licenses, yt-dlp.exe + EJS ที่รวมมา, FFmpeg/FFprobe build, Node CLI และ Windows process helper แยกจาก ASAR พร้อม version/hash manifest ตรวจ integrity ก่อน spawn

เปิด sandbox/context isolation, ปิด nodeIntegration, expose method ละหนึ่งคำสั่งผ่าน preload; ตรวจ sender เฉพาะ main frame ของ `atl-media://app/` เสิร์ฟ local UI ผ่าน custom protocol ที่ map เฉพาะ assets ห้าม navigation/window-open ไป remote ในหน้าต่างนี้ เปิดเว็บไซต์ภายนอกผ่าน allowlist หลัง user click เท่านั้น

แพ็กเกจทดสอบเป็น portable Windows x64 ก่อน installer/signing ในงาน release ไม่ต้อง admin ในการอ่านไฟล์และใช้งานโฟลเดอร์ของผู้ใช้ ไม่มีการรัน source project ในเครื่องของผู้ใช้ปลายทาง

Candidate dependency versions แสดงใน `dependencies.plan.json` พร้อมช่อง checksum ที่ยังว่างโดยตั้งใจ ต้องยืนยัน hash/NOTICE และการทดสอบก่อนเปลี่ยนสถานะเป็น verified manifest ห้ามอ่าน plan นี้เป็น production readiness

## งานถัดไปหลังได้รับคำสั่ง

1. ติดตั้ง Electron ในโครงการ desktop แยก และเตรียม dependency ที่ pin รุ่นพร้อม checksum โดยไม่เปลี่ยน tools ของ audio backend เดิม
2. ทำ shell + native picker + bridge, เปลี่ยนตัวควบคุม UI ให้ใช้ adapter, ตรวจ runtime unavailable และการสลับหน้าก่อน
3. เชื่อม Convert ก่อน: fixture WAV/FLAC/ALAC/MP3, output folder, stage progress, cancellation, probe และ no-overwrite
4. เชื่อม Download: inspection, canonical URL/provider policy, EJS, Original และ preset พร้อม authorized live sample หนึ่งรายการ
5. ตรวจ acceptance matrix และ network evidence ว่าไม่มีสื่อ/ลิงก์/job ไป Audio Tech Labs ก่อนแจกแอปจริง

## แหล่งอ้างอิงที่ตรวจระหว่างออกแบบ

- [Electron isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [security/IPC sender/custom protocol](https://www.electronjs.org/docs/latest/tutorial/security), [native dialog](https://www.electronjs.org/docs/latest/api/dialog), [local shell actions](https://www.electronjs.org/docs/latest/api/shell)
- [yt-dlp structured output and options](https://github.com/yt-dlp/yt-dlp), [EJS and Node setup](https://github.com/yt-dlp/yt-dlp/wiki/EJS)
- [FFmpeg progress/encoding](https://ffmpeg.org/ffmpeg.html), [FFmpeg formats](https://ffmpeg.org/ffmpeg-formats.html), [Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
- Candidate releases: [Electron 44.7.0](https://github.com/electron/electron/releases/tag/v44.7.0), [yt-dlp 2026.08.19](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19); packaging notices ดู release bundle และ [FFmpeg build license](https://ffmpeg.org/legal.html)
