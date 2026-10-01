# Split Audio UI / Responsive — 2026-10-01

## ขอบเขตและสิ่งที่พบ

ปรับ `/demo/` ให้ใช้ typography, spacing, border/radius และขนาด controls ใกล้เคียง `/demo/merge/` โดยใช้ palette เดิมจาก `styles.css`

Source เดิมมี CSS ทับกันหลายชั้น: Hero มีค่าตั้งต้นและ compact/mobile overrides, Drop Zone ใช้ generic selectors และ track time styles มีนิยามซ้ำ รวมทั้ง breakpoint 700/900/1100px ทำให้ช่องเวลาและปุ่มถูกบีบให้อยู่ในพื้นที่เดียวกันบนจอเล็ก Hero เดิมสูงสุด 72px และปุ่ม Upload ใช้น้ำหนักหลักเท่ากับ Analyze/Export

ไม่ได้ย้ายหรือล้าง shared CSS จำนวนมาก เพิ่ม `split.css` หลัง `demo.css` และ `auth.css` แล้ว scope ทุก selector ด้วย `.split-page` โดยไม่มี `!important` ใหม่ จึงไม่เปลี่ยนหน้าหรือ behavior ของ Merge

## ไฟล์ที่แก้/เพิ่มในงานนี้

- `dist/demo/index.html`: เพิ่ม page class และ stylesheet `split.css?v=responsive1`; จัด upload heading ใน card; class เฉพาะสำหรับ Drop Zone; labels 01 / UPLOAD, 02 / ANALYZE, 03 / TRACKS, 04 / EXPORT; label สำหรับ Format; ใช้ tool navigation เดิมพร้อม current-page semantics
- `dist/demo/split.css` (ใหม่): presentation, responsive layout, ปุ่มและ disabled contrast, waveform containment, การเรียง Track controls บนจอเล็ก
- `tools/verify-split-ui.cjs` (ใหม่): browser regression ที่ใช้ temporary storage/account และ backend/audio worker จริง
- `SPLIT-UI-VERIFICATION.md` (ใหม่): รายงานนี้

ไม่มีการแก้ application JavaScript, shared CSS, Merge source หรือ backend ในรอบนี้ IDs เดิมและลำดับโหลด application scripts ตรงกับก่อนแก้ทั้งหมด ไม่เพิ่มฟังก์ชันที่ source ยังไม่มี เช่น Export ราย Track หรือการแก้ชื่อ Track

## Responsive

| Viewport ที่ตรวจ | Hero | Drop help | Waveform height | ผล |
| --- | ---: | ---: | ---: | --- |
| 1440 × 900 | 56px | 16px | 220px | ผ่าน |
| 1024 × 768 | 48px | 16px | 220px | ผ่าน |
| 768 × 1024 | 40px | 15px | 200px | ผ่าน |
| 390 × 844 | 36px | 14px | 170px | ผ่าน |
| 320 × 844 | 36px | 14px | 170px | ผ่าน |

- Desktop >=1024px ใช้ baseline; Tablet 768–1023px ลด padding/gap ก่อนขนาดตัวอักษร
- Mobile <=767px ย้าย time inputs ลงแถวเต็มความกว้าง; Small Mobile <=480px แยกชื่อ, Start/End, Play/Stop เป็นสามแถว
- ใช้ card radius 12px, ปุ่ม/input 7–8px และ Drop Zone 10px ตามภาษาภาพของ Merge
- Drop Zone ประมาณ 88px และ wrap ข้อความตามพื้นที่; หัวข้อ/ข้อความรองใช้ class เฉพาะ ไม่อาศัย `.drop-zone span`
- Waveform คงเต็มความกว้าง container; ตรวจ canvas width ตรง container และไม่มี page overflow
- ปุ่มหลัก Analyze/Export สีทอง; Upload/utility เป็น secondary; controls สำคัญและ time inputs สูงอย่างน้อย 44px
- ตรวจ contrast ของ Analyze/Upload/Export ทั้ง enabled/disabled จาก computed styles ได้ประมาณ 8.36–8.86:1

## Functional regression

ใช้ Chrome 154 บน Windows แบบ headless เปิดหน้าผ่าน Node web proxy และ backend ที่สร้างแยกใน temporary directory ไม่ใช้บัญชีหรือไฟล์ production

ผ่าน UI registration หนึ่งครั้ง และ workflow ต่อไปนี้ครบทั้ง 5 viewport:

1. Login แล้วเลือก WAV ชื่อยาว
2. Upload to Modify และ Analyze ด้วย Python/audio worker จริง
3. Waveform มีข้อมูลและ render ได้
4. เลือก Track 02 ด้วย Play, ตรวจ audio เล่นจากช่วงที่กำหนด; Stop หยุดและกลับตำแหน่งเริ่ม
5. คลิก waveform เพื่อ seek และทดสอบ Play/Stop Track 01
6. แก้ End ของ Track 01 และ Start ของ Track 02 ผ่าน inputs จริง ตรวจ boundary ที่เชื่อมกันเปลี่ยนตาม
7. Export สอง Tracks เป็น FLAC/WAV แล้วกด Download ทีละไฟล์ รวม **10 downloads**; ทุกไฟล์ตรงกับ bytes บน disk, filename ถูกต้อง และหน้าเดโมคงอยู่
8. Logout แล้ว login รอบถัดไปได้

ข้อจำกัดของ fixture: ใช้เสียง tone 12 วินาที ซึ่ง Analyze คืน 0 detections จึงใส่ boundary ทดสอบที่วินาที 6 หลัง Analyze เพื่อทดสอบ existing editor/Play/Stop/Export ไม่ได้อ้างว่า detector พบ boundary นี้เอง ชื่อ Track ยาวเป็น DOM fixture สำหรับ stress layout โดยไม่เพิ่ม title-editing behavior

ตรวจ paired tool เพิ่มเติม: Split → Merge → เลือกสองไฟล์ → reorder → Upload จริง → Merge จริง → Download FLAC → กลับ Split ผ่านทั้งหมด

## Visual และ syntax QA

- เปิดหน้าใน Chrome และตรวจภาพ Desktop/Tablet/Mobile พร้อมตรวจ DOM geometry ทุก viewport
- ไม่มี horizontal page overflow, Track controls ไม่ชนกัน, ชื่อไฟล์/Track ยาว wrap ได้, time inputs และปุ่มใช้งานได้
- ไม่มี JavaScript page errors และ broken internal anchors ที่ตรวจ
- HTML ตรวจ tag structure, IDs ไม่ซ้ำ และ label targets; CSS ทั้ง 133 rules parse ได้ ไม่มี unsupported declarations หรือ selector หลุด scope
- JavaScript syntax ของ demo.js, merge.js และ browser regression script ผ่าน
- `node --test server/*.test.cjs tools/deployment.test.cjs`: **34/34 ผ่าน**, ไม่มี fail/skip
- `git diff --check`: ผ่าน; Git แสดงเพียงคำเตือน LF/CRLF ของ working tree
- Hash ของ protected source 31 ไฟล์ตรงกับก่อนแก้ รวม Merge HTML/CSS/JS, shared styles, application scripts และ server files
- เปรียบเทียบ Merge screenshots 10 ภาพ (empty/selected tracks × 5 viewports): layout เท่าเดิม; ความต่างสีสูงสุดไม่เกิน 1/255 จากการปัดเศษ rendering และไม่มี source change

## หลักฐานและวิธีรันซ้ำ

หลักฐานอยู่ใน `.site-build/split-qa/` ซึ่งถูก Git ignore:

- `functional-results.json`: workflow/geometry/downloads แต่ละ viewport
- `style-check.json`: CSS parsing/isolation และ contrast
- `merge-visual-comparison.json`: Merge before/after comparison
- `protected-hashes.json`: hash source ที่คงเดิม
- `split-empty-{width}.png`, `split-results-{width}.png`, `tracks-{width}.png`, `login-{width}.png`
- `before-empty-{width}.png`, `after-empty-{width}.png`, `before-tracks-{width}.png`, `after-tracks-{width}.png`: Merge reference

```powershell
node --check dist/demo/demo.js
node --check dist/demo/merge/merge.js
node --check tools/verify-split-ui.cjs
node --test server/*.test.cjs tools/deployment.test.cjs
$env:NODE_PATH='C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tools/verify-split-ui.cjs
git diff --check
```

Browser script ต้องมี Chrome, Playwright และ Python environment ของ Audio Album Splitter AI ตามการตั้งค่าปัจจุบัน การทดสอบนี้ไม่ได้แทนการสัมผัสบน Android/iPad/iPhone จริง และไม่ได้ทดสอบไฟล์ production ขนาดใหญ่ในรอบ UI นี้

## Git / การส่งมอบ

Branch `main`; เก็บการแก้และไฟล์ใหม่ใน working tree ทั้งหมด งานเดิมของ Merge และไฟล์อื่นที่ยังไม่ commit คงอยู่ ไม่มี commit/push/restart/deploy ในรอบนี้
