# Export / Download verification — 2026-10-01

## สรุป

แก้ Download ให้เป็น HTTP streaming จากไฟล์บน Modify ผ่าน Node proxy ไปยัง browser/OS download manager โดยตรง ไม่มีการ fetch ไฟล์ Export มาเป็น Blob ในหน้าเว็บ

ตรวจและแก้ใน `D:\Sites\Audio Tech Labs` บน branch `main` โดยรักษางานเดิมที่ยังไม่ commit ไว้ ผลด้านล่างมาจากบริการทดสอบแยกและบัญชีสังเคราะห์ ไม่ใช่การยืนยันว่า production process โหลดโค้ดใหม่แล้ว

## Root cause

- Frontend เดิมเรียก `apiFetch(f.url)` แล้ว `response.blob()` และสร้าง object URL: ต้องรับไฟล์ทั้งก้อนก่อนเริ่ม native download ใช้หน่วยความจำตามขนาดไฟล์ และการคลิกภายหลัง await อาจมีข้อจำกัดแตกต่างกันตาม browser
- Backend เดิม streaming อยู่แล้ว แต่ `Content-Disposition` ใส่ชื่อจริงใน `filename` โดยไม่มี UTF-8 `filename*`; ชื่อภาษาไทยอาจทำให้ Node ปฏิเสธ header
- แถวเดิมแสดงชื่อ/ขนาดโดยไม่มีข้อความ Download ชัดเจน
- Proxy เดิม pipe response อยู่แล้ว จึงไม่ใช่จุด buffer หลัก แต่ยังขาดการจัดการ upstream response error และการปิด response เมื่อ client ตัดการเชื่อมต่อ

## Architecture

```text
กดลิงก์ Download ในหน้าเดโม (native navigation, target=_blank)
  GET /api/download/{jobId}/{encodedFilename} + HttpOnly session cookie
    Node web server → ตัด /api แล้ว pipe ไป backend
      ตรวจ origin + session + ownership
      ตรวจ raw path, UUID, filename และ symlink/junction
      open file → fstat → fs.createReadStream → stream.pipeline
    proxy ส่ง Content-Type / Content-Length / Content-Disposition เดิม
  browser / OS download manager รับไฟล์
```

ใช้ `target="_blank" rel="noopener"` เพื่อคงหน้าเดโมไว้ แม้ browser แสดงข้อผิดพลาดหรือเปิด Files UI ในอีกแท็บ ไม่ใช้ `download` attribute เป็นเงื่อนไขหลัก การดาวน์โหลดแต่ละครั้งไม่ลบรายการ Export หรือแก้ session

ผล Export ยังใช้สัญญาเดิม: `jobId`, `success`, `failed`, `files[{name,size,url}]`; backend เติม `url=/download/...` หลัง worker สำเร็จ หน้าเว็บประกอบ URL จาก jobId/name เป็น same-origin `/api/download/...` เสมอ

## Security และขอบเขต

- ใช้ authentication เดิม: cookie `HttpOnly`, `SameSite=Strict`, `Secure` เมื่อผ่าน HTTPS; ไม่เพิ่ม token ใน URL
- Anonymous/invalid/revoked session → 401; foreign owner หรือไม่มีไฟล์ → 404; invalid path/encoding → 400; origin ที่ไม่อนุญาต → 403
- ใช้ directory `exports/{authenticatedUserId}/{jobId}` ไม่รับ owner ID จาก client และไม่เปิด exports เป็น static directory
- ปฏิเสธ slash/backslash, dot traversal, NUL/control/CRLF, quote, Windows ADS/colon และอักขระ path อันตราย; รับเฉพาะ WAV/FLAC
- ตรวจ directory และไฟล์ด้วย lstat เพื่อปฏิเสธ symlink/junction ที่ชี้ออกนอก export ของเจ้าของ
- Header ใช้ ASCII fallback ที่ปลอดภัย พร้อม `filename*=UTF-8''...`; ชื่อภาษาไทย ช่องว่าง apostrophe และ percent ผ่านการทดสอบ
- GET/HEAD ใช้ session เดิม ไม่ต้อง CSRF header; mutation routes ยังคงตรวจ CSRF ตามเดิม
- Backend หยุดอ่านไฟล์และปิด descriptor เมื่อ client ยกเลิก; proxy ส่งต่อโดยไม่รวบรวม body ทั้งก้อน
- ไม่เปลี่ยน Upload/Analyze/Export worker, auth policy, quota หรือ retention: ปัจจุบัน retention ใน source คือ **59 นาที**, cleanup ทุก 1 นาที แก้เฉพาะข้อความผล Export ที่ยังเขียนว่า 24 ชั่วโมงให้ตรงกับของจริง

## ไฟล์ที่แก้ในงานนี้

| ไฟล์ | สิ่งที่เปลี่ยน |
| --- | --- |
| `dist/demo/demo.js` | native download links, ข้อความ retention ให้ตรง backend |
| `dist/demo/demo.css` | แถวชื่อ/ขนาด/ปุ่ม Download, ปุ่มสูงอย่างน้อย 44 px, รองรับจอแคบ |
| `dist/demo/index.html` | คำแนะนำ Downloads/Files และ asset version |
| `server/download.cjs` (ใหม่) | authenticated streaming helper, validation, UTF-8 headers, HEAD, cleanup เมื่อยกเลิก |
| `server/upload-server.js` | เชื่อม download helper หลัง auth, เก็บ raw download path ก่อน URL normalization |
| `server/web-server.cjs` | จัดการ response error/disconnect โดยคง pipe และ headers |
| `server/download.test.cjs` (ใหม่) | endpoint ผ่าน proxy, สิทธิ์, bytes/headers, malformed paths, junction, backpressure/cancel, reload/logout |
| `server/security.test.cjs` | เพิ่ม Export จริงแบบ single WAV/FLAC และ multi FLAC พร้อมเทียบ bytes จาก disk |
| `server/web-server.test.cjs` | ตรวจ chunk แรกถึง client ก่อน upstream จบ และ headers ไม่เปลี่ยน |
| `tools/verify-download-browser.cjs` (ใหม่) | browser regression ผ่าน Chrome จริง โดยใช้ temporary storage/account และ audio worker จริง |
| `DOWNLOAD-VERIFICATION.md` (ใหม่) | รายงานและวิธีตรวจสอบนี้ |

ไฟล์อื่นที่ปรากฏใน git status เป็นงานเดิมก่อนเริ่มรอบนี้ ไม่ได้ commit/push หรือ restart production services

## ผลตรวจสอบ

- ก่อนแก้: suite เดิม **25/25 ผ่าน**
- หลังแก้: `node --test server/*.test.cjs tools/deployment.test.cjs` **34/34 ผ่าน**, ไม่มี fail/skip
- `node --check` สำหรับ demo.js, upload-server.js, web-server.cjs, download.cjs ผ่าน
- Chrome 154.0.8037.93 บน Windows แบบ headless: login → upload WAV → Analyze จริง → Export จริง → native Download สำเร็จ **5 ครั้ง** (single FLAC, single WAV, Track 01 → 02, ชื่อภาษาไทย fixture); ทุกไฟล์เทียบ bytes กับ disk แล้วตรงกัน
- Requests สำหรับดาวน์โหลดจากการคลิกเป็น `document` ทั้ง 5 ครั้ง ไม่มี fetch/xhr; filename ถูกต้อง, หน้าเดโมไม่เปลี่ยน, session ยังใช้ได้, reload ยังผ่าน auth
- Rendering ที่ 1440/768/390/320 px: ไม่มี horizontal overflow, ปุ่มสูง 44 px; ตรวจภาพ Desktop/Mobile แล้ว
- HTML/CSS โหลดครบและหน้า render ได้; ไม่พบ JavaScript page errors, missing script/stylesheet หรือ broken internal anchors ในหน้าเดโมที่ทดสอบ (ไม่ได้ใช้ standalone HTML/CSS validator)
- Streaming test ใช้ไฟล์ 32 MiB: client รับ chunk แรกก่อนอ่านไฟล์ครบ, เมื่อ pause ไม่อ่านทั้งไฟล์, cancel แล้ว stream ปิด; proxy test แยกยืนยัน chunk ผ่านก่อน upstream end
- `git diff --check` ผ่าน; มีเพียงคำเตือนการแปลง LF/CRLF ตาม Git configuration
- หลักฐาน browser อยู่ใน `.site-build/download-qa/result.json` และ `export-{1440,768,390,320}.png` (เป็น ignored test output)

รันซ้ำจาก repository:

```powershell
node --check dist/demo/demo.js
node --check server/download.cjs
node --check server/upload-server.js
node --check server/web-server.cjs
node --test server/*.test.cjs tools/deployment.test.cjs
git diff --check

# ใช้ Playwright ที่มีอยู่ในเครื่องนี้ ไม่ติดตั้ง dependency เพิ่ม
$env:NODE_PATH='C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tools/verify-download-browser.cjs
```

Browser test ใช้ Chrome ที่ติดตั้ง, Python environment และ audio worker ของ Audio Album Splitter AI ตาม configuration เดิม สามารถตั้ง `ATL_TEST_BROWSER=msedge` เพื่อใช้ Edge ที่ติดตั้งแทนได้

## ทดสอบจริงบนอุปกรณ์

หลังนำโค้ดเข้าใช้งานและ restart Node backend/proxy ในช่วงที่ไม่มีงานหรือ download ค้าง (restart ทำให้ session เดิมหมดอายุตามระบบเดิม) ให้ reload หน้าเว็บและ login ใหม่:

1. **Windows Chrome / macOS Chrome หรือ Safari:** Upload เสียง → Analyze → Export FLAC หนึ่ง Track → Download; ตรวจ Downloads ว่ามีไฟล์ เปิดเล่นได้ และชื่อ/extension ถูกต้อง ทำซ้ำ WAV แล้วแบ่งอย่างน้อย 2 Tracks โหลด Track 01 ตามด้วย 02
2. **Android Chrome บน Phone และ Tablet:** ทำขั้นตอนเดียวกัน เปิดรายการ Downloads ตรวจไฟล์จริงและเปิดเล่น กลับหน้าเดโมแล้วโหลด Track ถัดไปโดยไม่ต้อง login ใหม่
3. **iPhone/iPad Safari:** กด Download และยืนยันหาก OS ถาม ตรวจรายการดาวน์โหลด Safari หรือ Files ตามตำแหน่งที่ตั้งไว้ หากมีแท็บใหม่ให้กลับหน้าเดโมแล้วโหลด Track ต่อไป
4. ทดสอบไฟล์ชื่อมีช่องว่าง และทดสอบไฟล์ใหญ่ใกล้ 2 GB ผ่านเครือข่ายจริง ตรวจว่า download เริ่มได้ก่อนรับไฟล์ครบ หน้าเดโมยังตอบสนอง และเปิดไฟล์ที่โหลดเสร็จได้
5. Reload หน้าแล้วตรวจว่ายัง login อยู่; การ reload ไม่ได้กู้แถวผล Export กลับมาอัตโนมัติในรอบนี้ แต่ URL เดิมยังตรวจ session/ownership ทุกครั้งจนไฟล์หมดอายุหรือลบแล้ว
6. เปิด URL ใน private/incognito ที่ยังไม่ login → 401; ใช้บัญชีอื่น → 404; logout แล้ว URL เดิมต้องไม่ได้ไฟล์

## Limitations ที่ยังเหลือ

- ยังไม่ได้ทดสอบบน macOS, Android, iPhone หรือ iPad จริง; การย่อ viewport ใน Chrome ไม่ใช่การรับรอง Safari/iOS
- ยังไม่ได้ถ่ายโอนไฟล์ 2 GB ตลอดเส้นทาง production/tunnel; หลักฐาน streaming มาจาก source, gated proxy test และไฟล์ 32 MiB บน local integration
- ไม่เพิ่ม Range/resume ใน download endpoint รอบนี้ การขาดการเชื่อมต่ออาจต้องเริ่มดาวน์โหลดใหม่; proxy ยังคง idle timeout เดิม 120 วินาที
- หน้าเว็บไม่รู้ว่า OS บันทึกไฟล์สำเร็จหรือไม่ ให้ดูความคืบหน้า/ข้อผิดพลาดใน Downloads/Files ไม่แสดงคำกล่าวอ้างว่าโหลดสำเร็จจากการคลิกอย่างเดียว
- Session หมดอายุหรือไฟล์หมด retention จะตอบ 401/404 ในแท็บปลายทาง โดยหน้าเดโมและผลเดิมยังอยู่; login ใหม่หรือ Export ใหม่ตามกรณี
- การโหลดหน้าใหม่ยังไม่ restore รายการ Export ใน UI อัตโนมัติ และ Export worker ปัจจุบันตั้งชื่อ Track เป็น ASCII; Unicode ทดสอบด้วย fixture ที่ endpoint รองรับ
- ต้องโหลด backend/proxy โค้ดใหม่นี้ใน process จริงก่อนถือว่าใช้งาน production แล้ว งานนี้ยังไม่ได้ restart, publish, commit หรือ push
