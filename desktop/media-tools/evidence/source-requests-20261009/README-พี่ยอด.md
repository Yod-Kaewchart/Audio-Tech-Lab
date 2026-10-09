# ข้อความขอ build-specific source สำหรับพี่ยอดตรวจ

**SENT — user-reported / AWAITING RESPONSE**

พี่ยอดแจ้งว่าส่งอีเมลถึง `builds@gyan.dev` และ `maintainers@yt-dlp.org` แล้ววันที่ **9 ตุลาคม 2026 ตามเวลาไทย (Asia/Bangkok, UTC+07:00)** ไม่ได้ระบุเวลาส่ง จึงบันทึกเฉพาะวันที่ ไม่สร้าง timestamp ของการส่ง ยังไม่มีสำเนาอีเมลส่ง, Message-ID, delivery receipt หรือคำตอบจากผู้เผยแพร่ที่ได้รับให้ตรวจสอบ สถานะนี้อิงข้อความที่ผู้ใช้แจ้งในแชต ไม่ใช่การยืนยันการส่งหรือการรับโดยเครื่องมือ

อิง [SOURCE-CLOSURE-PLAN.md ของ review r2](../source-taskbar-20261009/SOURCE-CLOSURE-PLAN.md) และ inventory เดิม ตรวจช่องทางติดต่อและ hash ของ vendor ที่ใช้อยู่เมื่อ **9 ตุลาคม 2026** ส่วน corresponding source ยังคง **BLOCKED / INCOMPLETE** จนกว่าจะได้รับและตรวจหลักฐานครบ การพบอีเมลติดต่อไม่ใช่การปิด source gate

## ติดตามคำขอ source

| ผู้รับ | วันที่ส่งที่ผู้ใช้แจ้ง / timezone | สถานะคำขอ | สถานะคำตอบ | หลักฐานที่มี |
| --- | --- | --- | --- | --- |
| `builds@gyan.dev` | 2026-10-09 / Asia/Bangkok; ไม่ทราบเวลาส่ง | SENT — user-reported | AWAITING RESPONSE | ข้อความแจ้งจากพี่ยอดในแชต; ไม่มีหลักฐานส่งหรือคำตอบที่ตรวจสอบอิสระได้ |
| `maintainers@yt-dlp.org` | 2026-10-09 / Asia/Bangkok; ไม่ทราบเวลาส่ง | SENT — user-reported | AWAITING RESPONSE | ข้อความแจ้งจากพี่ยอดในแชต; ไม่มีหลักฐานส่งหรือคำตอบที่ตรวจสอบอิสระได้ |

สถานะที่อ่านโดยเครื่องอยู่ใน [contact-verification.json](contact-verification.json) การส่งที่รายงานไม่ปิดรายการ F1–F5 / Y1–Y6 และไม่เปลี่ยน source gate เมื่อมีคำตอบจริงจึงเก็บคำตอบ/ไฟล์/แหล่งที่มาและ hashes ที่ได้รับ แล้วตรวจ coverage ตามตารางด้านล่าง ไม่เติมคำตอบหรือ source ที่ยังไม่ได้รับ และไม่กำหนดวันตอบกลับแทนผู้เผยแพร่

## ร่างที่ให้ตรวจ

| ผู้รับ | ร่างภาษาอังกฤษ | ประเด็นสำคัญ |
| --- | --- | --- |
| Gyan | [GYAN-REQUEST-DRAFT.md](GYAN-REQUEST-DRAFT.md) | ผูก ZIP + FFmpeg/FFprobe กับ SHA256; ขอ source/patches ของ 37 library rows และ 8 libraries ที่ไม่ระบุรุ่น, recipes/configuration, MSYS2 snapshot, transitive/hardware inputs และ source delivery mapping |
| yt-dlp maintainers | [YT-DLP-REQUEST-DRAFT.md](YT-DLP-REQUEST-DRAFT.md) | ผูก EXE กับ SHA256; ขอ original build/wheel mapping, custom bootloader, CPython/native dependencies, curl-impersonate, EJS preferred source และ runtime redistribution records |

เก็บ To, Subject, เนื้อหา, appendix และ placeholders `[Sender name]` / `[Reply-to email]` ของร่างเดิมไว้ ไม่ได้รับสำเนาฉบับที่ส่งจริง จึงไม่ยืนยันว่าเนื้อหา ผู้ส่ง อีเมลตอบกลับ หรือไฟล์แนบของฉบับส่งตรงกับร่างเหล่านี้ ส่วนระหว่าง `EMAIL BODY START` กับ `EMAIL BODY END` ยังเป็นร่างอ้างอิง ไม่ใช่หลักฐานการส่ง

## ช่องทางที่ตรวจจากผู้เผยแพร่โดยตรง

| ผู้เผยแพร่ | ช่องทางที่เสนอใช้ | หลักฐานจากผู้เผยแพร่ | ขอบเขตการตรวจ |
| --- | --- | --- | --- |
| Gyan | `builds@gyan.dev` | [หน้า Builds / Notes](https://www.gyan.dev/ffmpeg/builds/#notes) ระบุ “builds at this domain” สำหรับ queries; domain ของหน้าเว็บคือ gyan.dev | เป็นการแปลงคำเขียนเลี่ยงสแปมของผู้เผยแพร่เป็นที่อยู่อีเมล ยังไม่ได้ทดสอบ mailbox/delivery |
| Gyan — ทางเลือก | [GyanD/codexffmpeg issues](https://github.com/GyanD/codexffmpeg/issues) | หน้า Builds ลิงก์ไปยัง issues ของ repository นี้โดยตรง | เก็บเป็นช่องทางสำรอง ไม่ได้สร้าง issue; ร่างใช้ email เพื่อให้พี่ยอดตรวจข้อความก่อนส่ง |
| yt-dlp | `maintainers@yt-dlp.org` | [THIRD_PARTY_LICENSES.txt ที่ tag 2026.08.19](https://github.com/yt-dlp/yt-dlp/blob/2026.08.19/THIRD_PARTY_LICENSES.txt) ระบุช่องทางขอ source ของ bundled third-party components; ตรวจ [ไฟล์ปัจจุบัน](https://github.com/yt-dlp/yt-dlp/blob/master/THIRD_PARTY_LICENSES.txt) เพิ่มด้วย | อีเมลพิมพ์ไว้โดยตรงใน notices รุ่นที่ใช้; pinned/current snapshots มี SHA256 ตรงกัน ยังไม่ได้ทดสอบ mailbox/delivery |

เก็บหน้าและ notices ที่อ่านไว้ใน `publisher/` พร้อม URL, UTC timestamp, size และ SHA256 ใน [publisher-receipts.json](publisher-receipts.json) เป็นหลักฐานช่องทางติดต่อเท่านั้น ส่วน [contact-verification.json](contact-verification.json) แยกสถานะที่ผู้ใช้รายงานออกจากการตรวจส่งอิสระ หน้า Gyan ปัจจุบันใช้ตรวจช่องทางติดต่อเท่านั้น ไม่ใช้ payload ที่ URL ปัจจุบันแทน binary เดิม เก็บ publisher snapshots แบบ byte-for-byte รวม whitespace ต้นฉบับ โดยกำหนด Git attributes เฉพาะหลักฐานดิบ; เอกสารที่เขียนใหม่ยังตรวจ whitespace ตามปกติ

## สิ่งที่ต้องได้จากคำตอบเพื่อปิดรายการ

| ID ในร่าง | หลักฐานที่ยังขาด | สิ่งที่ใช้ตรวจรับคำตอบ |
| --- | --- | --- |
| F1 | core patch/no-patch declaration และ source/patch/license mapping ของ libraries; รุ่นที่ขาดของ fontconfig, iconv, GnuTLS, libxml2, GMP, bzip2, XZ/liblzma, zlib | exact commit/archive + hashes + patches หรือยืนยัน no-patch ตรงกับ build เดิม; 37 version lines ใน appendix ต้อง resolve ได้ |
| F2 | library build flags/commands และ FFmpeg/FFprobe build/link/config records | scripts + configuration + link/package manifest ที่อธิบาย executable hashes เดิมได้ |
| F3 | original MSYS2/compiler package snapshot/source packages/PKGBUILDs | รุ่นและ checksums ณ build เดิม พร้อม recipes/patches; แยก toolchain จาก runtime ที่ incorporate |
| F4 | actual transitive/hardware graph และ libmfx/libvpl mapping | ระบุ included/excluded/system components และ source/licensing scope ของ inputs ที่ใช้จริง; ไม่ตีว่ารายชื่อคำถามทุกตัว bundle |
| F5 | complete source/notices delivery set สำหรับ FFmpeg/FFprobe เดิม | mapping ที่ครอบคลุม source + modifications + scripts/instructions ที่เกี่ยวข้อง ไม่ใช่ core tarball/notice อย่างเดียว |
| Y1 | EXE-to-build/wheel/bootloader mapping และ original compiler snapshot | original release/run record, selected artifact hashes, recipe/source commits และ patch/no-patch evidence |
| Y2 | CPython native inputs/recipes; embedded Expat/mpdecimal versions | exact external sources + hashes + build/patch provenance ของแต่ละ copy; ไม่ใช้ PCbuild recipe versions เป็น binary proof |
| Y3 | native wheel build inputs | exact wheel/source/patch/compiler/configuration mapping โดยยืนยัน actual inclusion ของ recipe entries |
| Y4 | curl Windows release asset และ static dependency closure | DLL/wheel binding เดิมต่อถึง exact BoringSSL/nghttp2/ngtcp2/nghttp3/zstd/brotli/zlib inputs และ link graph |
| Y5 | EJS preferred JS/TS source, minified-file binding และ pinned build dependencies | source/lock/recipe → publisher wheel → embedded JS; npm compiled dist อย่างเดียวไม่ปิด preferred-source gap |
| Y6 | runtime DLL origin/redistribution terms/notices | original redistributable package/hash และ applicable licensing/system-component scope |

คำตอบบางรายการปิดได้เฉพาะรายการนั้น หากคำตอบเป็น source รุ่นใกล้เคียง, tarball ของ core อย่างเดียว, aggregate notices หรือ recipe ปัจจุบันที่ไม่ผูกกับ original binary ให้บันทึกสิ่งที่ยังขาดและคง overall source gate เป็น BLOCKED / INCOMPLETE

## ข้อมูลที่รวมกับข้อความได้

ร่างใช้เฉพาะ public publisher URLs, binary/input hashes, versions/commits และรายการคำถามทางเทคนิค ไม่มี path เครื่องพี่ยอด, user profile, installer logs, taskbar screenshots หรือข้อมูลผู้ใช้ในเนื้อหาอีเมล Appendix อยู่ในเนื้อหาแล้ว จึงไม่ต้องแนบ private review kit หรือ source-review archive ทั้งชุด หากภายหลังผู้เผยแพร่ขอไฟล์เพิ่ม ให้เตรียมเฉพาะข้อมูลที่สัมพันธ์กับคำถามและตรวจเนื้อหาก่อนส่ง

## Baseline และผลตรวจรอบนี้

- Branch: `codex/source-taskbar-review-20261009`
- HEAD / r2 submission commit: `3f3fc918f48dd0761fe67946a5c93be55198280c`
- Source/build commit ของ candidate: `df183f4970366597d539323760108dbaf234e049`
- Version: `0.2.2-beta.2`, unsigned
- Git status ตอนเริ่มเตรียมร่าง: clean; ก่อนเตรียม commit มีเฉพาะโฟลเดอร์ `evidence/source-requests-20261009/` ใหม่
- เก็บเฉพาะร่างและหลักฐานชุดนี้ด้วย docs-only commit ชื่อ `docs(media-tools): prepare publisher source request drafts`; ดู hash จาก Git history ของโฟลเดอร์นี้ ไม่ใช่ source/build commit ของ candidate
- commit เก็บร่างเดิม: `1a705b7b6f6339e9590e7f43dccba5c2c93c0520`; ก่อนบันทึกสถานะที่ผู้ใช้แจ้ง Git สะอาด ไม่มีร่าง/หลักฐานที่ยังไม่ commit
- รอบบันทึกสถานะนี้อัปเดตเอกสารติดตาม, รายงาน Public Beta และ source closure plan ใน working source เท่านั้น ไม่เปลี่ยน archived r2 kit/release manifest, binaries, dependencies หรือ app source และไม่ rebuild
- [validation-results.json](validation-results.json) เป็น snapshot ประวัติของช่วงเตรียมร่างก่อน commit เดิม ค่า NOT SENT/false ในไฟล์นั้นอ้างอิงช่วงตรวจเดิม ไม่ใช่สถานะคำขอปัจจุบัน; ไม่แก้ผลตรวจย้อนหลัง
- ผลตรวจรอบบันทึกสถานะ: [status-update-validation.json](status-update-validation.json)

SHA256 ของ vendor binaries ตรวจซ้ำกับ `dependencies.lock.json` แล้วและใส่ในแต่ละร่างครบ:

```text
ffmpeg.exe
3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec
ffprobe.exe
f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52
yt-dlp.exe
66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a
```

ตรวจเฉพาะเอกสาร/evidence ที่เพิ่มและความตรงของค่ากับ r2 ไม่รัน audio regression หรือ build ซ้ำเพราะไม่มีการเปลี่ยน runtime ผล Download live/EJS, clean-machine QA, signing/SmartScreen และ taskbar visual เดิมไม่ได้รับหลักฐานเพิ่มในรอบนี้
