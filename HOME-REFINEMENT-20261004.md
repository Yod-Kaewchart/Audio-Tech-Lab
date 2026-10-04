Audio Tech Labs — Soft Charcoal + Champagne Gold, 4 October 2026

หน้าแรกยังคงโครงสร้าง เนื้อหา ฟอนต์ ขนาด heading ภาพ โลโก้ ลิงก์ และ metadata เดิม ปรับเฉพาะการแสดงผลด้วย CSS ที่ใช้ระบบเดิม ไม่มี dependency เพิ่ม และไม่มีการ deploy, push หรือเปลี่ยน backend

ไฟล์ที่แก้:

- `dist/index.html`: เพิ่ม class `home-page` และโหลด `home.css` หลัง stylesheet เดิม
- `dist/home.css`: รวม design tokens ตาม palette ที่กำหนด พร้อม alias ไปยังชื่อเดิม (`--bg`, `--text`, `--muted`, `--gold`, `--line`) ภายใน `.home-page` เท่านั้น ปรับพื้น section, directional Hero overlay, รอยต่อ Hero/About, ระยะ About, section padding, การ์ด Web Demo, ตาราง Services, ปุ่มและ focus-visible
- `HOME-REFINEMENT-20261004.md`: บันทึกขอบเขต การตรวจสอบ และจุดย้อนกลับ

ก่อนแก้ตรวจพบว่าโปรเจกต์เป็น static HTML/CSS/JavaScript ไม่มี framework, package.json หรือ lint script; `dist/` เป็น source ที่ใช้จริงตาม DEPLOYMENT.md ส่วน `tools/build-pages.cjs` คัดลอกไป `.site-build/pages/` พบ CSS เดิมที่มี radial gradients อมเขียว/เหลืองใน Earbuds, Web Demo, Contact และการ์ดบางประเภท จึงเปลี่ยนเป็นพื้นเทากลางต่อเนื่องบนหน้าแรก แสงทอง 4% อยู่เฉพาะพื้นที่โลโก้ OhmGadget ภาพและสีโลโก้ไม่เปลี่ยน

คง shared stylesheet `dist/styles.css` และ JavaScript เดิมไว้ทั้งหมด รวมถึง API, routing และ audio processing สไตล์ใหม่ไม่ได้โหลดใน Split, Merge, QC, Fosi ZA3, PC Audio Reference, ADuM4165BRIZ และ HiBy AP10 ซึ่งตรวจผ่าน browser แล้ว

รายละเอียดที่เกี่ยวกับการอ่าน:

- Header/Hero ใช้ bg-deep, About/Earbuds/Services ใช้ bg-base, Web Demo ใช้ bg-section และการ์ด surface
- Hero ใช้ overlay แยกจากข้อความและไล่ขอบภาพซ้ายให้กลืน; ฝั่งขวายังเห็นวงจร ตัวอักษรแนวตั้งมีพื้นเฉพาะเพื่อรักษาคอนทราสต์
- Section padding desktop 80–104px, tablet 64px, mobile 56px; ข้อความเนื้อหาทั่วไป 16–18px และ line-height 1.8 โดยคง lead และหัวข้อเดิม
- การ์ดแยกมีรัศมี 8px; Services ยังคงตารางและเส้นร่วมเดิม ไม่มี hover ที่สื่อว่าเป็นปุ่ม
- ปุ่มเปลี่ยนสีใน 180ms ไม่มีการยกตัว; focus 2px offset 4px และรองรับ reduced motion
- ป้ายข้อความบนภาพผลงานสองใบมีพื้นเข้มเฉพาะป้ายเพื่อให้ผ่านคอนทราสต์ โดยไม่เปลี่ยนภาพ

ผลตรวจจริงบน Chrome headless ผ่าน Playwright ที่ติดตั้งอยู่เดิม:

| รายการ | ผล |
| --- | --- |
| Viewport 375, 768, 1440, 1920 × 900, DPR 1 | บันทึกก่อน/หลังครบ; ตรวจภาพ Hero และ section; ไม่พบ horizontal overflow |
| เพิ่มเติม 1024px | ไม่พบ horizontal overflow |
| ฟอนต์และภาษาไทย | Noto Sans Thai โหลดสำเร็จ; ตรวจภาพการตัดบรรทัดและข้อความใน mobile/tablet |
| ขยาย font-size 200% ที่ 375, 768, 1440px | ไม่พบ horizontal overflow หรือ text element ที่ตัดข้อความด้วย overflow:hidden |
| ข้อความบนพื้นสีล้วน | ตรวจ 187 text nodes ในรอบสุดท้าย; คอนทราสต์ต่ำสุด 7.05:1 |
| Hero | วัดบน screenshot พื้นหลังจริงใต้กรอบข้อความ หลังซ่อนข้อความโดยคง layout; ต่ำสุด 6.63:1 ในห้า viewport |
| ป้ายข้อความบนภาพผลงาน | 10.02:1 ทั้ง PC Audio Reference และ Fosi ZA3 |
| ปุ่มหลัก | ข้อความบน accent 8.46:1 |
| ขอบ control | 4.39:1 บน surface, 3.96:1 บน surface-hover; แยกจากเส้นตกแต่ง |
| Focus | accent-hover เทียบ surface-hover 7.70:1; ปุ่มหลักใช้ขาวนวลบนพื้นรอบปุ่ม |
| เมนู | เปิด/ปิดและเลือก anchor ที่ 375, 768px ผ่าน |
| Preview dialog | เปิดด้วย Enter, ปิดด้วย Escape และคืน focus ทุก viewport รวม 1024px ผ่าน |
| Reduced motion | computed transition-duration เป็น 0s |
| Browser errors / failed requests | ไม่พบในหน้าแรกที่บันทึกภาพ |
| Source invariants | เทียบ HTML กับ rollback tag หลังตัดเพียง class/link ใหม่ออก: เหมือนเดิมทั้งหมด |
| Build | `node tools/build-pages.cjs` ผ่าน |
| Lint | ไม่มี linter ที่ตั้งค่าไว้; `git diff --check`, JavaScript syntax check และการ parse CSS ใน Chrome ผ่าน |
| Existing tests | `node --test --test-concurrency=1 server/*.test.cjs tools/*.test.cjs`: 121 ผ่าน, 0 ล้ม, 0 skipped รวม real audio pipeline |

รอบ tests แรกที่ใช้ concurrency ปกติผ่าน 120/121; Windows process-tree timeout assertion ล้มหนึ่งรายการ จากนั้นรันไฟล์นั้นแยกผ่าน 2/2 และรันทั้งชุดตามลำดับผ่าน 121/121 โดยไม่แก้ test หรือ backend จึงยังควรบันทึกความไม่สม่ำเสมอของรอบแรกไว้

ข้อจำกัด: ตรวจบน Chrome/Windows ผ่าน browser automation ไม่ใช่เครื่อง iOS/Android จริง และยังไม่ได้ตรวจ Safari/Firefox หรือ screen reader; การขยาย 200% เป็นการเพิ่ม font-size ทุก element ไม่ใช่การกด browser zoom จริง การตรวจคอนทราสต์นี้ครอบคลุมข้อความและ controls ที่ระบุ ไม่ใช่การรับรอง WCAG ทั้งเว็บไซต์; ภาพ/โลโก้และตัวอักษรตกแต่ง aria-hidden ในรูปผลงานคงเดิม

ภาพและหลักฐานอยู่ใน `tools/runtime/home-refinement-20261004/` (gitignored):

- `before/` และ `after/`: `home-{width}.png`, `hero-{width}.png`, `about-{width}.png`, `earbuds-{width}.png`, `web-demo-{width}.png`, `services-{width}.png` ทุกขนาดที่กำหนด ภาพ full-page และ Hero แสดง header ตามจริง; ภาพเฉพาะ section ซ่อน sticky header ชั่วคราวเพื่อไม่ให้บังเนื้อหา
- `verification.json`, `image-labels.json`, `before/report.json`, `after/report.json`: ผล browser, contrast และ overflow
- `tests.log`, `tests-serial.log`: ผล tests ทั้งสองรอบ
- `capture.cjs`, `verify.cjs`, `image-labels.cjs`, `source-check.cjs`: สคริปต์ตรวจเฉพาะงานนี้ ไม่มีการเพิ่ม test infrastructure ในโปรเจกต์

ดูตัวอย่าง 1440px: [ก่อนปรับ](tools/runtime/home-refinement-20261004/before/hero-1440.png) / [หลังปรับ](tools/runtime/home-refinement-20261004/after/hero-1440.png) และ [Web Demo ก่อน](tools/runtime/home-refinement-20261004/before/web-demo-1440.png) / [Web Demo หลัง](tools/runtime/home-refinement-20261004/after/web-demo-1440.png)

จุดย้อนกลับ: ก่อนแก้ working tree สะอาดที่ commit `210f8ad`; สร้าง tag `rollback/home-before-soft-charcoal-20261004` และ Git bundle `tools/runtime/home-refinement-20261004/before.bundle` จากนั้นทำงานบน branch `codex/home-soft-charcoal` ยังไม่ commit/push/deploy ใช้ `git show rollback/home-before-soft-charcoal-20261004:dist/index.html` เพื่อตรวจต้นฉบับ หรือสร้าง worktree สำหรับตรวจเวอร์ชันเดิมโดยไม่ทับงานปัจจุบัน
