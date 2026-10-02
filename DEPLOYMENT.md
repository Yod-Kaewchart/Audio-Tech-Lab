# Audio Tech Labs: การเผยแพร่และ Web Demo

## ปลายทางที่ใช้งาน

- เว็บหลัก `https://audiotechlabs.com` ใช้ **GitHub Pages** ตามการยืนยันของเจ้าของโครงการ
- Source อยู่ที่ `dist/`; workflow `.github/workflows/deploy-pages.yml` สร้าง `.site-build/pages/` ก่อนเผยแพร่
- `.openai/hosting.json` เป็นการตั้งค่า Sites เดิม เก็บไว้เพื่อรักษาข้อมูล แต่ไม่ใช่ปลายทางเผยแพร่เว็บหลักใน workflow นี้
- ห้ามนำ `server/`, `uploads/`, `exports/`, `tools/runtime/`, `.env` หรือ credential ของ tunnel ใส่ Pages artifact

## เดโมถาวร

ปลายทางที่เตรียมรองรับคือ `https://demo.audiotechlabs.com/demo/`:

```text
GitHub Pages /demo/ → ลิงก์เข้า demo.audiotechlabs.com/demo/
Cloudflare Named Tunnel → http://127.0.0.1:8080
  /demo/* → dist/demo/*
  /api/*  → http://127.0.0.1:8787/*
```

คุกกี้ล็อกอินและ API อยู่บน origin เดียวกัน ไม่ต้องเปิด cross-origin cookies หรือสร้าง tunnel แยกไปพอร์ต 8787
พอร์ต 8080 และ 8787 รับเฉพาะ loopback ตามเดิม และต้องให้เครื่อง Modify เปิดทำงานเพื่อให้เดโมพร้อมใช้งาน

### เปิดใช้ครั้งแรก

1. ใช้ Named Tunnel เดิม `audio-tech-lab-modify` และ Windows service `Cloudflared` ที่ติดตั้งแล้ว ไม่ต้องสร้าง token หรือ connector เพิ่ม
2. เพิ่ม Published application route `demo.audiotechlabs.com` ไป `http://127.0.0.1:8080`; ตรวจ DNS ที่ Cloudflare สร้างให้
3. ตั้งค่า local ใน `tools/runtime/deployment.json` (ถูก gitignore):

```json
{"demoOrigin":"https://demo.audiotechlabs.com","tunnelMode":"external"}
```

4. เปิด PowerShell **Run as administrator** แล้วรันคำสั่งด้านล่าง สคริปต์ตรวจงานค้างก่อน restart และไม่หยุด Windows service `Cloudflared`:

```powershell
& 'D:\Sites\Audio Tech Labs\tools\start-web-demo.ps1' -Restart
```

5. ตรวจว่าไม่มีงานกำลังประมวลผลก่อน restart บริการ แล้วตรวจ `GET /api/health` บนโดเมนเดโม: ต้องเป็น JSON ที่มี `service=audio-tech-labs-demo`, `apiVersion=1`, `authentication=true`
6. `GET /api/auth/me` โดยไม่ส่ง cookie ต้องตอบ `401`; ทดสอบล็อกอิน อัปโหลด วิเคราะห์ Export และดาวน์โหลดด้วยบัญชีทดสอบ
7. ตั้ง GitHub repository variable **ATL_DEMO_ORIGIN** เป็น `https://demo.audiotechlabs.com` แล้วจึงเผยแพร่ Pages

ถ้ายังไม่ตั้ง repository variable หน้า `/demo/` บน Pages จะแสดงสถานะเตรียมบริการ ไม่มีฟอร์มอัปโหลดที่เรียก API ผิดปลายทาง
ถ้าตั้ง variable แล้วแต่ API ไม่ผ่าน health/auth check ตัว build จะหยุดก่อนเผยแพร่ แทนการสร้างลิงก์ไปบริการที่ยังไม่พร้อม
การตรวจนี้ยืนยันสถานะ ณ เวลา build เท่านั้น ไม่รับประกัน uptime ของเครื่อง Modify หลังจากนั้น

Supervisor เปิดเฉพาะบริการ local เมื่อไม่ตั้งค่า tunnel. Quick Tunnel ใช้ได้เมื่อกำหนด `ATL_ALLOW_QUICK_TUNNEL=1` สำหรับพัฒนาเท่านั้น และไม่สามารถใช้ร่วมกับ production origin ได้
กรณีเครื่องอื่นไม่มี service เดิม สามารถใช้ `ATL_TUNNEL_CONFIG` ตาม `tools/cloudflared.example.yml` แทน external mode ได้; เก็บ credentials นอก source และไม่ commit

## โควตาพื้นที่ (GB ฐาน 1,000)

| Environment | ค่าเริ่มต้น | ความหมาย |
| --- | ---: | --- |
| `ATL_USER_STORAGE_GB` | 10 | พื้นที่ไฟล์อัปโหลดและ Export รวมต่อบัญชี |
| `ATL_TOTAL_STORAGE_GB` | 100 | พื้นที่รวมทุกบัญชี |
| `ATL_MIN_FREE_GB` | 5 | พื้นที่ดิสก์ที่กันไว้ ไม่รับงานที่จะใช้ส่วนนี้ |
| `ATL_MAX_EXPORT_GB` | 4 | งบพื้นที่สูงสุดต่อ Export หนึ่งงาน |

ระบบนับไฟล์ที่มีอยู่จริงและจองพื้นที่ส่วนที่ยังไม่ได้รับของ upload ที่ค้างอยู่ ตรวจซ้ำก่อนเขียนแต่ละ chunk
Export จองพื้นที่ก่อนเริ่ม worker และประเมินขนาดจาก metadata เสียงแบบเผื่อ 64-bit PCM และส่วนหัวไฟล์ ก่อนสร้าง output
การจองของ Export ใช้แบบ conservative ระหว่างงาน: พื้นที่ที่กำลังเขียนอาจถูกนับซ้ำจนงานจบ เพื่อไม่ให้ upload อื่นแย่งพื้นที่
งานที่ถูกปฏิเสธจะไม่ลบไฟล์เดิม บัญชีที่ใช้เกินโควตายังดาวน์โหลดและลบไฟล์ของตนเองได้
การเปลี่ยนโควตาต้อง restart backend; การตรวจดิสก์ไม่สามารถกันโปรแกรมอื่นบนเครื่องใช้พื้นที่ระหว่าง Export ได้
ไฟล์อัปโหลดและ Export ยังคงหมดอายุหลัง 24 ชั่วโมงตามรอบ cleanup เดิม ซึ่งทำงานทุกชั่วโมง

## ตรวจสอบก่อนเผยแพร่

```powershell
& 'C:\Program Files\nodejs\node.exe' --test server/*.test.cjs tools/deployment.test.cjs
& 'C:\Program Files\nodejs\node.exe' tools/build-pages.cjs
git diff --check
```

ตรวจหน้าแรก Desktop/Mobile, เมนู, anchor, ภาพโปร่งใส และหน้า demo ทั้งกรณีพร้อม/ไม่พร้อม
Pages เผยแพร่เมื่อ push ไป `main` หรือสั่ง workflow; ขออนุมัติ commit/push ก่อนส่งงานขึ้น remote
rollback ด้วย commit ที่ผ่านการตรวจสอบก่อนหน้า แล้วรัน workflow เดิม; ไม่แก้หรือลบข้อมูลผู้ใช้เพื่อ rollback เว็บ
