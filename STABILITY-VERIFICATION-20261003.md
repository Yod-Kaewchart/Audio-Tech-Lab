# ผลตรวจ Cloudflare Pages + EliteBook — 3 ตุลาคม 2026

ตรวจใน `D:\Sites\Audio Tech Labs` โดยใช้ระบบเดิม ไม่มีการติดตั้งหรือย้าย hosting/tunnel ซ้ำ ไม่ shutdown/reboot เครื่อง

## สภาพก่อนแก้

- Branch `main`, HEAD `05e989251ac9a9263504f441d906b27d32312e10`, working tree สะอาด และ remote ตรงกัน ไม่พบ AGENTS.md ในโปรเจกต์หรือ ancestor ที่ตรวจ
- Pages project `audio-tech-lab` เชื่อม GitHub repository เดิมและ deploy main อัตโนมัติ; Pages check เดิมผ่าน แต่ GitHub validation เดิมล้มเหลว
- `demo.audiotechlabs.com/api/*` ผ่าน Pages Function ไป `backend.audiotechlabs.com/*` และ Cloudflared ไป loopback 8787; health ทั้งสามเส้นทางตอบ instance `elitebook` ตรงกัน
- ไม่มี listener 8080 ใน Pages mode เป็นพฤติกรรมที่ถูกต้อง
- Backend task เป็น AtLogon / Interactive / Limited ใต้บัญชี EliteBook; Cloudflared เป็น Automatic service / LocalSystem
- Runtime ACL จำกัด SYSTEM, Administrators และ ELITEBOOK\EliteBook อยู่แล้ว
- ก่อนหยุด production ตรวจพบ queued/running = 0 และไม่มี `.part` upload; ไม่ตัดงานผู้ใช้
- เก็บ HEAD, deployment.json, task XML และ service recovery configuration ใน `tools/runtime/rollback-stability-20261003/`

## ปัญหาและสิ่งที่แก้

1. สถานะ ONLINE เดิมไม่มีอายุสูงสุดก่อนส่ง Login/API → revalidate หลัง 20 วินาที และป้องกันคำตอบ Health เก่าหลัง offline event
2. การส่งฟอร์มซ้ำ/Enter และ finally อาจเปิดปุ่มผิดสถานะ → single-flight guards, ปิดปุ่มใน HTML ตั้งแต่ CHECKING, sync ตามสถานะและ pending request
3. Reconnect ล้างข้อความรหัสผ่านผิด → รักษาข้อความผู้ใช้ ล้างเฉพาะข้อความ connection ที่หมดความจำเป็น และตรวจ session อีกครั้งเมื่อกลับแท็บ
4. Split processing POST เดิมลองส่งใหม่อัตโนมัติ → ส่งครั้งเดียว; retry เฉพาะ GET ของงานที่มี job ID แล้ว
5. HTTP 5xx/HTML/network error ระหว่างทำงานไม่รวมกับสถานะกลาง → ใช้ตัวเรียก API ร่วมสำหรับ Login/Split/QC/Merge, แจ้งการหลุดและคงข้อมูลที่กู้คืนได้
6. Proxy timeout ครอบคลุมเฉพาะ headers → ครอบคลุม body ของ Health ด้วย; ไม่สร้างผล ONLINE แทน backend
7. Mobile CSS เดิมซ่อนคำ ONLINE/OFFLINE → แสดงสถานะเต็ม โดยคง layout/font/ขนาดส่วนอื่นและเว็บหลัก
8. Startup ปกติอาจฆ่า orphan process และ restart ตรวจเฉพาะคิวจากไฟล์ → ปกติไม่ฆ่า orphan; guarded restart ใช้ maintenance เฉพาะ loopback ตรวจงาน/uploads/mutations และปิดรับ mutation ก่อนหยุด
9. Supervisor restart ทุก 10 วินาทีตลอด → เพิ่ม backoff ถึง 300 วินาทีสำหรับการล่มซ้ำ และ cleanup child เมื่อ supervisor exception
10. Linux CI เรียก Python ที่พาธ D:\ ของอีกโปรเจกต์ → แยก portable CI ออกจากสามชุดที่ต้องใช้ audio core; ชุดเต็มยังทดสอบจริงบน EliteBook

## ผลทดสอบ

| สิ่งที่ตรวจ | วิธีและผล |
| --- | --- |
| Production ONLINE → OFFLINE | หยุด Backend จริงผ่าน task/process ที่ตรวจ identity แล้ว; หน้าเดิมตรวจพบ OFFLINE ใน **14.900 วินาที**, Login disabled |
| หน้าใหม่/hard refresh ตอน Offline | Chrome ปิด cache ผ่าน CDP, โหลดหน้าใหม่และ reload จริง; Login disabled, CSS ทั้ง 7 stylesheet มี rules, mobile ไม่ล้น |
| Static routes ตอน Backend หยุด | `/`, `/demo/`, `/demo/qc/`, `/demo/merge/`, `/styles.css` ตอบ **200** ทั้งหมด; root ติดตาม redirect ไป demo |
| Health ตอน Backend หยุด | Public `/api/health` ตอบ **502**, no-store/no-cache; ไม่รายงาน ONLINE |
| Production OFFLINE → ONLINE | Start Scheduled Task เดิม; ทั้งหน้าเปิดค้างและหน้าเริ่มตอน Offline กลับมาเองโดยไม่ reload; Login เปิดใน **12.549 วินาที** |
| Backend process crash | หลัง maintenance ยืนยัน idle หยุดเฉพาะ process Backend; supervisor restart delay 10 วินาที; local health กลับใน **11.243 วินาที**, public UI ใน **13.486 วินาที** |
| Singleton | เรียก launcher ซ้ำ exit 0 และ supervisor PID ยังเป็น 15136; ไม่สร้าง instance ซ้อน |
| Main site ขณะ Backend หยุด | `www` โหลดภาพสำเร็จ, DM Sans/Noto Sans Thai loaded, ไม่มี failed network request; ไม่เปลี่ยน main site source |
| Maintenance exposure | Public `/api/internal/maintenance` ตอบ **403**; local endpoint ใช้งานได้; regression ยืนยัน busy upload ถูกปฏิเสธก่อน maintenance |
| Full regression | **109/109 ผ่าน**, 0 skipped บน EliteBook พร้อม Python/FFmpeg จริง |
| Audio pipeline | Upload chunk, Analyze, QC, preview/range, WAV/FLAC Export, Download, mixed-container Merge และ 50-track Merge; ตรวจ PCM/frame roundtrip จริงใน storage/account แยก |
| Browser audio regression | Chrome จริง 1440/1024/768/390/320 px; Login, Upload, Analyze, Play/seek, boundary edits, 10 Split downloads, Merge/reorder/download; ไม่มี page error/overflow |
| Fault simulations | Contract fields/nonce/API version/HTTP status/HTML/invalid JSON/network failure, fetch/body timeout และ late response: ทดสอบผ่าน VM/scheduler/network interception โดยใช้โค้ด production |
| Login/session browser regression | Login จริงบน backend แยก, submit ซ้ำส่งครั้งเดียว, Offline ระหว่าง Login/Enter guard, Health เก่าไม่ส่งรหัสผ่าน, เก็บข้อความรหัสผ่านผิด, เก็บ selection ตอน Offline, กลับแท็บแล้ว session หมดอายุให้ Login ใหม่ |
| หลุดระหว่าง Analyze | Backend แยกรับงานจริง; ตัดการอ่าน job และจำลอง Tunnel 502 ชั่วคราว; กลับมาอ่านสถานะเองจนได้ waveform โดยส่ง Analyze POST ครั้งเดียว |
| คำตอบหลังรับงานสูญหาย | ส่ง Analyze ถึง backend จริงและได้ 202 ภายใน test interception แล้วตัดคำตอบก่อนถึง browser; หลังกลับ Online ไม่มีการ replay POST |

ระยะเวลาข้างต้นเป็นค่าจากรอบที่วัด ไม่ใช่ SLA; phase ของ polling/network ทำให้รอบอื่นต่างกันได้

## Startup และข้อจำกัด

Cloudflared เริ่มแบบ Automatic service. Backend เริ่ม **หลัง Windows login** ผ่าน Scheduled Task → wscript → hidden PowerShell → supervisor → hidden backend. ทดสอบ Start Task จริงภายใน Windows session ปัจจุบัน ไม่ได้ทดสอบปิดเครื่องจริงหรือ boot/login ใหม่ จึงไม่อ้างว่า Backend เริ่มก่อน login

ทดสอบ Backend crash จริง แต่ Tunnel failure/timeout/ผล Health ผิดใช้การจำลอง ไม่ได้หยุด Cloudflared service. การทดสอบ Login และงานเสียงใช้บัญชี/ข้อมูลแยกบนเครื่องเดียวกัน ไม่ใช้บัญชีผู้ใช้จริงผ่านโดเมน production. Spotify/OpenAI regression ใช้ mock provider ไม่ได้ทดสอบ credential หรือเรียกบริการมีค่าใช้จ่ายจริง

Scheduled Task recovery เดิม retry supervisor failure สูงสุด 3 ครั้งห่างกันหนึ่งนาที. Backend child มี backoff และ logs; supervisor ที่ถูก force-kill จนเหลือ orphan ต้องตรวจซ่อมโดยผู้ดูแล—ระบบจะไม่ฆ่างานหรือสร้าง duplicate เพื่อกลบปัญหา

## Release และ rollback

Implementation commit: `ea74e7a341d0c95667d8e615da581564a430c74c`, push main สำเร็จ. Cloudflare deployment `fd60624c-feb4-4eda-a0c4-9844a079d81e` และ GitHub validation run `37117476661` **success**. Public JS รุ่น stability2 และ health nonce ได้รับการตรวจหลัง deploy; anonymous auth/me ตอบ 401 ตามคาด

วิธี rollback อยู่ใน [STABILITY.md](STABILITY.md): revert stability implementation ผ่าน Git โดยรักษางานอื่น แล้ว push workflow เดิม; ใช้ maintenance-capable backend หยุดเมื่อ idle ก่อนย้อน backend code. เก็บผู้ใช้/uploads/exportsไว้ ไม่ reset ข้อมูล. สำหรับ frontend-only ใช้ previous successful deployment ของ Pages เดิมได้

หลักฐานที่ไม่ commit (ไม่มี credential ผู้ใช้):

- `tools/runtime/public-stability/results.json` และภาพ public-offline-desktop/mobile, public-recovered, main-backend-offline
- `tools/runtime/stability-regression-final.log`
- `tools/runtime/stability-qa/results.json` และ screenshots
- `.site-build/split-qa/functional-results.json` และ screenshots
- `tools/runtime/backend-verification/latest.json`

รอบ browser test เพิ่มเติมผ่านทั้งหมดแล้ว รวม cleanup แบบ asynchronous เพื่อรอ worker/SQLite คืนทรัพยากรบน Windows. โฟลเดอร์จากรอบที่ cleanup ล้มเหลว `C:\Users\EliteBook\AppData\Local\Temp\atl-stability-7bo4Ue` ยังคงอยู่: automatic approval review ปฏิเสธคำสั่งลบโดยแจ้งเพียง `blocked by policy`; ไม่ได้ลองเลี่ยงข้อจำกัด และไม่มีผลกับ production หรือ Git status.
