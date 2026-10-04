Audio Tech Labs — ตรวจ baseline ที่ยอมรับแล้ว, 4 October 2026

รอบนี้ไม่มีการเปลี่ยน HTML/CSS, ชุดสี, ภาพ, เนื้อหา, ขนาด/ตำแหน่งองค์ประกอบ, API หรือ tests เดิม เพิ่มเฉพาะรายงานนี้และหลักฐานตรวจในโฟลเดอร์ gitignored `tools/runtime/home-followup-20261004/` ไม่มี commit, push หรือ deploy

สำรอง baseline ก่อนเริ่มไว้ใน `tools/runtime/home-followup-20261004/baseline/` และยืนยัน byte-for-byte ว่า `dist/index.html` กับ `dist/home.css` หลังตรวจเหมือน baseline ทั้งหมด งานที่ค้างจากรอบก่อนยังอยู่ครบ

| ประเด็น | หลักฐานและผลตรวจจริง | การตัดสินใจ |
| --- | --- | --- |
| Source / generated output | DEPLOYMENT.md บรรทัด 8 ระบุ `dist/` เป็น source; `tools/build-pages.cjs` ใช้ `fs.cpSync(root/dist, .site-build/pages)`; workflow เรียก build นี้ และ `.site-build/` ถูก gitignore | ดูแลไฟล์ใน `dist/` ตามเดิม ไม่ต้องย้ายเข้า template |
| ผล build | รัน `node tools/build-pages.cjs`; เปรียบเทียบ index.html และ home.css ใน `.site-build/pages/` กับ source แบบ byte-for-byte พร้อมตรวจ `href="home.css"` | ผ่าน ไฟล์และการโหลด stylesheet ครบ |
| Hero → About | ตรวจ computed styles/ตำแหน่งและภาพที่ 375, 768, 1440, 1920px: Hero จบตรง About เริ่ม ไม่มี gap; border-bottom Hero และ border-top About เป็น 0; overlay กลืนลง bg-base | คง overlay และความสว่างเดิม |
| About → DIY | สอง section ใช้ bg-base เดียวกัน ขอบล่าง About 1px และขอบบน DIY 0px ไม่มี gap หรือเส้นซ้อน | คงเส้นตกแต่งเดิม |
| DIY → Web Demo | DIY ใช้ bg-base, Web Demo ใช้ bg-section ตาม palette ที่ยอมรับ มีเพียง border-bottom DIY 1px; Web Demo ไม่มี border-top ไม่มีแถบสีแทรก | คงความต่างระดับพื้นและเส้นเดิม |
| อังกฤษใต้ชื่อเว็บ | ตรวจ browser ทุกความกว้าง 768–1024px ทีละ 1px รวม 257 ค่า; วัด text ranges ของ Audio Modification, Hi-Fi Technology, DIY Audio; ทั้งประโยคยังอยู่บรรทัดเดียวทุกค่าที่ตรวจ ไม่มีกลุ่มคำแตกหรือ horizontal overflow | คงข้อความและ markup เดิม ไม่เพิ่มตัวครอบคำโดยไม่จำเป็น |
| ข้อความตกแต่งแนวตั้ง | `.hero-aside` มี `aria-hidden="true"` และไม่มี control; computed display:none ที่ 375, 768, 800, 801, 820, 900, 960, 1023px ส่วน 1024px ขึ้นไปยังแสดงตาม baseline | คง media queries เดิม ไม่ซ่อน navigation หรือ control ใดเพิ่ม |
| ปุ่มรอง / focus | focus-visible จริง: outline สี #D8BC89 ขนาด 2px offset 4px; border #80898F เดิม; บันทึก screenshot | ไม่ลดความเข้มขอบปุ่ม |
| Contrast แยกบทบาท | ขอบ control เทียบ surface 4.39:1 และ surface-hover 3.96:1; focus เทียบ surface-hover 7.70:1; เส้นตกแต่ง #353B40 เทียบ surface 1.38:1 ซึ่งไม่ใช้เป็นขอบ control หรือ focus | ผ่านเกณฑ์ 3:1 สำหรับคู่สี control/focus ที่ตรวจ ไม่อ้างว่าเส้นตกแต่งผ่านเกณฑ์ control |
| Build / checks | Build ผ่าน; `git diff --check` ผ่าน; ไม่มี lint script ในโปรเจกต์ | ไม่มีการเพิ่ม dependency หรือ linter |
| Tests หลังยืนยัน source สุดท้าย | `node --test server/*.test.cjs tools/*.test.cjs` บน Node v24.19.0 ผ่าน 121/121, fail 0, skipped 0, 108878.6283ms รวม real audio pipeline | บันทึกผลรอบนี้ แยกจากเหตุล้มรอบก่อน |

**Windows process test: สิ่งที่ยืนยันได้**

1. Log รอบแรก `tools/runtime/home-refinement-20261004/tests.log` บรรทัด 139–153 ระบุ `server/runner.test.cjs:17:53`, actual `true`, expected `false`, ระยะ test 3247.5339ms
2. ตำแหน่งนั้นคือ `assert.equal(alive(descendant), false)` หลัง `await assert.rejects(timed, /exceeded/)` ดังนั้น timeout promise ปฏิเสธแล้ว แต่ `Get-Process -Id <descendant>` ยังคืนผลว่าพบ PID ในจังหวะตรวจนั้น ขั้นตอนจำลอง backend recovery ที่ตามมายังไม่ถึง และ assertion ตรวจการลบ marker ถัดจากจุดที่ล้มยังไม่ได้ยืนยัน
3. `alive()` ตรวจเพียงการมี PID ไม่ตรวจ executable, creation time หรือสถานะการสิ้นสุดของ process ส่วน `process-runner.cjs` รอ root child `close` และ callback ของ `taskkill` แต่ callback ตั้ง `killDone=true` โดยไม่อ่าน error/stdout/stderr และไม่มีการยืนยัน process ลูกหลังสั่งหยุด นี่คือช่องว่างด้านหลักฐาน/การยืนยัน cleanup ที่พบจากโค้ด ไม่ใช่หลักฐานว่ามันทำให้รอบแรกล้มแน่นอน
4. `queue-worker.py` ตั้ง Windows Job Object พร้อม `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` ก่อนเรียก bridge เป็นกลไก cleanup อีกชั้นหนึ่ง แต่ไม่มี trace จาก job/descendant exit ของรอบที่ล้มให้ตรวจ
5. รอบนี้ใช้ diagnostic preload ชั่วคราว `trace-runner.cjs` กับ tests เดิม โดยไม่แก้เงื่อนไข test หรือ production runner: ผ่าน 2/2 ใน 5791.0619ms ข้อมูล trace แสดง timeout kill เริ่ม 2111.3ms, callback 2326.1ms, error=null, stderr ว่าง และ stdout รายงานการ terminate process ใน tree รวม PID ลูกที่ตรวจ หลังจากนั้น alive check ช่วง 2327.6–2740.7ms คืนค่าว่าง (ไม่พบ PID) ขั้นตอน recovery และ cancellation ในรอบนี้ก็ผ่าน
6. Full suite รอบสุดท้ายรันคำสั่งปกติ ไม่มี diagnostic preload และใช้ concurrency ปกติ ผ่าน 121/121 ดู `tools/runtime/home-followup-20261004/tests-final.log`

**สิ่งที่ยังสรุปไม่ได้**

ไม่มีผล taskkill, PID/creation time, exit timestamps หรือการตรวจ PID ซ้ำของรอบแรก จึงแยกไม่ได้ว่าเป็นการสิ้นสุด process ที่ยังไม่เสร็จในขณะตรวจ, taskkill ล้ม/หยุดได้ไม่ครบ, หรือการพบ PID ที่ถูกใช้ซ้ำ ไม่สามารถระบุว่าเกิดจาก concurrency หรือเครื่องโหลดสูงได้จาก log ที่มีเพียงอย่างเดียว การผ่านรอบแยก รอบตามลำดับ และรอบปกติล่าสุดพิสูจน์ได้เฉพาะแต่ละรอบ ยังไม่ใช่การพิสูจน์ว่าสาเหตุเดิมได้รับการแก้ไข

สถานะประเด็นนี้จึงเป็น **ยังไม่ยืนยัน root cause / ยังไม่ปิดประเด็น** ไม่ได้แก้ backend เพื่อกลบอาการ และไม่ได้เพิ่ม delay, retry, skip หรือผ่อน assertion หากเกิดซ้ำ หลักฐานที่ต้องเก็บคือผล taskkill พร้อม exit code, ตัวตน PID และ creation time ก่อน/หลัง kill, root/descendant exit timestamps และผลการตรวจ descendant ซ้ำโดยมีเวลาแน่นอนก่อนตัดสินใจแก้ runner หรือ test

**หลักฐานรอบนี้**

- `baseline/inspection.json`: ขอบ ตำแหน่ง section และการวางคำใน 11 viewport
- `baseline/hero-about-{width}.png`, `about-diy-{width}.png`, `diy-demo-{width}.png`: ภาพรอยต่อ 375, 768, 1440, 1920px; ซ่อน sticky header เฉพาะตอนจับภาพรอยต่อเพื่อไม่ให้บังเนื้อหา
- `baseline/hero-{width}.png`: Hero ที่ 768, 801, 900, 1024px
- `final-check.json`: source/build equality, sweep 257 widths, focus และ contrast
- `secondary-focus-1440.png`: ปุ่มรองขณะ focus-visible
- `runner-isolated.log`, `runner-trace-*.jsonl`: diagnostic test และผล taskkill/การตรวจ PID
- `tests-final.log`: full suite รอบสุดท้าย

ยังต้องตรวจบนมือถือจริงก่อนพิจารณา deploy: Safari บน iPhone และ Chrome บน Android ทั้งแนวตั้ง/แนวนอน, รอยต่อ Hero ขณะแถบ browser ยุบ–ขยาย, การตัดภาษาไทยด้วยฟอนต์จริง/ฟอนต์ fallback, การเพิ่มขนาดข้อความจาก OS และ browser zoom, เมนูและ dialog ด้วยการสัมผัส, การเลื่อนหน้า/คืน focus หลังปิด dialog และ focus-visible เมื่อใช้คีย์บอร์ดภายนอก รอบนี้ตรวจผ่าน Chrome headless บน Windows จึงยังไม่อ้างผลจากอุปกรณ์จริง


## Follow-up — process cleanup evidence and taskkill error review (4 October 2026)

No production runner, test assertion, HTML/CSS, visual styling, API, delay, retry, or skip was changed in this follow-up. Diagnostic files remain under gitignored `tools/runtime/home-followup-20261004/`.

### Cleanup evidence — 3 independent runs

`cleanup-evidence.cjs` exercised the same `createProcessRunner()` timeout path three independent times with a 2,000 ms timeout. Every run was recorded, with no retry-on-fail behavior.

| Run | Root PID / Created UTC | Descendant PID / Created UTC | taskkill start | root exit/close | taskkill exit/callback | Post-run |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 16012 / 09:44:31.3900230Z | 11252 / 09:44:31.4797010Z | 09:44:33.403Z | 09:44:33.515Z | code 0, callback 09:44:33.518Z, error=null, stderr empty | root+descendant absent; marker absent |
| 2 | 7588 / 09:44:34.7043860Z | 3940 / 09:44:34.7909500Z | 09:44:36.716Z | 09:44:36.829Z | code 0, callback 09:44:36.832Z, error=null, stderr empty | root+descendant absent; marker absent |
| 3 | 11756 / 09:44:38.0565270Z | 5640 / 09:44:38.1421060Z | 09:44:40.067Z | 09:44:40.180Z | code 0, callback 09:44:40.183Z, error=null, stderr empty | root+descendant absent; marker absent |

In all three runs, taskkill stdout named the root and descendants as terminated. The immediate post-run identity query returned no matching root or descendant PID. Evidence: `cleanup-evidence.json`.

A more invasive full-tree trace also passed 2/2, but its repeated CIM queries materially increased test duration, so it is retained only as supplementary evidence and is not used as the timing baseline.

The normal, uninstrumented focused test was rerun afterward and passed 2/2 in 4,597.1387 ms. Source hashes for `server/process-runner.cjs` and `server/runner.test.cjs` remained unchanged from the pre-follow-up hashes.

### taskkill error handling — confirmed gap, separate from the original failure

Production `process-runner.cjs` still invokes async `taskkill` with a callback that ignores `error`, `stdout`, and `stderr`, then sets `killDone=true`. Static review therefore confirms that `killDone` currently means only “the taskkill callback returned”, not “the process tree was confirmed stopped”.

A controlled diagnostic probe simulated a taskkill callback failure without changing production code. Runner timeout was configured to 200 ms; taskkill reported a simulated error, but the runner did not surface that kill error. It kept the original timeout error and returned only after the worker later exited naturally, at approximately 1,630 ms. The descendant was then gone because the worker's Job Object closed. Evidence: `taskkill-error-probe.json`.

This proves the taskkill error is currently swallowed and can delay completion / obscure cleanup diagnosis. It does NOT prove this behavior caused the first historical failure. No production fix was applied in this follow-up.

### Real-device mobile verification

Real-device verification is still pending. EliteBook currently exposes no Android/iPhone/iPad/WPD device to AI Remote; ADB is not installed and no Apple Mobile Device service is present. Therefore no Chrome emulation or Windows headless run is being counted as a physical-mobile pass.

The pending physical-device checklist is saved at `tools/runtime/home-followup-20261004/MOBILE-REAL-DEVICE-CHECKLIST.md` and covers iPhone Safari + Android Chrome in portrait/landscape, collapsing/expanding browser bars at the Hero seam, Thai webfont/fallback wrapping, OS text-size/browser zoom, touch menu/dialog behavior, scroll/focus restoration, and external-keyboard focus-visible.

### Current gate

**Baseline ผ่านการตรวจ / Windows cleanup ยังไม่ปิด / รอตรวจมือถือจริง**

No commit, push, or deploy was performed.
