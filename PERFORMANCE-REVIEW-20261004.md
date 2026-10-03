# Performance review — 4 October 2026 (Asia/Bangkok)

ปรับปรุงเฉพาะ frontend ของ `demo.audiotechlabs.com` ใน working tree บน EliteBook โดยรักษา UI, API contract, worker lifecycle และ security เดิม ผลหลักคือ request ขณะ idle/background ลดลง และลดการสร้าง DOM/canvas ซ้ำ ยังไม่ได้ commit, push หรือ deploy

## Preflight และขอบเขต

- Directory: `D:\Sites\Audio Tech Labs`; branch `main`.
- HEAD, local `origin/main` และ remote `refs/heads/main` จาก `git ls-remote` ตรงกัน: `673fc9c5524ec5a643d862465197bcbf31200314`.
- Working tree สะอาดก่อนเริ่ม; ไม่พบ `AGENTS.md` ใน repository/parent ที่ตรวจ.
- Source ที่ใช้งาน: `dist/demo/index.html`, `merge/index.html`, `qc/index.html`, scripts/styles ที่แต่ละหน้าอ้างถึง และ shared `dist/styles.css`.
- Build: `node tools/build-pages.cjs` → `.site-build/pages`; Cloudflare Pages ให้บริการ static assets; `/api/*` ผ่าน Pages Function → `backend.audiotechlabs.com` → existing Tunnel → `127.0.0.1:8787`.
- `.openai/hosting.json` และรายละเอียด GitHub Pages/8080 ในเอกสารเก่าไม่ใช่ architecture ปัจจุบัน; อ้างอิง `STABILITY.md` และ config/code จริง.
- Public inspection เป็น GET/read-only; การ login, upload, audio processing, delete, restart/offline และ admin checks ใช้ backend บน random loopback port พร้อม account/storage ชั่วคราวแยกจาก production.
- ไม่เปลี่ยน services, scheduled tasks, tunnel, DNS, database schema, backend, audio core, credentials หรือ security settings.

## การแก้ไขที่เก็บไว้

| ส่วน | การเปลี่ยนแปลงและผล |
| --- | --- |
| Health | ไม่ตรวจซ้ำจาก `pageshow` ของ initial navigation; ยังตรวจเมื่อกลับจาก back/forward cache, network return และ visibility resume |
| Health single flight | เมื่อ offline/invalidated ให้ abort แต่คง flight lock จน promise จบ/timeout; ผลตอบกลับเก่าเปลี่ยนเป็น online ไม่ได้ |
| Health DOM | ไม่เขียน status DOM ซ้ำหาก state ไม่เปลี่ยน; nonce, no-store, deadline 5 วินาที, freshness 20 วินาที และ visible polling 15 วินาทีคงเดิม |
| Queue/history | idle reads ลดเหลือประมาณทุก 15–18 วินาที; active queue ยังทุก 3 วินาที; explicit refresh/submission/resume ยังอ่านทันที; ไม่สร้างรายการ DOM ใหม่เมื่อข้อมูลที่แสดงเหมือนเดิม |
| Resource reconciliation | ข้าม periodic reads เมื่อแท็บซ่อนหรือ workspace ยังล็อก; refresh เมื่อกลับมา visible; ใส่ timeout 15 วินาทีป้องกัน single-flight ค้าง; ไม่เพิ่ม request ตอน logout |
| Admin Storage | โหลดเมื่อเปิด panel; ไม่ scan storage ทุกครั้งที่ admin login/reconnect ขณะ panel ปิด |
| Waveform | coalesce การวาดที่รอ animation frame ให้เหลือภาพล่าสุดเมื่อมี resize ติดกัน |
| Cache version | เปลี่ยน URL version เป็น `performance1` เฉพาะ scripts ที่แก้ในทั้งสามหน้า เพื่อไม่ใช้ JS เก่าจาก browser cache 4 ชั่วโมง |
| Favicon | ประกาศ empty data favicon ให้ browser ไม่ร้องขอ `/favicon.ico` ที่ไม่มีอยู่และเกิด 404 โดยไม่เพิ่ม network asset |

ไม่เปลี่ยน retry/submission code ของ Analyze, Export, Merge, QC, Upload หรือ Delete. `demoServer.request` ยังคงทำ mutation เพียงหนึ่ง attempt และ processing status recovery อ่าน job เดิมโดยไม่ replay POST.

ทดลอง `defer` แล้วไม่เก็บไว้: ใน controlled sample ช่วยเวลาโหลดเล็กน้อย แต่ทำให้ long-task blocking รวมเพิ่มขึ้น จึงคง scripts ท้าย body และลำดับ execution เดิม.

## Before → After

<!-- PERFORMANCE_TABLE -->
| Metric (median, cold local load) | Before 390px | After 390px | Before 1440px | After 1440px |
| --- | ---: | ---: | ---: | ---: |
| Requests ที่ Playwright จับจากหน้า | 24 | 22 | 24 | 22 |
| Transfer bytes (Resource Timing) | 193,463 | 193,921 | 193,463 | 193,921 |
| CDP encoded bytes | 203,856 | 203,300 | 203,856 | 203,300 |
| JS decoded bytes | 96,595 | 97,815 | 96,595 | 97,815 |
| CSS decoded bytes | 70,046 | 70,046 | 70,046 | 70,046 |
| DOMContentLoaded (ms) | 1,459.7 | 1,437.5 | 1,465.9 | 1,470.4 |
| Load (ms) | 1,503.6 | 1,479.7 | 1,511.2 | 1,505.4 |
| LCP (ms) | 1,228 | 1,220 | 1,208 | 1,208 |
| CLS | 0.000294 | 0.000294 | 0.000131 | 0.000131 |
| Observed long-task blocking (ms), ไม่ใช่ Lighthouse TBT | 69 | 76 | 84 | 91 |
| JavaScript page errors / failed fetch transport | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

| Behavior | Before | After |
| --- | --- | --- |
| Initial health / auth-me reads | 2 / 2 | 1 / 1 |
| Logged-in idle API reads, 31 s | 18 (jobs 10, resources 6, health 2) | 9 (jobs 1, resources 6, health 2) |
| Logged-in hidden idle API reads, 31 s | 20 รวม health/auth จากการอ่าน jobs เกิน freshness | 0 |
| Unchanged nonempty queue DOM, repeated explicit reads | โค้ดเดิมสร้างรายการใหม่ทุกครั้ง | 0 mutations ใน browser check |
| 40 resize events ใน frame เดียว | โค้ดเดิม enqueue 40 draw callbacks | 1 canvas draw ใน browser check |
| Login screenshots 390/1440px | baseline PNG | final PNG เหมือนทุกไบต์ (SHA-256 ตรงกันทั้งสองขนาด) |
| Local outage / recovery (actual isolated stop/start) | policy 15 s | ตรวจ offline 13.252 s / recovery 14.930 s, ไม่ reload |

ผลที่ชัดเจนคือ idle API traffic ลด **50%**, hidden idle traffic ใน fixture ลด **100%**, initial page requests ลด **8.3%** และลด DOM/canvas work ที่ซ้ำ. เวลา cold load/LCP โดยรวมใกล้เดิม; ไม่กล่าวอ้างว่าลด INP/TBT หรือทำให้ CWV ดีขึ้นอย่างมีนัยสำคัญ. Startup blocking เพิ่ม 7 ms ใน median รอบสุดท้าย จึงไม่ได้รายงานว่า main-thread startup เร็วขึ้น. JS เพิ่ม 1,220 bytes (+1.26%) และ CSS เท่าเดิม; transfer-size metric เพิ่ม 458 bytes ขณะที่ CDP encoded bytes ลด 556 bytes เนื่องจากจำนวน response/header ต่างกัน.

Console ของ anonymous Login: baseline sample แรกมี expected `/api/auth/me` 401 สองครั้งและ pre-existing favicon 404; final sample แรกเหลือ expected 401 ครั้งเดียว. Final CDP responses ยืนยันไม่มี 404 หรือ unexpected 403/5xx ในทุก sample. รอบ authenticated responsive flow ไม่มี page errors, failed requests หรือ unexpected HTTP errors. Hidden measurement ใช้ `document.hidden` override + visibility event เพื่อให้ scheduler เวลาคงที่; ไม่ใช่ browser background throttling หรือการปิดเครื่องจริง.
<!-- /PERFORMANCE_TABLE -->

วิธีวัด: Chrome 154 headless บน EliteBook, fresh browser context และ cache disabled ทุก sample, 3 samples ต่อ viewport, median; local network emulation latency 40 ms / download 200,000 B/s / upload 100,000 B/s และ CPU slowdown 4× เท่ากัน. Before ใช้ snapshot source ก่อนแก้; After ใช้ artifact จาก build สุดท้าย โดย backend code เหมือนกันและไม่มีชุดทดสอบ audio ทำงานพร้อมรอบวัดควบคุม.

`transferBytes` คือ Navigation/Resource Timing ซึ่งประมาณ header overhead; CDP encoded bytes บันทึกแยกเป็น `wireBytes`. Local server ไม่บีบอัดเหมือน Cloudflare จึงห้ามเปรียบเทียบ byte/time ข้าม local กับ public เพื่อกล่าวอ้างผล deploy. INP field และ Lighthouse TBT ไม่ได้วัด; ค่า long-task blocking ในหลักฐานเป็นผลรวม `max(duration−50, 0)` ของ long tasks ในช่วงสังเกต ไม่ใช่ Lighthouse TBT.

Public baseline ก่อน deploy: หน้า `/` redirect ไป `/demo/` และเปิดได้, SERVER ONLINE; LCP median ที่ 390px = 316 ms, 1440px = 244 ms; ไม่มี page errors หรือ failed network requests ใน 6 samples. Public มี Cloudflare analytics เพิ่ม จึงมี 24–26 requests. ยังไม่มี public After เพราะยังไม่ deploy.

## ผลสำรวจส่วนที่คงเดิม

- Login first load ใช้ 8 CSS และ 11 JS; ไม่โหลด image หรือ web-font จากเครือข่าย. Logo ของ demo เป็นข้อความ/markup; ภาพ PNG/WebP ใหญ่ของเว็บไซต์หลักไม่ถูกโหลดในหน้า demo จึงไม่แปลงหรือลบ assets โดยไม่มีประโยชน์ต่อหน้านี้.
- CSS รวม 70,046 bytes. Shared styles, responsive overrides และ styles ของ authenticated/hidden panels มีการใช้งานต่าง state; ไม่ใช้ coverage ของหน้า login มาตัด CSS เหล่านั้น. ไม่เปลี่ยน typography, CSS cascade หรือหน้าตา.
- HTML public: `public, max-age=0, must-revalidate`. JS/CSS: `public, max-age=14400, must-revalidate`, ETag และ Brotli. ไม่ตั้ง immutable บน URL ที่ไม่ใช่ content hash.
- Health public: `no-store, no-cache, must-revalidate`, CDN no-store และ nonce; anonymous `/api/auth/me` ตอบ 401/no-store ตาม contract. ไม่เพิ่ม shared/private-data cache.
- Backend session lookup อ่าน users file เพื่อ revalidate identity/version; cleanup มีทั้งรอบ 60 วินาทีและก่อน API บางกลุ่ม; storage scan และ history reads เป็น synchronous ส่วนหนึ่ง. การลด polling ลดจำนวนครั้งที่เข้าเส้นทางเหล่านี้ โดยไม่ลด authorization/cleanup correctness.
- SQLite history มี owner/time index; audit มี indexes สำหรับ username/type/category และ keyset pagination. User history และ Admin Storage ยังส่งรายการเต็ม: ควร profile ด้วยขนาดข้อมูลที่เป็นตัวแทนก่อนเปลี่ยน pagination/response shape.
- งานหนัก Analyze/Preview/QC/Export/Merge ยังผ่าน queue/worker เดิม; ไม่มีการเปลี่ยน synchronous I/O, logging, hashing cost หรือการเก็บ secrets เพื่อแลกความเร็ว.
- Timers ของ job ที่ผู้ใช้ส่งแล้วคงทำงานเพื่อรับผล; การหยุด background polling ในรายงานหมายถึง passive queue/resource polling ไม่ได้ยกเลิกงานเสียง. การตรวจ resource ขณะ visible ยังประมาณทุก 5 วินาทีเพื่อให้ deletion/retention reconcile ได้เร็ว.
- โค้ดคล้ายกันระหว่าง Split/Merge/QC เป็นคนละหน้า/คนละ global scope; ไม่รวมโมดูลครั้งใหญ่เพียงเพื่อลดบรรทัด. พบ multiple refresh triggers หลัง delete ซึ่งมี stale-response guards เดิม; ไม่เปลี่ยน flow นอกส่วนที่วัดและตรวจได้.

## Regression และ security

- Baseline full suite: **117/117 ผ่าน**.
- Final full suite: **121/121 ผ่าน**, ไม่มี skip/fail (รวม real audio-core suites บน EliteBook).
- หลังเก็บ favicon fix รัน focused health/performance/UI-contract/deployment checks อีกครั้ง: **43/43 ผ่าน**; final artifact measurement ตรวจ favicon/console ของทั้ง 6 samples.
- `verify-stability.cjs`: local backend stop/restart, offline-first load, Login disabled offline/re-enabled online, stale nonce/HTML rejection, session expiry, login single flight, Analyze recovery และ lost mutation response ไม่ replay.
- `verify-split-ui.cjs`: Signup/Login/Logout, upload/analyze, boundary edit, play/stop/seek, WAV/FLAC exports/download bytes, Merge; 390/768/1024/1440px และเพิ่ม 320px.
- `verify-delete-ui.cjs`: Split/Export/Merge/QC remove, failure preserves data, admin delete ข้าม owner, other-tab reconciliation, 59-minute cleanup, partial upload removal, stale delete response และ audit retention.
- `verify-performance.cjs`: 28 layout cases (7 views × 4 widths): Login, Split/History, Merge, QC, AI & Integrations, Storage, Activity Log; ตรวจ document overflow และ control horizontal bounds พร้อม screenshots. ตรวจ lazy Admin Storage, unchanged queue DOM และ resize coalescing.
- HTTP/unit suites ครอบคลุม auth/CSRF/session, owner/admin isolation, path traversal/junction escape, upload validation, busy delete guard, queue idempotency/cancellation, storage quotas, cleanup/audit, OpenAI key isolation/provider failures และ Spotify flow.
- OpenAI/Spotify upstream ใช้ mocks ใน suite; ไม่ได้ส่งเงินจริง/เชื่อมบัญชีจริงหรือแก้ API keys. AI Review UI/HTTP contract, cancellation และ manual-boundary protection ผ่าน tests; ยังไม่ได้ทดสอบ live provider round trip หรือ Boundary Fallback ทุกกรณีกับอัลบั้มจริง.
- ปรับ assertion ใน Delete verifier เก่าจากข้อความ `Modify` เป็น `Server` และจาก raw injected 500 เป็น offline message ตาม server-state contract ปัจจุบัน; ยังยืนยันว่าไฟล์ไม่ถูกลบและ retry หลัง recovery สำเร็จ.
- `git diff --check`, JavaScript syntax checks และ Pages build ผ่าน. ตรวจ diff ทั้งหมดและ scan รูปแบบ credentials ใน changed/untracked source ไม่พบ secret; ไม่มี runtime, credentials, uploads, exports, npm dependencies หรือ generated artifact หลุดในรายการ Git.

การปิด EliteBook จริง/หยุด production backend ไม่ได้ทำในรอบนี้. Static Pages independence ตรวจจาก architecture/config, public reads และการหยุด backend แยกในการทดสอบ; production power-off/boot และ browser หลัง deploy ยังต้องตรวจใน acceptance รอบเผยแพร่.

ตรวจท้ายงาน: health ทั้ง `127.0.0.1:8787` และ public `/api/health` ตอบ 200, `ok=true`, service ถูกต้อง. HEAD ยังคงเดิม; ไม่มี commit/push/deploy.

## หลักฐานและวิธีรันซ้ำ

หลักฐานขนาดใหญ่เก็บใน ignored paths:

- `tools/runtime/performance/{before,before-controlled,after,after-final,public-before}.json` และ screenshots; `after` เป็นรอบทดลอง defer ที่ไม่ใช่ patch สุดท้าย.
- `tools/runtime/performance/after-no-defer.json` เป็นรอบก่อนเก็บ favicon fix; ใช้ `after-final.json` สำหรับตารางผลสุดท้าย.
- `tools/runtime/performance/public-headers.jsonl`.
- `tools/runtime/perf-baseline-tests.log`, `perf-final-tests.log`, `perf-stability.log`, `perf-split.log`, `perf-delete.log`, `perf-responsive.log`.
- `tools/runtime/performance-ui/results.json` และ 28 screenshots; `.site-build/split-qa/functional-results.json`, `.site-build/delete-qa/results.json`, `tools/runtime/stability-qa/results.json`.

```powershell
$env:ATL_AUDIO_PYTHON='D:\Projects\Audio Album Splitter AI\.venv-backend\Scripts\python.exe'
$env:NODE_PATH=(Resolve-Path tools/runtime/perf-deps/node_modules).Path
node --test server/*.test.cjs tools/*.test.cjs
node tools/verify-stability.cjs
node tools/verify-split-ui.cjs
node tools/verify-delete-ui.cjs
node tools/verify-performance.cjs
node tools/build-pages.cjs
$env:ATL_PERF_DIST=(Resolve-Path .site-build/pages).Path
node tools/measure-performance.cjs after-final
git diff --check
```

Playwright ติดตั้งเฉพาะใน ignored `tools/runtime/perf-deps` เพื่อใช้กับ Chrome ที่มีอยู่; ไม่เพิ่ม production dependency. Benchmark ควรรันหลัง tests จบ ไม่รันพร้อม audio workers. ใช้ `--public` กับ measurement script เมื่อต้องการ anonymous/read-only public baseline.

พร้อมให้ตรวจ diff และผลวัดก่อนตัดสินใจ commit/push/deploy ตามที่ร้องขอ. Deployment approval ไม่รวมอยู่ในงานรอบนี้.
