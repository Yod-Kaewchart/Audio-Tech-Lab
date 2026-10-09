# Audio Tech Labs Media Tools — Public Beta review

วันที่ 9 ตุลาคม 2026 (Asia/Bangkok) · **Candidate 0.2.2-beta.2 · UNSIGNED · ยังไม่อนุมัติให้เผยแพร่**

งานที่ไม่ติดเงื่อนไขดำเนินการครบแล้ว แต่ **Public Beta readiness = BLOCKED** ไม่ได้ push, merge main, เปิด GitHub Release, upload public หรือ deploy หน้าโหลด และไม่ได้แก้ Home/backend/tunnel/Cloudflare

## ติดตามคำขอ corresponding source — ผู้ใช้แจ้งส่งแล้ว

**SENT — user-reported / AWAITING RESPONSE** พี่ยอดแจ้งในแชตว่าส่งอีเมลถึงผู้เผยแพร่ทั้งสองรายแล้ววันที่ **9 ตุลาคม 2026 ตามเวลาไทย (Asia/Bangkok, UTC+07:00)** ไม่ได้ระบุเวลาส่ง จึงไม่สร้าง timestamp ของการส่ง

| ผู้รับ | สถานะคำขอ | สถานะคำตอบ | หลักฐาน / ขอบเขต |
| --- | --- | --- | --- |
| `builds@gyan.dev` | SENT — user-reported | AWAITING RESPONSE | ข้อความแจ้งจากพี่ยอด; ยังไม่มีสำเนาอีเมลส่ง, Message-ID, delivery receipt หรือคำตอบที่ได้รับให้ตรวจสอบ |
| `maintainers@yt-dlp.org` | SENT — user-reported | AWAITING RESPONSE | ข้อความแจ้งจากพี่ยอด; ยังไม่มีสำเนาอีเมลส่ง, Message-ID, delivery receipt หรือคำตอบที่ได้รับให้ตรวจสอบ |

ดู [เอกสารติดตาม](evidence/source-requests-20261009/README-พี่ยอด.md), [สถานะที่แยก user report ออกจากการตรวจอิสระ](evidence/source-requests-20261009/contact-verification.json) และ [ผลตรวจรอบบันทึกสถานะ](evidence/source-requests-20261009/status-update-validation.json) ร่างเดิมเก็บที่ commit `1a705b7b6f6339e9590e7f43dccba5c2c93c0520` และยังมี placeholders; ไม่ใช่หลักฐานว่าเนื้อหาฉบับส่งจริงตรงกับร่าง ไม่มีร่างหรือหลักฐานที่ยังไม่ commit ตอนเริ่มบันทึกสถานะ

Source gate ยังคง **BLOCKED / INCOMPLETE**: ยังไม่ได้รับ build-specific sources/patches/recipes ที่ปิดช่องว่างเดิม การรายงานว่าส่งแล้วไม่เปลี่ยน complete corresponding source เป็น PASS ไม่มีการเปลี่ยน candidate binaries/dependencies, build, accepted artifacts หรือ archived r2 kit

## ส่งตรวจรอบ source/taskbar r2

เริ่มจาก Git สะอาดที่ review commit `d701c1af3de9deccf5f563f276a9a0df7f2934ed` เก็บจุดถอย `codex/media-tools-before-source-taskbar-20261009` และทำงานบน `codex/source-taskbar-review-20261009` ไม่มี AGENTS.md ที่ใช้บังคับใน scope ที่ตรวจ รายละเอียดใน `evidence/source-taskbar-20261009/checkpoint.json`

Source/build commit ของแอปและ Setup ยังคง `df183f4970366597d539323760108dbaf234e049` รุ่น `0.2.2-beta.2` / FileVersion `0.2.2.2` / unsigned ไม่เปลี่ยน source/UI/behavior/vendor/dependencies รุ่นแอปหรือ Setup/Portable ที่ยอมรับแล้ว ตรวจ hash ของ Setup/Portable/source-review เดิมทั้งต้นฉบับและสำเนาใน kit รวม 6 ไฟล์ตรง manifest (`baseline-artifact-hashes.json`) แยก review evidence commit และ manifest commit จาก source/build commit ผ่าน release manifest และ Git history

Review evidence commit รอบนี้: `0351649cbb5b5152bb1edc9c040ac816ecdf49a3` ส่วน commit ประกอบ manifest/kit เป็น documentation commit ถัดมา ดู `submission-commit.json` ใน private kit หลัง commit ไม่ใช้ review commit แทน build commit และไม่พยายามฝัง SHA ของ commit ตัวเองในไฟล์ที่ commit นั้น hash อยู่

| รายการรอบนี้ | ผล | หลักฐาน / ขอบเขต |
| --- | --- | --- |
| Baseline hashes/checkpoint | PASS | baseline-artifact-hashes.json; checkpoint.json; ชุดเดิมเก็บไว้ |
| ระบุ component/version/source provenance | PASS เฉพาะการรวบรวม | SOURCE-INVENTORY.md/json: 84 แถว, source/build-input 34 ไฟล์พร้อม publisher URLs/SHA; ไม่ใช่ complete transitive SBOM |
| Complete corresponding source ของ FFmpeg/yt-dlp | BLOCKED / INCOMPLETE | SOURCE-CLOSURE-PLAN.md: FFmpeg 37 version lines + 8 libs ไม่ระบุรุ่น, exact publisher patches/build/link graph ยังขาด; yt-dlp native inputs, Windows redistributable notices, EJS preferred-source/build linkage ยังไม่ครบ |
| ผูก native curl DLL กับ publisher wheel | PASS เฉพาะ hash mapping | curl-native-binding.json; DLL SHA ตรง wheel Windows cp310-abi3 ของ curl_cffi 0.16.0; ไม่ยืนยัน transitive source/config ทั้งหมด |
| เปิด EXE ซ้ำ normal installed app | PASS | normal-installed-single-instance.json: process ตัวที่สองออก 0, UI เดิมหนึ่งหน้าต่างได้รับ focus; เปิด EXE โดยตรงผ่าน Playwright ด้วย profile ทดสอบแยก ไม่อ้าง shortcut visual PASS |
| เปิด EXE ซ้ำ Portable | PASS | portable-single-instance.json: เปิด extracted candidate EXE จริง hash ตรง, process ตัวที่สองออก 0, หน้าต่างเดิม focus |
| Taskbar icon/name/grouping ภาพจริง — normal และ Portable | BLOCKED | normal/portable-supported-windows.json ไม่มี taskbar surface; ภาพ *-app-window-NOT-TASKBAR.png เป็น app window เท่านั้น; เตรียม TASKBAR-MANUAL-QA-พี่ยอด.md |
| ข้อมูลผู้ใช้และ shortcut เดิม | PASS ใน scope รอบนี้ | normal-cleanup.json: profile เดิม 73 ไฟล์และ Desktop shortcut hash ไม่เปลี่ยน; test normal installation ถอนออกแล้ว ไม่มีการเปิดงานเสียง/เขียนไฟล์เสียงเดิม |
| Download live / live EJS | BLOCKED | ยังไม่มี URL พร้อมการยืนยันสิทธิ์; offline startup/source inventory ไม่ใช่ live acceptance |
| Clean-machine installer QA | BLOCKED | ยังไม่มี Windows/VM สะอาดพร้อมช่องทางเข้าถึง; ไม่ใช้ existing-machine แทน |
| Signing / SmartScreen | BLOCKED | ไม่มี certificate/service ที่อนุญาต; คง unsigned และไม่ตรวจ reputation ด้วยไฟล์ local |
| Checks เอกสาร/evidence/source ZIP | PASS | checks.json และ syntax-checks.json; JSON/Python/Node/PowerShell syntax, archive CRC/ทุกไฟล์ SHA, vendor/dependency lock/accepted artifacts ไม่เปลี่ยน; ไม่รัน audio regression ทั้งชุดซ้ำเพราะ runtime ไม่เปลี่ยน |

Source-review ใหม่: `release/Audio-Tech-Labs-Media-Tools-Source-Review-0.2.2-beta.2-r2-INCOMPLETE.zip` ขนาด **74366790 bytes**, SHA256 **3445fc139ac50b75bd6aeb156e9ad19ea49b4192aa0a827e1840ec44bf5ba08a**; โฟลเดอร์ `release/source-review-0.2.2-beta.2-r2-INCOMPLETE` เก็บชุดเก่าไว้ทั้งหมด ไม่ใช่ source ที่พร้อมแจก Public มี publisher wheels ใน build-inputs สำหรับตรวจ provenance เท่านั้น

ชุดส่งตรวจใหม่ `release/review-0.2.2-beta.2-r2-11549c34e61f` แยก `private-evidence/` (path/log/screenshots ของเครื่อง) ออกจาก `candidate/` (Setup/Portable เดิม) และ `source-review/` (INCOMPLETE) ดู release-manifest.json/README ในชุดนี้ ห้ามแจกทั้ง kit เป็นแพ็กเกจผู้ใช้ รายงานและ evidence รอบก่อนยังเก็บใน kit เดิมและ Git baseline

งานถัดไป: รอคำตอบสำหรับคำขอ exact build-specific source/input set ที่พี่ยอดแจ้งว่าส่งแล้ว เมื่อได้รับจึงตรวจ source/patches/recipes/hashes ตาม SOURCE-CLOSURE-PLAN.md; ทางเลือก build ที่ควบคุม source ยังเป็นข้อเสนอสำหรับรอบใหม่ ไม่ได้เริ่มทำ พี่ยอดตรวจ taskbar ด้วยภาพ desktop/taskbar จริงของทั้งสองแบบตาม worksheet; เตรียม URL/สิทธิ์ Download, clean Windows และ signing เมื่อพร้อม ไม่มีการเริ่ม replacement toolchain หรือเปลี่ยน vendor รอบนี้

## Baseline beta.2 จากรอบก่อน (เก็บ artifacts เดิม)

App source และ installer recipe ใช้ commit เดียวกัน: `df183f4970366597d539323760108dbaf234e049` รุ่น Windows numeric/FileVersion `0.2.2.2` และ ProductVersion `0.2.2-beta.2` Electron version ไม่ถูกใช้เป็น FileVersion ของแอป

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| Audio-Tech-Labs-Media-Tools-Setup-0.2.2-beta.2-Win64.exe | 210937650 | `11549c34e61f94dab4170e781db2176fbd2def6add9de849a2ea8fc0bc901c27` |
| Media-Tools-0.2.2-beta.2-win-x64-20261008T181605577.zip | 288706248 | `3b17cfe6d19d03375c86a23a37ce62d8f69f4261a091bedb19db47f5724dbdfc` |
| Audio-Tech-Labs-Media-Tools-Source-Review-0.2.2-beta.2-INCOMPLETE.zip | 23335381 | `26e1ce545a97722dc5685631b6f49fdc4ca0defbba210d3f0573f3e2db79e42a` |

Main EXE SHA256: `94b0deb9e81e26c2aec82551c811811de415214666ec1622d9e326946ed8a05d`

SHA256SUMS.json SHA256: `7751028de3baecfe7724326b52fb3d836075fe4738ac3b9f157d6f2b793e6073`

Source review archive ใช้ dependency source ชุดเดียวกับ beta.1 เพราะไม่มีการเปลี่ยน dependency เป็น **ชุดตรวจที่ยังไม่ครบ** ไม่ใช่ complete corresponding source ห้ามนำไปอ้างว่าผ่าน GPL source gate

ดู version/commits/dependencies/runtime/size/SHA256 และสถานะรายข้อใน `evidence/public-beta/release-manifest.json` ชุด review อยู่ใน `release/review-0.2.2-beta.2-11549c34e61f` มี Setup/Portable/source review, docs, preview และ QA evidence แยกต่างหาก **review kit เป็น private มี log/path ของเครื่องทดสอบ ห้ามแจก review kit เป็นแพ็กเกจผู้ใช้** Setup/Portable ไม่รวมหลักฐานเหล่านี้

## สถานะและหลักฐาน

| รายการ | ผล | หลักฐาน / ขอบเขต |
| --- | --- | --- |
| AGENTS/status/branch/HEAD และ checkpoint | PASS | ไม่มี AGENTS.md ใน ancestor/project ที่ใช้บังคับ; เริ่มจาก working tree สะอาดที่ eac4e97; checkpoint.json |
| Folder guard release failure | PASS | unit.log (31/31), folder-recovery-ui.json และภาพ recovery ทั้ง Download/Convert สองขนาด |
| Concurrent inspection cleanup ไม่เขียนทับ recovery | PASS | regression test ใหม่ตรวจ job ID/marker เดิมและ restart ยัง BUSY |
| ปฏิเสธ payload เก่า/ขาด/ผิด checksum ก่อน Setup | PASS | payload-validation.json, installer-rejection.json, stale-0.2.1-rejection.json |
| ProductName/FileVersion/ไอคอน EXE และ Setup | PASS | setup-branding.json, PE icon image hashes ทั้ง 4 ขนาด, payload-validation.json |
| ไอคอน window จริง | PASS | windows-icon.json: WM_GETICON 16/32 px ตรง source PNG ใน ICO แบบ pixel ต่อ pixel; native-window.png |
| Shortcuts/uninstall icon และ AppUserModelID | PASS | normal-installer.json: Desktop/Start Menu TargetPath/IconLocation, System.AppUserModel.ID และ registry DisplayIcon |
| ภาพไอคอนบน taskbar จริง | BLOCKED | native window inventory ที่รองรับไม่เปิด taskbar ให้ตรวจ; การตรวจ AppUserModelID/shortcut ไม่ถูกนับเป็น taskbar visual PASS |
| Download live acceptance ทุกกรณี | BLOCKED | ผู้ใช้ยืนยันว่าไม่มีลิงก์พร้อมสิทธิ์ทดสอบ inspect/Original/MP3/lossless/cancel/network loss/retry/EJS จึงไม่ได้รัน live Download |
| Notices และ bundle ฟอนต์ offline | PASS | Electron/Chromium, Node, FFmpeg, yt-dlp และ OFL notices อยู่ใน payload; portable.json, normal-installed.json |
| Complete corresponding source | BLOCKED | source-review.json และ source archive มี upstream source แต่ยังขาดหลักฐาน exact external sources/patches/build scripts/bundled GPL components |
| Normal installer บนเครื่องเดิม | PASS | fresh → uninstall → 0.2.1 baseline → upgrade beta.2 → uninstall → reinstall beta.2 → เปิดตรวจ → uninstall; normal AppId จริง |
| Normal installer บน Windows สะอาด | BLOCKED | ผู้ใช้ยืนยันไม่มี Windows/VM สะอาดและช่องทางเข้าถึงที่ยืนยันไว้; ไม่ใช้ QA AppId หรือจำกัด PATH แทน |
| ข้อมูลผู้ใช้/ไฟล์เสียง/shortcut | PASS ในขอบเขตทดสอบ | profile เดิม 73 ไฟล์ hash ไม่เปลี่ยนทุกขั้นตอน; ไฟล์เสียง fixture นอก install/profile ที่สร้างก่อน QA ไม่เปลี่ยน; Desktop shortcut เดิมคืน hash ตรงเดิม |
| Signing และ SmartScreen | BLOCKED | ไม่มี certificate/บริการที่อนุญาต; EXE/Setup เป็น NotSigned; ไม่ตรวจ reputation หรือ browser-origin SmartScreen |
| Defender บนเครื่องนี้ | PASS ในขอบเขต scan | Setup/ZIP/expanded payload ไม่พบ threats; defender-setup/portable.json และ scan logs อ้างอิง hash ชุดนี้ |
| Convert/Player/เริ่มงานใหม่/เล่นต่อระหว่างเปลี่ยนหน้า | PASS | development-regressions.json, portable-regressions.json; FFmpeg จริงและ packaged executable จริงจาก ZIP ที่แตกแล้ว |
| ทั้ง 3 หน้า min/normal และภาษาไทย | PASS | portable.json, normal-installed.json; native 360×600 และ 1280×940; overflow/clippedThai ว่าง; custom font glyphs ถูกใช้จริง |
| ข้อมูลภายใน runtime payload | PASS ในขอบเขตตรวจ | strict allowlist 130 ไฟล์ (129 entries + SHA256SUMS.json); package-content-scan.json ตรวจ 45 text files ไม่พบ workstation/test paths; ไม่อ้างว่าเป็น exhaustive binary secret audit |
| คู่มือ/release notes/preview/manifest | PASS | release-docs และ download-preview.json: เปิด local file ที่ 360/1280; ฟอนต์ loaded; ไม่มี overflow; download buttons disabled |

ไม่มี FAIL คงค้างในงานที่รันได้ การ build รอบแรกที่ใช้ semver ในช่อง Windows numeric และข้อผิดพลาดของ test harness ได้แก้และรันทดสอบใหม่แล้ว ไม่ได้นำผล beta.1 มานับแทน beta.2

## การแก้ที่สำคัญ

`registerFolder()` ไม่คืน destination token จนกว่า guard.release() สำเร็จ แม้ release โยน error ก็ปลด setupBusy ใน finally แล้วสร้าง job cleanup-required พร้อมข้อความกู้คืนและ persisted recovery marker ตัวตรวจเริ่มงาน/เลือกไฟล์/โฟลเดอร์/inspect/reset ยังคง BUSY การเปิดแอปใหม่ไม่ถือว่าไม่มี staging คือปลอดภัย และ cleanup ของ inspection เดิมไม่ลบ marker นี้

Recovery ใช้การตรวจโดยผู้ดูแลตาม RECOVERY.md ไม่มีปุ่ม bypass/reset อัตโนมัติ ต้องปิดแอป ยืนยัน process/handles และไฟล์ check ของงานก่อน จึงสำรองและย้ายเฉพาะ current-job.json เพื่อคืนการใช้งาน ไม่ลบ profile หรือไฟล์เสียง หากเขียน recovery ลงดิสก์ไม่สำเร็จ UI จะแจ้งข้อจำกัด ต้องตรวจด้วยตนเองก่อนเปิดใหม่ ไม่อ้างว่ามี durable record ในกรณีดิสก์เขียนไม่ได้

UI recovery test ใช้ native app window จริงและ Windows guard จริง ฉีด release error หลัง guard ปิดแล้ว แต่ native file dialog ถูกแทนด้วย test response จึงไม่อ้างว่าทดสอบปฏิสัมพันธ์กับ dialog จริง

Installer validation เปรียบเทียบ inventory/hash ของทุกไฟล์ src/ui/assets (รวม fonts/licenses), package metadata/version, vendor manifest กับ dependencies.lock.json และ hash ทุก binary, notices, helper source, Electron runtime, icon, release docs และ SHA256SUMS รวมถึงปฏิเสธไฟล์เกิน การทดสอบ entry point จริงใช้ isolated invalid payload: ลบ/แก้ Thai WOFF2 และแก้ FFmpeg checksum ถูกปฏิเสธก่อนถึง compiler แล้วคืน latest receipt byte-for-byte โดยไม่เปลี่ยน candidate

EXE ถูกแก้ resources ด้วย rcedit 2.0.0 ที่ pin SHA256 ไว้ใน build-tools.lock.json (build-only ไม่อยู่ใน payload) ใช้ชื่อ Audio Tech Labs Media Tools และ ICO เดียวกันทั้ง EXE/window/Setup/shortcuts/uninstall ใช้ AppUserModelID AudioTechLabs.MediaTools

แก้เฉพาะ recovery, build/installer/resources, รุ่นที่แสดงใน footer และเอกสาร/test tooling ไม่มีฟีเจอร์ใหม่ ฟอนต์/สี/layout/โลโก้และการทำงานอื่นคงมาตรฐาน 0.2.1: DM Sans + Noto Sans Thai + sans-serif; พื้นหลัก #141719, header #101214, cards #202427, text #f0eee8/#b9bec2, accent #c9aa70; shared theme เดิม ไม่เพิ่ม gradient พื้นหลัก

ไฟล์หลัก: src/engine.cjs, src/main.cjs, ui/view.js, ui/assets/media-tools.ico, package.json/lock, installer/media-tools.iss, scripts/package.cjs/build-installer.cjs/verify-payload.cjs/windows-brand.cjs/test-normal-installer.ps1/prepare-review-kit.cjs, build-tools.lock.json, regression tests, release-docs และ evidence/public-beta ดู diff ฉบับเต็มใน evidence/public-beta/changes.patch

## ใบอนุญาตและส่วนที่ยังต้องปิดก่อนเผยแพร่

FFmpeg ที่ bundle เป็น Gyan **static GPLv3** (`--enable-gpl --enable-version3 --enable-static`) ไม่ใช่ LGPL-only build ผู้สร้างระบุ FFmpeg commit `946fcce07b6dcd0331c8cc609192aeff5e1924f8` การมี upstream tarball อย่างเดียวไม่ยืนยัน exact corresponding source ของ external libraries และ build recipe ที่ใช้สร้าง binary นี้ [Gyan publisher](https://www.gyan.dev/ffmpeg/builds/), [FFmpeg legal](https://ffmpeg.org/legal.html)

yt-dlp main source เป็น Unlicense แต่ Windows PyInstaller executable เป็น **combined GPLv3+** ตาม upstream ต้องตรวจ source/build inputs ของส่วนที่ bundle ด้วย release tarball และ SHA256 จาก publisher เก็บแล้ว แต่ completeness/rebuild ยังไม่ยืนยัน [yt-dlp licensing](https://github.com/yt-dlp/yt-dlp/blob/2026.08.19/README.md#licensing), [GPLv3 corresponding source](https://www.gnu.org/licenses/gpl-3.0.html)

Node vendor 24.19.0; FFmpeg/FFprobe 9.0.2; yt-dlp 2026.08.19; ProcessHost 1.0.0; Electron 44.7.0 runtime ตรวจจริง Chromium 152.0.7977.130 และ embedded Node 24.21.0 (คนละตัวกับ vendor JS runtime) Inno compiler 6.7.3 และ license ที่ติดตั้งอนุญาตใช้/แจกภายใต้เงื่อนไข copyright เดิม ไม่แก้ engine copyright ข้อมูลเต็มอยู่ใน release manifest

Live Download/EJS ต้องมี URL และสิทธิ์ทดสอบตามเจ้าของก่อน ผล reset/form tests ที่ใช้ test DTO และ Convert จริงเป็น regression เท่านั้น **ไม่ใช่ Download PASS** local yt-dlp startup/config diagnostic ก็ไม่ยืนยัน live EJS

Clean-machine QA ต้องเริ่มจาก Windows สะอาดจริง ตรวจ fresh/upgrade/uninstall/reinstall และข้อมูลผู้ใช้กับ candidate hash ที่อนุมัติ Signing จะเปลี่ยน hash ต้องสร้าง manifest และทดสอบ signed candidate ใหม่ก่อนให้อนุมัติเผยแพร่ การเปิด EXE จากไฟล์ local ไม่มี download-origin SmartScreen evidence ไม่ใช่ SmartScreen PASS

Defender ตรวจแบบ local custom scan/DisableRemediation ตาม [Microsoft command documentation](https://learn.microsoft.com/en-us/defender-endpoint/command-line-arguments-microsoft-defender-antivirus) signature 1.459.601.0; ไม่พบ threats สำหรับชุดนี้ ณ เวลาทดสอบ ไม่ได้ส่ง submission command ไม่ได้เปลี่ยน security settings และผลนี้ไม่รับรองผลจากเครื่องอื่น/definition ในอนาคต

## Checkpoint และ Git

เริ่มที่ `eac4e97001aab5b532ccea0685a047e7dbd32b11` / 0.2.1 branch เดิม codex/media-tools-home-theme-20261008 สร้างจุดถอย `codex/media-tools-before-beta-20261009` และทำงานบน `codex/public-beta-prep-20261009` ไม่พบงานที่ยังไม่ commit ก่อนเริ่ม

Portable เดิม hash `27b83f685c2d46e9a6d365bfac108ba7bce7ccf393615641f5cc11639a616934` และ Setup เดิม hash `bc66cc369fa891e16527f08a20d7c019719d75b9806c11b6a26680b77b1a937e` ยังคงเก็บอยู่ ไม่เขียนทับ artifacts เก่า รายละเอียดรวม QA installer เดิมอยู่ใน checkpoint.json intermediate beta.1 และ receipts เก็บไว้ใน test-output/beta1-evidence และ release เพื่อใช้ถอยกลับ

Commits: e926ca7 (recovery/package verification/branding), d6ff700 (installer numeric/text version), df183f4 (concurrent recovery + final beta.2 source) และ commit ส่งตรวจที่บันทึก evidence/report เพิ่ม โดยไม่เปลี่ยน app payload หลัง build ใช้ git log/status เพื่อดู commit ส่งตรวจสุดท้าย ไม่มี push
