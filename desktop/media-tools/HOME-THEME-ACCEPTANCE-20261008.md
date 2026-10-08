# Media Tools — Home font/background acceptance · 8 October 2026

ปรับ Download Audio, Convert Audio และ Player ผ่านธีมกลาง `ui/theme.css` โดยใช้ค่าที่ตรวจจาก Home source และ Public จริง เก็บฟอนต์ WOFF2 ชุดเดียวกับ Public ไว้ในแอป ไม่มีการเปลี่ยน layout, markup/ข้อความ, โลโก้, controller, engine หรือ playback behavior

## จุดถอยและขอบเขต

- ตรวจ `D:\AGENTS.md`, `D:\Sites\AGENTS.md`, root และไฟล์ภายใน repository: ไม่พบ AGENTS.md
- ก่อนเริ่ม git สะอาด ไม่มีงานค้างที่ยังไม่ commit; HEAD `e36887f` บน `codex/player-continuous-playback`
- เก็บ branch `codex/media-theme-before-20261008` ที่ `e36887f` และทำงานบน `codex/media-tools-home-theme-20261008`
- การเปลี่ยนแปลงอยู่ใน `desktop/media-tools/` เท่านั้น ไม่แก้ `dist/`, Home, backend, credentials หรือ deployment และไม่ push/publish
- รุ่น runtime ยังเป็น 0.2.1; portable เป็น theme rebuild แยกโฟลเดอร์ตาม timestamp ไม่เขียนทับชุดเดิม

## Baseline ที่ตรวจได้

เปิด [Public Home](https://www.audiotechlabs.com/) ด้วย Chrome จริงผ่าน Playwright รอ `document.fonts.ready` ตรวจ computed styles และ CDP `CSS.getPlatformFontsForNode` ทั้ง viewport 1280×940 และ 360×600 เก็บ response CSS, font CSS, headers, SHA256 และภาพใน `evidence/home-theme/`

Public โหลด `styles.css` แล้ว `home.css` โดย `.home-page` overrides ค่าจาก stylesheet แรก ค่าพื้นเก่า `#0b0d0f` ใน `styles.css` จึงไม่ใช่พื้น body ที่แสดงจริง ผลเปรียบเทียบ Public กับ `dist/styles.css` / `dist/home.css`: hash byte-level ต่างกันจาก CRLF/LF เท่านั้น เมื่อ normalize line endings เนื้อหาตรงกันทั้งหมด Computed styles ที่วัดตรงกันทั้งสองขนาดหลัง normalize origin ของ URL ภาพ ไม่มีความต่างของ palette หรือ typography ให้เลือกข้าง

หลักฐาน: `reference.json`, `public-home.css`, `public-styles.css`, `public-fonts.css`, `public-home.html`, `public-home-{1280,360}.png` และสคริปต์ `test/home-theme-reference.cjs`

ฟอนต์จริง: อังกฤษ DM Sans (`familyName: DM Sans 9pt`), ไทย Noto Sans Thai ทั้งคู่ `isCustomFont: true` ไม่ใช่ system fallback น้ำหนัก Home ใช้ 400 สำหรับข้อความ, 500 สำหรับ lead/label, 600 สำหรับหัวข้อรอง/navigation, 700 สำหรับหัวข้อหลัก/ปุ่ม

ไฟล์ TTF เดิมในแอปเป็น variable font ที่มี optical axis และเลือก DM Sans optical instance ตามขนาดตัวอักษร ต่างจาก WOFF2 ที่ Public ส่งเมื่อ Google Fonts CSS ขอเฉพาะ weight จึง bundle ไฟล์ Public เดียวกันครบ 5 subsets โดยไม่แก้ binary พร้อม Unicode ranges เดิม ไม่เดาค่า optical size ใหม่ เทียบความกว้างข้อความอังกฤษ/ไทย 64 ชุด (2 ข้อความ × 4 weights × 4 sizes 14/16/21/50px) ในแอปกับ Public: ตรงกันทุกชุด

## ฟอนต์ สี และ gradient

Font stack กลาง: `"DM Sans", "Noto Sans Thai", sans-serif` รวมช่อง URL/text, dropdown, ปุ่ม, format options และ Playlist ค่า body 400 / 16px / line-height 1.8; h1 700, h2 600, h3 700, ปุ่ม 700, label/format options 500, navigation 600 คงขนาดและ spacing ของแอปเดิม

| Token | ค่า | ใช้กับ |
| --- | --- | --- |
| `--bg-base` | `#141719` | พื้นหลักทั้ง 3 หน้า; navigation โปร่งใสรับพื้นนี้ |
| `--bg-deep` | `#101214` | Header/footer, ช่องกรอก, dropdown, folder path, control ที่เลือก |
| `--bg-section` | `#191c1f` | แถบข้อมูล, source/file-picker, Playlist เพลงปัจจุบัน |
| `--surface` | `#202427` | การ์ดทุกหน้า |
| `--surface-hover` | `#272c30` | Hover ปุ่ม/format options |
| `--text-primary` | `#f0eee8` | หัวข้อ/ข้อความหลัก |
| `--text-secondary` | `#b9bec2` | ข้อความรอง/metadata/help |
| `--accent` | `#c9aa70` | ปุ่มหลัก/active navigation/progress/seek |
| `--accent-hover` | `#d8bc89` | Hover/focus |
| `--border-subtle` | `#353b40` | เส้น/ขอบการ์ด/Playlist |
| `--control-border` | `#80898f` | ขอบ input/dropdown/ปุ่ม |

Public body, header, การ์ดบริการ/เครื่องมือ และพื้น contact เป็นสีทึบ `background-image: none` จึงไม่เติม gradient ลงพื้นหลักของแอป แอปไม่มี sidebar; horizontal navigation ใช้พื้นหลักและสีจากธีมกลาง `native.css` / `player.css` ไม่ประกาศ palette หรือ font family ใหม่ที่ทับค่ากลาง ส่วนแผ่น CD ยังคง repeating radial grooves และ conic reflection เดิมโดยใช้ theme tokens เพื่อรักษา Player/โลโก้

Gradient ที่ Public ใช้จริงเป็นชั้นตกแต่งเฉพาะ Home:

- Hero image: `linear-gradient(90deg, #101214, rgba(16,18,20,0) 35%)` ทับภาพ hero
- Hero shade desktop: `linear-gradient(0deg, #141719, rgba(20,23,25,0) 24%)` และ `linear-gradient(90deg, #101214 0%, rgba(16,18,20,.98) 23%, rgba(16,18,20,.86) 53%, rgba(16,18,20,.24) 100%)`
- Hero shade mobile: ชั้นแนวตั้งจบที่ 32%; ชั้นแนวนอน `rgba(16,18,20,.96)` → `rgba(16,18,20,.78)`
- Earbuds visual: `radial-gradient(ellipse at center, rgba(201,170,112,.04), transparent 68%)`

โลโก้คงสีเดิม `#f2f0eb` / `#d0ad73` ตาม Home ไม่เปลี่ยนเป็นสี accent ใหม่

## ฟอนต์ออฟไลน์และสิทธิ์ใช้งาน

ใช้ DM Sans Google Fonts v17 และ Noto Sans Thai v29 ตาม URL ใน Public CSS มี DM Sans latin/latin-ext และ Noto Sans Thai thai/latin/latin-ext รวม 128,776 bytes บันทึก URL, SHA256, subset และ license ใน `font-manifest.json` ตรวจ binary ใน portable/installed เทียบกับ source และ manifest ไม่ใช้ฟอนต์จากระบบแทน

ทั้งสองฟอนต์ใช้ SIL Open Font License 1.1 อนุญาต bundle/redistribute กับซอฟต์แวร์เมื่อแนบ copyright/license; เก็บ `DM-Sans-OFL.txt` และ `Noto-Sans-Thai-OFL.txt` เดิมไว้ครบ ตรวจเทียบกับ [DM Sans OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt) และ [Noto Sans Thai OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/OFL.txt) แล้ว ไม่มีการขายฟอนต์แยกหรือเปลี่ยน binary

Runtime ให้บริการ `theme.css` และ WOFF2 ผ่าน allowlist `atl-media://app/` ด้วย MIME `font/woff2`, CSP `font-src 'self'` และ request policy เดิม การเตรียม UI/package ไม่ดาวน์โหลดฟอนต์; `scripts/prepare-home-fonts.cjs` เป็นขั้นตอน refresh ที่ต้องเรียกโดยตั้งใจหลังตรวจ Public reference ใหม่

## ผลตรวจจริง

| การตรวจ | ผลและหลักฐาน |
| --- | --- |
| Public/source | ตรงกันเมื่อ normalize CRLF/LF และ image origin; `reference.json` |
| รุ่นพัฒนา / portable ทั้ง 3 หน้า | ผ่าน native window 360×600 (content 344×561) และ 1280×940 (content 1264×901); `development.json`, `portable.json` |
| ฟอนต์/สี/overflow | ผ่าน computed styles, font metrics 64 ชุด, CDP custom-font glyphs, Thai text ranges, control bounds และไม่มี horizontal overflow |
| ภาพหลังปรับ | ตรวจด้วยตาทั้ง 3 หน้า ทั้ง minimum/normal; ปุ่ม/ข้อความไทยไม่ถูกตัด; ภาพ viewport และ full page เก็บคู่กัน |
| Unit/regression เดิม | 23/23, fail/skip 0; `unit.log` |
| Real media matrix | ผ่าน MP3/WAV/FLAC/ALAC, lossless PCM hash, cancellation, no-clobber, source preservation; `media-matrix.log` |
| Convert UI / output filename / reset | ผ่าน real FFmpeg job, cross-page active job, custom/blank filename, validation และเริ่มงานใหม่เคลียร์ 01/02/03; logs `ui-convert`, `filename-ui`, `reset-download`, `reset-convert` |
| Download UI | ผ่าน default ไม่มี format, start gating, 5 formats, reload และ strict native DTO; `format-development.log`, `format-portable.log` ใช้ synthetic source/submission จึงไม่ใช่ provider acceptance |
| Player รุ่นพัฒนา / portable | ผ่าน import/metadata/cover, playlist reorder/remove/reset, Play/Pause/Seek, next/previous, volume/mute, Repeat/Shuffle, keyboard และ reduced motion; `player-*.log` |
| Continuous playback รุ่นพัฒนา / portable | ผ่านสลับ 3 หน้า 20 รอบ, engine/audio ตัวเดียว, เวลา/มุม CD ต่อเนื่อง, listeners/timers คงที่, real ended ทุก repeat mode และ real Convert ระหว่างฟัง; `continuity-*.log` |
| Portable smoke | ผ่าน `isPackaged: true`, PATH เหลือ Windows System32, bundled helpers พร้อม, real ALAC convert สำเร็จและต้นฉบับ hash เดิม; `smoke-portable-portable-smoke.json` |
| Installed QA | ผ่าน per-user install, shortcuts/registry, เปิด executable ที่ติดตั้งตรวจทั้ง 3 หน้า/2 ขนาดและ exact font metrics แบบออฟไลน์, ถอน QA ครบ; profile จริง 1 ไฟล์ byte-for-byte เดิม; `installed.json`, `installer.json` |
| Build/final artifact | Directory build ผ่าน; ZIP final และ SHA256 ตรวจ/บันทึกใน `artifacts.json`; ไม่เผยแพร่ |

ใน theme acceptance จำกัด PATH เหลือ Windows System32 ตั้ง HTTP(S) proxy ไปที่พอร์ตปิด 127.0.0.1:9 และใช้ CSP/request policy production เดิม ฟอนต์โหลดจาก local protocol เท่านั้นและทดสอบไม่มี renderer external requests ไม่ได้ปิด internet ระดับ OS และไม่ใช่ Windows VM/user สะอาด

พบข้อผิดพลาดใน test harness รอบเตรียม: ตรวจสีระหว่างปุ่มยัง hover/transition, เริ่ม navigation ก่อน initial load จบ และส่ง `ELECTRON_RUN_AS_NODE` เป็น empty string ทำให้ Electron test script รันเป็น Node แก้ให้ตรวจสถานะปกติ รอ initial document จริง และนำตัวแปรออกจาก environment ตามลำดับ ไม่ผ่อน assertions หรือเปลี่ยนพฤติกรรม production เพื่อให้ผ่าน หลักฐานรอบที่ยังไม่ผ่านเก็บใน `test-output/home-theme-diagnostics/`; ผลที่อ้างในตารางคือรอบที่แก้ harness แล้วผ่าน

## ไฟล์ที่เปลี่ยน

- `ui/theme.css`: font faces/Unicode ranges และ Home tokens กลางพร้อม aliases
- `ui/media-tools.css`: import theme, ใช้ font stack กลางรวม format options; geometry เดิม
- `ui/assets/*.woff2` ใหม่ 5 ไฟล์: exact Public font binaries; notices เดิมยังอยู่
- `src/main.cjs`: เพิ่มเฉพาะ allowlist stylesheet/WOFF2 และ MIME ไม่เพิ่ม network permissions
- `scripts/prepare-ui.cjs`: ไม่คัดลอก font/palette จาก prototype มาทับธีมกลาง
- `scripts/prepare-home-fonts.cjs`: ขั้นตอน refresh จาก Public CSS ที่ตรวจแล้ว
- `scripts/package.cjs`: รวมรายงานนี้ใน portable/final ZIP
- `scripts/test-installer.ps1`: optional `-Theme` ตรวจแอปหลังติดตั้งด้วย profile แยก และซ่อนหน้าต่าง silent install/uninstall
- `test/portable-smoke.cjs`: รอ initial document ก่อนเปลี่ยนหน้า ปิด race ของ test
- `test/home-theme-reference.cjs`, `theme-acceptance.cjs`, `theme-regressions.cjs`: เครื่องมือตรวจและเก็บหลักฐานสำหรับงานนี้
- `README.md`, `DEPENDENCIES.md`, รายงานนี้ และ `evidence/home-theme/`

## ภาพทั้ง 3 หน้า

| หน้า | หน้าต่างปกติ | หน้าต่างขั้นต่ำ |
| --- | --- | --- |
| Download Audio | [ภาพทั้งหน้า](evidence/home-theme/portable-download-normal-full.png) | [ภาพทั้งหน้า](evidence/home-theme/portable-download-minimum-full.png) |
| Convert Audio | [ภาพทั้งหน้า](evidence/home-theme/portable-convert-normal-full.png) | [ภาพทั้งหน้า](evidence/home-theme/portable-convert-minimum-full.png) |
| Player | [ภาพทั้งหน้า](evidence/home-theme/portable-player-normal-full.png) | [ภาพทั้งหน้า](evidence/home-theme/portable-player-minimum-full.png) |

ชื่อภาพที่ไม่มี `-full` เป็น capturePage ของ viewport จริง ไม่ใช่ resize จำลอง ภาพ `installed-*` เป็นหลักฐานของ executable ที่ติดตั้งด้วย QA AppId แยก

Portable ที่ตรวจจริง: `release/Media-Tools-0.2.1-win-x64-20261008T155838/Audio Tech Labs Media Tools.exe` และ ZIP ชื่อเดียวกับโฟลเดอร์ ตรวจเทียบ source/payload ทั้ง `src/` และ `ui/` ทุกไฟล์แบบ byte-for-byte ใน `source-audit.json` ก่อน finalize ตัวติดตั้งที่ตรวจเป็น internal QA (`AudioTechLabs.MediaTools.InternalQA`) จาก payload เดียวกัน; ไม่ได้สร้าง/ติดตั้ง normal release candidate ใหม่ ผล build, ZIP hash และ QA installer hash อยู่ใน `artifacts.json` แยกจากตัว archive เพื่อเลี่ยง checksum อ้างอิงตัวเอง

## วิธีตรวจซ้ำ

ตั้ง `NODE_PATH` ให้มี Playwright จาก bundled workspace runtime แล้วรันจาก `desktop/media-tools/`:

```powershell
node test/home-theme-reference.cjs
# ทำเฉพาะเมื่อต้องการ refresh font baseline:
# node scripts/prepare-home-fonts.cjs
node scripts/prepare-ui.cjs
node test/theme-acceptance.cjs
node test/theme-regressions.cjs
node scripts/package.cjs --directory-only
$env:ATL_THEME_EXE=(Get-Content release/latest.json -Raw | ConvertFrom-Json).executable
node test/theme-acceptance.cjs
$env:ATL_PLAYER_EXE=$env:ATL_THEME_EXE
node test/theme-regressions.cjs
node scripts/build-installer.cjs --qa
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-installer.ps1 -Theme
node scripts/package.cjs --finalize
```

`--resume` ใน regression runner ใช้เฉพาะเพื่อไม่รันรายการที่มีผลผ่านแล้วซ้ำ ระหว่างแก้ harness; คำสั่งตรวจใหม่ตามด้านบนรันชุดเต็ม Existing evidence ที่ tests เขียนจะถูกเก็บ snapshot ใต้ home-theme แล้วคืนไฟล์เดิม ไม่รวมหลักฐานเก่าของงานอื่นใน commit นี้

## ข้อจำกัดที่ยังตรวจไม่ได้

ไม่มี `ATL_TEST_YOUTUBE_URL` ที่ยืนยันสิทธิ์ดาวน์โหลดในรอบนี้ จึงไม่ได้ทดสอบการดาวน์โหลดจาก YouTube/provider จริง ทดสอบ Download ได้ในระดับ UI/validation/reset เท่านั้น ไม่ใช้ Convert, Player หรือ screenshot อ้างว่าดาวน์โหลดจริงสำเร็จ ไม่มีการตรวจ Windows VM/user สะอาดหรือทุก DPI/การเพิ่มขนาดข้อความ OS การตรวจนี้ยืนยันเฉพาะเครื่อง Windows ปัจจุบันและขนาดที่ระบุ
