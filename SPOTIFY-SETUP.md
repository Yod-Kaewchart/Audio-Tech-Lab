# Spotify Phase 1 บน Modify

## ตั้งค่า credentials

เปิด **Windows PowerShell → Run as administrator** ด้วยบัญชี **MODIFY\Admin** (ต้องเป็นบัญชีเดียวกับ backend) แล้วรัน:

```powershell
& "D:\Sites\Audio Tech Labs\tools\setup-spotify.ps1" -RestartBackend
```

กรอก Spotify Client ID และ Client Secret ที่ prompt เท่านั้น ไม่ใส่ Secret ใน command line, แชต, environment ตัวอย่าง หรือไฟล์ source
Secret จะถูกซ่อนขณะกรอก หากมีไฟล์เดิมต้องพิมพ์ `REPLACE` ก่อนเขียนทับ

ไฟล์จริงอยู่ที่ `%LOCALAPPDATA%\AudioTechLab\spotify.clixml`:

- สำหรับ MODIFY\Admin คือ `C:\Users\Admin\AppData\Local\AudioTechLab\spotify.clixml` อยู่นอก repository และ `dist/`
- Secret เข้ารหัสด้วย Windows DPAPI CurrentUser; ถอดรหัสได้ด้วยบัญชี Windows เดิมบนเครื่องเดิม
- ACL จำกัดเฉพาะเจ้าของและ SYSTEM; Client ID เป็น username ใน PSCredential จึงไม่ได้เข้ารหัส
- backend อ่านผ่าน PowerShell pipe ที่ไม่ส่ง stdout/stderr ของ helper ไป log; ห้ามเรียก `read-spotify-credentials.ps1` ตรงใน terminal เพราะเป็นตัวส่งข้อมูลภายในให้ backend
- ไม่เก็บ Spotify access/refresh token ลงไฟล์หรือ Git; tokens เดิมเก็บในหน่วยความจำและต้อง Connect ใหม่หลัง backend restart

## Startup / environment

เส้นทางเดิม: `tools/start-web-demo.ps1` → `tools/web-demo-supervisor.cjs` → `server/upload-server.js` (127.0.0.1:8787)
web proxy แยก process ที่ 127.0.0.1:8080 และ Cloudflared เป็น Windows service แยก

เดิม supervisor ส่งต่อ environment ที่ได้รับตอนเริ่มทำงานเท่านั้น การตั้ง `$env:` ในอีกหน้าต่าง หรือ `setx` หลัง supervisor เริ่มแล้ว ไม่เปลี่ยน environment ของ supervisor/ลูกที่มีอยู่

ตัวโหลดใหม่อ่าน credentials ที่ backend entry point ทุกครั้งที่ backend เริ่ม รวมถึงเมื่อ supervisor เปิดลูกใหม่ จึงไม่ต้อง restart supervisor/web/Cloudflared เพื่อโหลดไฟล์นี้ และไม่ต้องใส่ Secret ใน Scheduled Task

ลำดับการเลือก config:

1. ถ้ามี `SPOTIFY_CLIENT_ID` และ `SPOTIFY_CLIENT_SECRET` ครบใน environment จะใช้คู่นั้น
2. ถ้าไม่มีทั้งคู่ ใช้ไฟล์ DPAPI ของ Windows user ที่เปิด backend
3. ถ้ามี environment เพียงตัวเดียว หรือ redirect ไม่ตรง production จะปิดเฉพาะ Spotify พร้อมข้อความผิดพลาดที่ไม่มี Secret; demo ส่วนอื่นยังเริ่มได้
4. กำหนด `SPOTIFY_REDIRECT_URI` เป็น `https://demo.audiotechlabs.com/api/spotify/callback` แบบตรงตัว

หลัง reboot ไฟล์ยังอยู่และ backend จะโหลดได้เมื่อเริ่มภายใต้บัญชีเดิม ไม่ได้ตั้ง Machine/User environment ใหม่
ตรวจด้วย elevated session แล้วพบ Task **Audio Tech Lab Backend** มี Boot trigger, Highest privileges, StartWhenAvailable, RestartCount=999, RestartInterval=PT1M และไม่มี execution time limit เดิม task รันด้วย SYSTEM และ supervisor/backend/web จึงเป็น SYSTEM ทั้งหมด ส่วน Cloudflared เป็น service แยก Running/Automatic

### แก้ SYSTEM / DPAPI user ไม่ตรงกัน

ไฟล์ credentials ที่บันทึกแล้วถอดรหัสได้ด้วย MODIFY\Admin (SID `S-1-5-21-4021165935-2703571938-1365336837-1001`) ขณะที่ SYSTEM มี SID `S-1-5-18` จึงใช้ DPAPI CurrentUser เดียวกันไม่ได้ การเปลี่ยน path หรือ ACL ไม่ได้เปลี่ยนผู้ที่ถอดรหัสได้ และไม่ควรรัน setup เพื่อสร้างไฟล์ใหม่

เปิด PowerShell Administrator ด้วย MODIFY\Admin แล้วรัน:

```powershell
& "D:\Sites\Audio Tech Labs\tools\repair-spotify-task-identity.ps1"
```

กรอก **รหัสผ่าน Windows Admin เดิม** ใน prompt ภายในเครื่อง (ไม่ใช่ PIN/Spotify Secret) เพื่อให้ Windows Task Scheduler เก็บไว้สำหรับ Password logon และเริ่มได้ตอนบูตโดยไม่ต้องรอผู้ใช้ล็อกอิน ไม่มีรหัสผ่านใน command line/source/log และไม่เปลี่ยนรหัสผ่านบัญชี ไม่ใช้ S4U หรือเปลี่ยนเป็น logon-only เพราะต้องคง DPAPI และ unattended boot

สคริปต์สำรอง task XML ที่ไม่มีรหัสผ่านใน `tools/runtime/spotify-task-before-*.xml`, อัปเดตเฉพาะ principal ของ task เดิม และตรวจ Actions/Triggers/Settings ว่าไม่เปลี่ยน ก่อนหยุด task พร้อม supervisor/backend/web เดิมที่ตรวจ PID/path/creation time แล้ว และเปิด task ใหม่ ส่วน Cloudflared ไม่หยุด จำเป็นต้องเริ่ม supervisor ใหม่หนึ่งครั้ง เพราะ process ที่กำลังรันเปลี่ยน Windows identity ไม่ได้ หลังจากนั้นเปลี่ยน Spotify config ใช้ restart เฉพาะ backend ได้ตามเดิม

ไฟล์ encrypted store เดิมไม่ถูกเขียนใหม่ และตรวจ SHA256 ว่าไม่เปลี่ยน หลังรันให้ตรวจ Task user=MODIFY\Admin, LogonType=Password, Boot trigger ยัง Enabled และ runtime process owner SID ทั้งสามเป็น SID Admin การทดสอบนี้ยังไม่เท่ากับการ reboot เครื่องจริง

หมายเหตุ: filesystem owner ของไฟล์ที่สร้างจาก elevated session อาจเป็น BUILTIN\Administrators ซึ่งไม่ใช่ identity ที่ใช้เข้ารหัส DPAPI; อ่าน ACL แล้วพบเฉพาะ Admin/SYSTEM และทดสอบโหลดโดย Admin สำเร็จโดยไม่แสดงค่า credentials

ข้อจำกัดที่ตรวจพบเพิ่มเติม: MODIFY\Admin เป็น Local account, PasswordRequired=False และ PasswordLastSet ว่าง เจ้าของยืนยันว่ายังไม่มี Windows password/ใช้ PIN และอนุญาตให้ Web Demo เริ่มหลัง Admin ล็อกอินแทน จึงรัน repair ด้วย `-AfterLogon` สำเร็จแล้ว:

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "D:\Sites\Audio Tech Labs\tools\repair-spotify-task-identity.ps1" -AfterLogon
```

Task เดิมตอนนี้ใช้ Admin/Interactive/Highest และ Logon trigger เฉพาะ MODIFY\Admin; action, StartWhenAvailable, RestartCount=999, RestartInterval=PT1M, ExecutionTimeLimit=PT0S คงเดิม ไม่เก็บ Windows password และไม่ต้องกรอก Spotify credentials อีก **หลัง reboot ต้องล็อกอิน Admin ก่อน Web Demo จะเริ่ม**; Cloudflared ยังคงเริ่มตอนบูตตามเดิม

ยืนยัน process ใหม่: supervisor PID 12780, backend PID 4720, web PID 10724 เป็น MODIFY\Admin SID เดียวกันทั้งหมด Local/public health และ public demo HTTP 200; SHA256 encrypted store ไม่เปลี่ยน ไม่ได้ reboot/logoff เครื่องจริง Task XML เดิมสำรองใน tools/runtime

## Restart เฉพาะ backend

หากบันทึกสำเร็จแต่ restart ติดงานเสียง/ข้อผิดพลาด ให้รันหลังแก้สาเหตุ:

```powershell
& "D:\Sites\Audio Tech Labs\tools\restart-spotify-backend.ps1"
```

คำสั่งตรวจการโหลด config, ตัวตนและ Windows owner ของ process, parent supervisor และ queued/running jobs ก่อนหยุดเฉพาะ backend จากนั้นรอ supervisor เปิด backend ใหม่และตรวจ health ไม่หยุด web หรือ Cloudflared
ควรรอ Upload ที่กำลังส่งให้เสร็จก่อนเช่นกัน การ restart ทำให้ผู้ใช้ Web Demo ต้องล็อกอินใหม่

## Spotify Developer Dashboard

เจ้าของแอปต้องบันทึก Redirect URI ใน Settings ให้ตรงตัว (ไม่มี slash ต่อท้าย):

```text
https://demo.audiotechlabs.com/api/spotify/callback
```

ใช้ Client ID/Secret จากแอปเดียวกัน สำหรับ Development mode เจ้าของแอปต้องมี Spotify Premium และเพิ่มบัญชีทดสอบใน Settings → Users Management; บัญชีที่ไม่ได้ allowlist อาจล็อกอินได้แต่ API ตอบ 403

อ้างอิง: [Redirect URI](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri), [Authorization Code Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow), [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

## ตรวจรับหลังตั้งค่าจริง

1. `http://127.0.0.1:8787/health` และ `https://demo.audiotechlabs.com/api/health` ต้อง HTTP 200 พร้อม service `audio-tech-labs-demo`
2. เข้า `https://demo.audiotechlabs.com/demo/` แล้วล็อกอินใหม่
3. ใน browser session เดียวกัน `/api/spotify/status` ต้อง `{ "configured": true, "connected": false }` ก่อน Connect (anonymous 401 เป็นพฤติกรรมที่ถูกต้อง)
4. กด Connect Spotify ต้องไป `https://accounts.spotify.com/authorize` และ `redirect_uri` ต้องตรงด้านบน
5. ยอมรับด้วยบัญชีที่ allowlist แล้วต้องกลับ `/demo/?spotify=connected` (frontend ลบ query หลังอ่าน), status ต้อง `connected:true`
6. Search Album แล้วตรวจชื่อ Album/Artist และ Track List จริง

`configured:true` ยืนยันเพียงว่ามี config ไม่ได้พิสูจน์ว่า Spotify ยอมรับ Secret; ต้องผ่าน OAuth และ Search จริงด้วย

## ผลตรวจรอบนี้

- ตรวจ source Spotify, upload-server, frontend Spotify JS/CSS, demo HTML/auth และ supervisor/startup แล้ว
- รอบแรก Process/User/Machine environment ไม่มี Spotify ทั้งสามตัว; ต่อมาเจ้าของบันทึก encrypted credentials สำเร็จแล้ว และโหลดโดย MODIFY\Admin สำเร็จ
- public/local health HTTP 200, Web Demo HTTP 200 และ browser ล็อกอินได้
- ก่อนตั้งค่าและแก้ identity ปุ่ม Connect แสดง `Spotify is not configured on this server`; ปัญหานี้แก้แล้วตามผล Connect/OAuth/Search ด้านล่าง
- anonymous `/api/spotify/status` ตอบ 401; ยังไม่ได้อ่าน JSON status ที่ authenticated โดยตรง
- callback ที่ state ไม่ถูกต้องตอบ 302 กลับ `/demo/?spotify=state_error` ผ่าน public route
- `node --test server/*.test.cjs tools/deployment.test.cjs`: 39 passed, 0 failed รวม regression Analyze/Export จริงใน isolated test storage
- OAuth/search tests ใช้ mock Spotify เท่านั้น; DPAPI roundtrip/ACL ใช้ synthetic credentials ใน test directory ที่ Git ignore
- `node --check` ผ่าน JavaScript/CJS ที่แก้/เพิ่ม และ PowerShell parser ผ่านสามสคริปต์
- เปลี่ยน task/restart ด้วยโหมด AfterLogon สำเร็จแล้ว; เทียบ Task XML ยืนยัน action/settings เดิมตรงกัน และยังไม่ได้ reboot เครื่องจริง
- หลังเปลี่ยน identity เจ้าของยืนยันการทดสอบจริงครบเส้นทาง: Connect ไปหน้า Spotify → อนุญาต → callback กลับ Web Demo → แสดง Spotify connected → Search Album ได้ผลลัพธ์ เป็นหลักฐานจาก browser session ของเจ้าของ; แท็บของเครื่องมือเป็นคนละ session จึงยังไม่ได้อ่าน JSON authenticated /api/spotify/status โดยตรง ผลสำเร็จนี้สอดคล้องกับ configured=true และ connected=true ตามเส้นทางโค้ดที่ตรวจแล้ว
- ตรวจซ้ำหลังเจ้าของยืนยัน: local backend health HTTP 200, public Web Demo HTTP 200 และ SHA256 encrypted credentials ตรงกับก่อนแก้ identity
- รอบเพิ่ม loader เปลี่ยนไฟล์เดิมเฉพาะ server/upload-server.js; รอบแก้ Windows identity เปลี่ยน tools/restart-spotify-backend.ps1 และเอกสารนี้ พร้อมเพิ่ม tools/repair-spotify-task-identity.ps1 ไม่แก้ UI/font/CSS หรือระบบเสียง และไม่ commit/push
