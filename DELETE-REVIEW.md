# Web Demo Delete / Remove review — 2026-10-02

## ขอบเขตและสถานะเริ่มต้น

- Repository: `D:\Sites\Audio Tech Labs`, branch `main`
- HEAD: `d2dbd44c60e9857bd3b6bcc744269cf3a4119f41`
- ก่อนแก้ `git status --short` ว่าง ไม่มีงานค้างที่ต้องทับ
- ตรวจและแก้เฉพาะ lifecycle ของไฟล์, dependency, History/Audit และ state ที่เกี่ยวกับ Delete
- ไม่เปลี่ยน font/CSS/layout, retention 59 นาที, hosting configuration หรือ authentication policy
- ไม่ commit, push, deploy หรือ restart บริการ production

## 1. Architecture ก่อนแก้

| UI / trigger | Frontend | API | Backend / storage / history |
|---|---|---|---|
| Split card Remove / uploaded list Delete | `dist/demo/demo.js` | POST `/upload/remove` | session + Origin/CSRF → owner จาก session → `file-lifecycle.removeFile` |
| Split Delete Export Files | `dist/demo/demo.js` | POST `/export/delete` | owner → `removeExport` |
| Merge Remove from Modify | `dist/demo/merge/merge.js` | POST `/upload/remove` | source deletion รวม output ของ merge ผ่าน `fileIds` |
| QC Remove from Modify | `dist/demo/qc/qc.js` | POST `/upload/remove` | source + preview + QC history |
| Admin Storage Delete | `dist/demo/admin-storage.js` | POST `/admin/storage/delete` | session + admin role → ownerId/id/type → lifecycle |
| Auto cleanup | startup, ทุก 60 วินาที และก่อน authenticated API | ไม่มี UI request จำเป็น | `cleanup()` ใช้ threshold `59 * 60 * 1000` |
| Queue cancel | `dist/demo/queue.js` | POST `/jobs/:id/cancel` | ยกเลิกเฉพาะงานรอคิว ไม่ใช่ลบ source; History/Audit ของ cancellation ยังอยู่จน source ถูกลบ |
| Admin account delete | `dist/demo/admin-bar.js` | DELETE `/admin/users/:id` | ลบบัญชีและ revoke sessions; บันทึก Audit; ไฟล์เดิมยังอยู่ภายใต้ owner ID ให้ Admin/retention จัดการ |
| Local file Remove ก่อน upload | Split/Merge/QC | ไม่มี | ล้าง local selection/object URL เนื่องจากยังไม่มี server resource |

มี lifecycle service กลางอยู่แล้ว ไม่ได้เป็นปุ่มซ่อน DOM อย่างเดียว ส่วนประวัติงานอยู่ทั้ง `processing-jobs.json` และ SQLite `user_history`; Audit อยู่ตาราง `audit` แยกกัน

## 2. Defects ที่พบและแก้

1. ตรวจ symlink เฉพาะ export directory บางระดับ; owner directory/junction และ preview parent ยัง escape ได้ → ตรวจ path ทุก component และ recursive export tree ก่อนเริ่ม cascade
2. output ID เดิมรู้เมื่อ worker ส่งผลสำเร็จเท่านั้น → backend จอง output ID และบันทึกใน queue ก่อนเริ่ม worker; ลบ output ที่ worker ล้มเหลว/ถูกหยุดได้ตาม source
3. Manual Admin Export Delete ลบ directory ที่ worker กำลังเขียนได้ เพราะยังไม่มี result ผูกกับ ID และ UI แสดง `busy:false` → ใช้ busy guard เดียวกันที่ UI/API/cleanup รวม legacy workers
4. Source removal ลบ `.flac` แต่ไม่ลบ `.flac.part`; incomplete upload ลบผ่านปุ่มไม่ได้ → รวม `.part`, `.flac.part`, session ใน lifecycle และเก็บ pending upload ID ใน frontend
5. Source/ไฟล์ถูกลบก่อน queue/SQLite แต่ไม่มี recovery หากขั้นถัดไป fail → durable pending-deletions journal, retry/restart reconciliation, ปิดกั้นงานใหม่ของ resource ที่กำลังลบ
6. History cleanup และ success Audit ไม่อยู่ transaction เดียวกัน → SQLite transaction เดียว; event key คงที่เพื่อไม่บันทึก success ซ้ำเมื่อ retry
7. ลบ output/preview นอกระบบแล้ว history ยังอยู่; preview เก่าไม่มี expiry ของตนเอง → reconcile missing resources และ preview retention ผ่าน lifecycle เดิม
8. Audit Delete เดิมไม่มี resource ID ของ export แบบชัดเจน ไม่มี source/result/failure → เพิ่ม type/category/resourceId/source/result/errorCode พร้อม owner/actor/actorUsername; คง status manual-delete/auto-cleanup เพื่อเข้ากับ UI เดิม
9. Split/QC Remove response เก่าล้าง selection ใหม่ได้; Admin Delete และ expiry ทิ้ง active state ค้าง → guard view/version และตรวจ authenticated `/resources` ทุก 5 วินาที/เมื่อกลับแท็บ/เมื่อได้รับเหตุการณ์ Delete
10. Uploaded list/Admin list อาจถูกคำตอบเก่าทับ → request sequence + auth/view guards
11. Merge Remove ยังเปิดให้เริ่ม upload/merge/ลบซ้ำระหว่างรอ backend → ล็อก action ระหว่าง Delete และรักษา track เมื่อ request fail
12. Export ใหม่หลัง Delete ครั้งก่อนปุ่ม Delete ยังคง disabled → reset เมื่อ export สำเร็จ
13. Merge playback เรียก `clock` แต่ประกาศ `clockLegacy`; ทำให้ทดสอบ Remove ขณะเล่นสะดุด → แก้ชื่อ helper ให้ตรง (ไม่เปลี่ยนหน้าตา)
14. Audio read stream ไม่มี error handler เมื่อไฟล์หายระหว่างเปิด/ลบ → จัดการ stream error/disconnect โดยไม่ทำ backend crash
15. Logout reset ไม่ครอบคลุม pending-upload/delete state ใหม่ → ใช้ reset กลางและ guard upload response ตาม view เดิม
16. `queue-api` test mock ส่ง export ID โดยไม่มี directory จริง → ปรับ fixture ให้สะท้อน resource จริง เนื่องจาก reconciliation ใหม่ลบประวัติที่ชี้ output ที่ไม่มีอยู่

## 3. Flow หลังแก้

```text
Remove / Delete
  → frontend รอผลจริง และล็อกปุ่มที่เกี่ยวข้อง
  → same-origin proxy /api
  → session authentication + Origin/CSRF + password-change gate
  → owner จาก session หรือ admin role สำหรับ ownerId ที่ระบุ
  → UUID/type validation
  → file-lifecycle: busy checks + dependency discovery + path/tree preflight
  → บันทึก deletion plan ลง pending-deletions.json
  → ลบ source / upload part / preview / preview part / associated exports
  → เอางานที่เกี่ยวข้องออกจาก processing-jobs.json
  → SQLite transaction: ลบ user_history ที่เกี่ยวข้อง + append success audit
  → เอา deletion plan ออก
  → HTTP success
  → reset selection/waveform/tracks/QC/download ตาม resource + refresh lists/history
```

Auto cleanup ใช้ service เดียวกัน; job ที่ queued/running และ upload ที่กำลังเขียนจะถูกข้ามจนจบงาน ไม่เปลี่ยนเกณฑ์ 59 นาที ระบบทำ sweep ทุก 60 วินาทีและก่อน authenticated request การลบไฟล์เก่าอาจช้ากว่า threshold จน sweep ถัดไปหรือจน job จบ

หากขั้นตอนลบสะดุด จะไม่ส่ง success; journal เก็บ plan ไว้และลองใหม่ในรอบ cleanup/restart เมื่อ disk/DB กลับมาพร้อม สำเร็จซ้ำไม่เพิ่ม success Audit ซ้ำ

## 4. Security และ response

- Owner endpoint ไม่เชื่อ ownerId จาก request; cross-owner resource คืน 404
- Admin endpoint ตรวจ role ก่อนอ่าน/ใช้ target; user ปกติได้ 403
- Anonymous ได้ 401; Origin/CSRF checks เดิมยังอยู่
- IDs ต้องเป็น string UUID ไม่รับ array/object, traversal, Windows path หรือ path ที่ผู้ใช้กำหนด
- ตรวจ root/owner/resource components และ export descendants ด้วย lstat; ปฏิเสธ symlink/junction ก่อนลบ
- Busy resource และ pending deletion ได้ 409; invalid input 400; missing/repeated delete 404; filesystem/DB failure 500 โดยไม่เปิดเผย private path
- ลบใช้ synchronous critical section ใน backend process เดียว ไม่มี await ระหว่าง busy check กับ filesystem mutation
- ปิดกั้น resource ที่อยู่ใน pending plan ไม่ให้เริ่ม processing/download ใหม่
- แยกข้อมูลทดสอบทั้งหมด ไม่ใช้บัญชีหรือ credentials production

## 5. User History และ Audit

- ลบ source: ลบงานทุกชนิดที่อ้าง source รวม merge ที่อ้างผ่าน `fileIds`; ลบ outputs ของงานเหล่านั้น; source อื่นของ merge ยังอยู่
- ลบ export อย่างเดียว: ลบเฉพาะ output และประวัติงานที่อ้าง output; source และ analyze/QC อื่นยังอยู่
- Preview expiry: ลบ preview/cache ชั่วคราวและประวัติ preview; source ยังอยู่หากยังไม่หมดอายุ
- Audit ไม่ถูกลบตาม source/export/history และไม่มี truncate
- Success event มี timestamp, type=delete, category=file, ownerId, username, actorId, actorUsername, fileId/resourceId, kind, reason/source, result
- Manual failure ที่ผ่าน resource-ID validation บันทึก result=failure และ errorCode; malformed/auth failures ยังคงถูกปฏิเสธที่ขอบ API
- Auto cleanup ที่ติด locked/unsafe resource เก็บไว้ retry และบันทึกข้อความใน server log แบบจำกัดความถี่
- Admin account delete คง policy เดิม: revoke บัญชี ไม่ลบ Audit หรือเร่งลบไฟล์ก่อน retention; Admin Storage ยังจัดการ owner ID เดิมได้

## 6. ไฟล์ที่แก้/เพิ่ม

| กลุ่ม | ไฟล์ |
|---|---|
| Lifecycle / safe path | `server/file-lifecycle.cjs`, **ใหม่** `server/storage-path.cjs` |
| API / queue / persistence | `server/upload-server.js`, `server/processing-queue.cjs`, `server/activity-store.cjs` |
| Worker output provenance | `server/merge-handler.cjs`, `server/export-upload.py`, `server/merge-upload.py` |
| Split / auth / admin | `dist/demo/demo.js`, `dist/demo/auth.js`, `dist/demo/admin-storage.js` |
| Merge / QC | `dist/demo/merge/merge.js`, `dist/demo/qc/qc.js` |
| Shared reconciliation + โหลด script | **ใหม่** `dist/demo/resource-state.js`, `dist/demo/index.html`, `dist/demo/merge/index.html`, `dist/demo/qc/index.html` |
| Tests | **ใหม่** `server/delete.test.cjs`, `server/history-lifecycle.test.cjs`, `server/queue-api.test.cjs`, **ใหม่** `tools/verify-delete-ui.cjs` |
| รายงาน | **ใหม่** `DELETE-REVIEW.md` |

## 7. Verification

- ก่อนแก้: `node --test server/*.test.cjs tools/deployment.test.cjs` → **47/47 passed**
- หลังแก้: command เดียวกัน → **55/55 passed**, ไม่มี skip/failure
- Tests เพิ่มครอบคลุม normal owner, foreign/anonymous/admin, forged ownership, malformed IDs, repeated/concurrent delete, actual disk removal, merge dependencies, failed-worker output, preview part, incomplete upload, 59-minute boundary, busy jobs, junction escape, disk failure, SQLite rollback/recovery, persisted restart และ Audit preservation
- `node tools/verify-delete-ui.cjs` → Chrome + real backend/proxy + Python/FFmpeg workers: Split Analyze/Preview/Export/Remove, Merge/Remove ขณะเล่น, QC/Remove, Admin source/export Delete ข้ามบัญชี, API failure UI guards, stale response, cleanup, partial upload และ reload; ตรวจ filesystem + API History/Audit ประกอบ
- `node tools/verify-split-ui.cjs` → ผ่าน 1440/1024/768/390/320px, ไม่มี horizontal overflow, ดาวน์โหลดเทียบ bytes 10 ครั้ง, Merge navigation/upload/reorder/merge/download ผ่าน, JavaScript errors=[]
- `node tools/verify-admin-activity.cjs` → ผ่าน 1440/1024/768/390/320px, filtering/pagination/logout clear/late response guard ผ่าน, JavaScript errors=[]
- Node syntax checks ของ JS/CJS ที่แก้, Python AST ของ worker ที่แก้ และ `git diff --check` ผ่าน
- Browser scripts ใช้ Playwright จาก bundled NODE_PATH; ไม่มี dependency/lockfile installation

หลักฐานที่สร้างไว้ใน ignored output:

- `.site-build/delete-qa/results.json` และ screenshots
- `.site-build/split-qa/functional-results.json` และ screenshots
- `.site-build/activity-qa/results.json` และ screenshots

## 8. ข้อจำกัดที่ยังต้องทราบ

- ยืนยัน end-to-end กับ code และ audio worker จริงใน instance ทดสอบแยก ไม่ใช่การยืนยัน deployment production; ไม่ restart บริการจริงหรือทดสอบลบข้อมูลจริงของผู้ใช้
- Retention ทดสอบโดยปรับ mtime/นาฬิกาทดสอบถึง threshold ไม่ได้นั่งรอ 59 นาทีตามเวลาจริง
- Failure tests จำลอง disk lock/DB failure และ recovery; ไม่ได้ทดสอบไฟดับหรือ disk corruption จริง
- รองรับ backend process เดียวต่อ storage root ตาม architecture ปัจจุบัน; ไม่มี distributed lock สำหรับหลาย backend ที่เขียน root เดียวกัน
- ป้องกัน junction ที่มีอยู่ขณะตรวจ; ไม่ได้พิสูจน์การป้องกัน local privileged process ที่สลับ path แข่งระดับ OS หลังตรวจ ต้องจำกัดสิทธิ์ storage directory ตามเดิม
- Export เก่าที่เคยล้มเหลวก่อนมี outputId และไม่มี provenance ไม่สามารถเดา source ได้อย่างปลอดภัย; ยังคงให้ Admin Storage/59-minute export retention จัดการ
- การลบไม่ใช่ secure erase ของ bytes ที่ส่งไปยัง browser/download แล้ว

## 9. git diff --stat

คำสั่งนี้ไม่นับไฟล์ untracked ใหม่ (ดูข้อ 10):

```text
 dist/demo/admin-storage.js        |   5 +-
 dist/demo/auth.js                 |  11 +--
 dist/demo/demo.js                 |  37 ++++---
 dist/demo/index.html              |   2 +-
 dist/demo/merge/index.html        |   2 +-
 dist/demo/merge/merge.js          |  45 +++++----
 dist/demo/qc/index.html           |   2 +-
 dist/demo/qc/qc.js                |  16 +--
 server/activity-store.cjs         |  17 +++-
 server/export-upload.py           |   2 +-
 server/file-lifecycle.cjs         | 200 ++++++++++++++++++++++++--------------
 server/history-lifecycle.test.cjs |  24 +++++
 server/merge-handler.cjs          |   6 +-
 server/merge-upload.py            |   2 +-
 server/processing-queue.cjs       |  25 ++---
 server/queue-api.test.cjs         |   4 +-
 server/upload-server.js           |  55 ++++++-----
 17 files changed, 285 insertions(+), 170 deletions(-)
```

## 10. git status --short

```text
 M dist/demo/admin-storage.js
 M dist/demo/auth.js
 M dist/demo/demo.js
 M dist/demo/index.html
 M dist/demo/merge/index.html
 M dist/demo/merge/merge.js
 M dist/demo/qc/index.html
 M dist/demo/qc/qc.js
 M server/activity-store.cjs
 M server/export-upload.py
 M server/file-lifecycle.cjs
 M server/history-lifecycle.test.cjs
 M server/merge-handler.cjs
 M server/merge-upload.py
 M server/processing-queue.cjs
 M server/queue-api.test.cjs
 M server/upload-server.js
?? DELETE-REVIEW.md
?? dist/demo/resource-state.js
?? server/delete.test.cjs
?? server/storage-path.cjs
?? tools/verify-delete-ui.cjs
```
