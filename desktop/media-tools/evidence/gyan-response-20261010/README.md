# Gyan RESPONDED — user-provided email text

บันทึก follow-up วันที่ **10 ตุลาคม 2026 / Asia/Bangkok** สำหรับ binary ชุดเดิมของ candidate `0.2.2-beta.2` โดย **yt-dlp ยัง AWAITING RESPONSE** และ source gate ยัง **BLOCKED / INCOMPLETE**

[ข้อความที่ผู้ใช้ให้](gyan-user-provided-email.txt) เป็น transcription จากแชต มีการจัด whitespace เป็นช่องว่างปกติและคง transport escapes ไว้ ไม่ใช่ `.eml` หรือสำเนาที่มี headers/Message-ID; ไม่ยืนยันผู้ส่งหรือ delivery โดยอิสระ ไม่ทราบวันเวลาส่งคำตอบ บรรทัด `2026-10-09 08:41 am` เป็นวันที่ของข้อความเดิมที่ถูก quote และไม่มี timezone จึงไม่ใช้เป็น timestamp ของคำตอบหรือแก้เวลาส่งที่เคยบันทึก Hash และขอบเขตอยู่ใน [response-coverage.json](response-coverage.json)

คำตอบระบุว่า external libraries มาจาก official repos/mirrors, ให้ versions เพิ่ม 8 รายการ และบอกว่า scripts เป็น custom/non-portable แต่ไม่ได้ส่ง scripts หรือ configuration ไม่ถือข้อความนี้เป็น no-patch declaration หรือการปฏิเสธให้ source/scripts ส่วน F1/F3 มีความคืบหน้าบางส่วน; F2/F4/F5 ยังเปิด

## ช่องว่างที่เหลือก่อนร่างถามกลับ

1. Original scripts/recipes หรือส่วนที่เกี่ยวข้อง พร้อม per-library configure flags, FFmpeg configure/link commands, `config.log`/generated configuration และ static link/package manifest ยังไม่ได้รับ
2. ยังไม่มี patch/no-patch declaration ของ FFmpeg core/ทุก library และไม่มีหลักฐานว่า candidate MSYS2 recipes/patches เป็นชุดที่ Gyan ใช้จริง; fontconfig/GMP/XZ ยังไม่มี package revision ที่ผู้เผยแพร่ยืนยัน
3. `libxml2` และ `zlib-ng` resolve full commit ได้แล้ว แต่ต้องยืนยัน repo/mirror ที่ใช้จริง, local patches และ configuration โดยเฉพาะ zlib compatibility mode และ libraries ใดใช้ zlib-ng หรือ stock zlib
4. Actual transitive versions/toolchain package snapshot ยังไม่ผูกกับ binary เดิม; GMP 6.3.0 มี release source/hash แต่ Mercurial tag/full changeset ยังตรวจไม่ได้เพราะ upstream ตอบ 403

ร่างถามเฉพาะประเด็นเหล่านี้อยู่ที่ [GYAN-FOLLOWUP-DRAFT.md](GYAN-FOLLOWUP-DRAFT.md) — **DRAFT / NOT SENT** ไม่มีการส่งอีเมล/issue โดย agent

## Source/tag/full commit ของทั้ง 8 รายการ

| รายการจากคำตอบ | Upstream tag / revision ที่ตรวจได้ | Source ที่เก็บ / ขอบเขต |
| --- | --- | --- |
| bzip2 `1.0.8-4` | `bzip2-1.0.8` → `6a8690fc8d26c815e798c588f796eabe9d684cf0` | [Sourceware](https://sourceware.org/git/?p=bzip2.git;a=tag;h=refs/tags/bzip2-1.0.8); sourceware release 1.0.8; candidate MSYS2 1.0.8-4 |
| fontconfig `2.18.3` | `2.18.3` → `0f236723a3c26bd9745e32ba2b3ee21e5f809295` | [freedesktop upstream](https://gitlab.freedesktop.org/fontconfig/fontconfig/-/tree/0f236723a3c26bd9745e32ba2b3ee21e5f809295); tag archive; candidate MSYS2 2.18.3-1 |
| GMP `6.3.0` | **Mercurial tag/full node UNRESOLVED (403)**; ไม่สร้าง Git SHA แทน | [Official release announcement](https://gmplib.org/list-archives/gmp-announce/2023-July/000050.html); GNU release tar.xz SHA256 `a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898`; candidate MSYS2 6.3.0-2 |
| GnuTLS `3.8.13-3` | `3.8.13` → `b390d80208ed60f1b33ad899475951a8efb40ccd` | [Official GitLab upstream](https://gitlab.com/gnutls/gnutls/-/tree/b390d80208ed60f1b33ad899475951a8efb40ccd); GitHub mirror gives same tag/commit; release archive; candidate MSYS2 3.8.13-3 |
| iconv `1.19-1` | `v1.19` → `a8850dc314a906b7bbe49a7c60424c7b10f57236` | [GNU libiconv](https://www.gnu.org/software/libiconv/); Savannah Git tag; GNU release archive; split libiconv/iconv candidate recipe 1.19-1 |
| libxml2 `v2.15.0-126-g31094e5d` | base `v2.15.0`; target `31094e5d0f65a528965e8c32a488e5a7f36118ca`; compare **126 ahead / 0 behind** | [GNOME GitHub mirror commit](https://github.com/GNOME/libxml2/commit/31094e5d0f65a528965e8c32a488e5a7f36118ca); full-commit archive ไม่ใช้ release 2.15.0 แทน target |
| XZ `5.8.4` | `v5.8.4` → `d3e650e63c110e830fd5391e7f8b45df0b91d3da` | [Tukaani release](https://github.com/tukaani-project/xz/releases/tag/v5.8.4); release archive; candidate MSYS2 5.8.4-1 |
| zlib-ng `v1.2.8_jtkv4-2966-g9174ab6` | base `v1.2.8_jtkv4`; target `9174ab6bf58ac9a518dbe197b948c897f74834f5`; compare **2966 ahead / 0 behind** | [zlib-ng upstream commit](https://github.com/zlib-ng/zlib-ng/commit/9174ab6bf58ac9a518dbe197b948c897f74834f5); full-commit archive ไม่ใช้ zlib 1.2.8 แทน target; underscore normalized only in interpreted identifier |

แยก annotated tag object จาก peeled commit ใน `upstream/*-refs.json` และแยก tag/release จาก package revision; `-4`, `-3`, `-1` สอดคล้อง candidate MSYS2 pkgrel ไม่ใช่ upstream commit suffix หลักฐานทั้งหมดเป็น upstream resolution เทียบข้อความที่ผู้ใช้ให้ ยังไม่ใช่การพิสูจน์ source → binary

SHA256/URLs/UTC fetch times/failed requests อยู่ใน [upstream-receipts.json](upstream-receipts.json) และรายละเอียดทั้ง 8 rows อยู่ใน [upstream-resolution.json](upstream-resolution.json) Source archives ทั้ง 8 เก็บใน `archives/` เฉพาะ local และ ignored จาก Git; commit มี receipts, recipes/patches และ source text ที่เลือกพร้อม [hash receipts](source-text-receipts.json) เท่านั้น ไม่ใช่ source delivery set ที่ครบถ้วน Six release archives match candidate recipe SHA256; libxml2/zlib-ng snapshot hashes computed locally. ไม่ได้ตรวจ GPG signatures เก็บ 404 ของ URL fontconfig ที่ลองครั้งแรกและ 403 ของ GMP ไว้; fontconfig แก้เป็น URL tag archive ตาม recipe แล้วได้ hash ตรง

## Patches และ dependencies ที่ตรวจ

Candidate MSYS2 recipe commits ถูก pin เต็มใน `upstream-resolution.json`; เก็บทุกไฟล์ใน directory ณ commit นั้น รวม patches และ install metadata ผล [patch-checks.json](patch-checks.json) ตรวจ 14 patches บน disposable source trees: **13 ผ่าน git apply; bzip2 progress ผ่าน GNU patch โดยมี fuzz** หลังสอง patches ก่อนหน้า การ apply จำกัดเฉพาะ source scratch ที่ ignored ไม่รัน autoreconf/configure/build และไม่แก้ archive ต้นฉบับหรือ vendor binaries ทุก patch SHA256 ตรง PKGBUILD

| Library | Candidate patch audit | Dependency / linking implications |
| --- | --- | --- |
| bzip2 | cygming ABI/platform; autotools buildsystem; progress ของ command-line tool | ไม่มี external library ใน candidate recipe; progress patch ไม่ใช่หลักฐานว่าตัว library ที่ FFmpeg ใช้ถูกเปลี่ยน |
| fontconfig | Windows config copy/symlink และ drive-relative paths | Expat/FreeType; intl/iconv/threads ตาม feature flags. FreeType recipe ต่อไป brotli, bzip2, libpng→zlib, zlib และ conditional HarfBuzz. HarfBuzz snapshot ใน candidate recipe ไม่ตรง Git snapshot ใน Gyan README จึงห้ามใช้แทน source เดิม |
| GMP | dllimport และ macro สำหรับ static library | CPU/ABI/assembly/`--enable-fat` และ compiler choices ยังต้องยืนยัน; libraries ไม่มี external dependency ที่ recipe ระบุ |
| GnuTLS | clang; external libtasn1 detection; examples; coverage | Nettle/hogweed→GMP, libtasn1, libidn2→libunistring/iconv, intl/winpthread และ compression ตาม flags. **Static recipe ปิด p11-kit และ libdane** แม้ package depends จะมี p11-kit; ไม่สรุปว่า bundle p11-kit/libffi/unbound จากรายชื่อแพ็กเกจ |
| iconv/libiconv | configure CR/awk; pointer buffer cast; CP65001 alias และ generated tables regeneration | libcharset อยู่ใน source; แยก LGPL libraries กับ GPL iconv program และ gettext/NLS ของ tool; ไม่ถือ split tool เป็น payload โดยอัตโนมัติ |
| XZ/liblzma | candidate recipe ไม่มี patch input | liblzma เป็น 0BSD ตาม source รุ่นนี้; gettext ของ xz command ไม่ใช่หลักฐานว่า liblzma ที่เชื่อมกับ FFmpeg ใช้ gettext |
| libxml2 | เก็บ current MSYS2 2.15.4-1 เพื่อ comparison; ไม่ apply/assign patches ให้ Git target | target CMake มี iconv/threads และ optional ICU/zlib; zlib อยู่ภายใต้ legacy/feature configuration. Python/readline เป็น optional bindings/tool features; ไม่ใช้ defaults เป็น actual build flags |
| zlib-ng | เก็บ current MSYS2 2.3.3-2 naming/CMake patches เพื่อ comparison เท่านั้น | target `ZLIB_COMPAT` default OFF; ต้องยืนยัน zlib-compatible API/naming และ route ของ FFmpeg/FreeType/libpng/GnuTLS. GoogleTest เป็น test input ไม่ใช่ runtime dependency โดยอัตโนมัติ |

เก็บ candidate transitive recipes ใน `dependencies/` ที่ commit เดียวกับ parent recipe เพื่ออ่าน edges/versions/patch references ทั้ง runtime/build/test/conditional scope ไม่ทำให้ candidate dependency versions กลายเป็น versions ของ Gyan; ยังไม่ collect/verify transitive source closure ทั้งชุด และ p11-kit branch ที่ static recipe ปิดไม่ได้ถูกนับเป็น actual payload

## Inventory และขอบเขตการเปลี่ยน

อัปเดต [working inventory](../source-taskbar-20261009/SOURCE-INVENTORY.md) และ JSON เฉพาะ 8 rows พร้อม response provenance; yt-dlp component rows เดิมไม่เปลี่ยน ทุก per-component/overall source gate ยัง BLOCKED ดู [request tracking](../source-requests-20261009/contact-verification.json)

ไม่ได้เปลี่ยน FFmpeg/FFprobe/yt-dlp binaries, app code, dependency lock, archived r2 kit หรือ release manifests; ไม่ rebuild, push, merge, ส่งอีเมล, upload หรือ publish ใช้ `collect_upstream.py`/`collect-inputs.py` เก็บ read-only network evidence, `inspect_inputs.py` อ่าน source text, `verify-patches.py` ตรวจ scratch และ `apply-response.py` ทำ evidence overlay เท่านั้น ไม่เรียก historical `make-source-inventory.py` ซึ่งเขียนลง archived r2

ผล hashes/JSON/links/allowed diff และ unchanged binary checks อยู่ใน [validation.json](validation.json) Commit นี้เป็น docs/evidence follow-up ไม่ใช่ candidate build commit
