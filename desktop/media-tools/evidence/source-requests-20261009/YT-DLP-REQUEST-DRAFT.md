# ร่างถึง yt-dlp maintainers — ยังไม่ได้ส่ง

To: `maintainers@yt-dlp.org`

Subject: Build-specific third-party source and recipes for yt-dlp.exe 2026.08.19 (Windows x64, SHA256 identified)

ตรวจช่องทางจาก [THIRD_PARTY_LICENSES.txt ของรุ่น 2026.08.19](https://github.com/yt-dlp/yt-dlp/blob/2026.08.19/THIRD_PARTY_LICENSES.txt) และไฟล์ปัจจุบันเมื่อ 9 ตุลาคม 2026 ผู้เผยแพร่ระบุอีเมลนี้สำหรับขอ source ของส่วนประกอบที่ bundle; ยังไม่ได้ทดสอบการส่งหรือการรับอีเมล

พี่ยอดตรวจเนื้อหาและเติม `[Sender name]` / `[Reply-to email]` ก่อนใช้ ส่วนด้านล่างรวม appendix ที่ส่งได้โดยไม่มีไฟล์แนบ ไม่แนบ private review kit

<!-- EMAIL BODY START -->

Hello yt-dlp maintainers,

We are preparing Audio Tech Labs Media Tools 0.2.2-beta.2 for a private review before public release. We plan to redistribute the unchanged Windows x64 standalone yt-dlp.exe and are assembling its bundled-component source and notices. Your THIRD_PARTY_LICENSES.txt lists this address for source requests. Could you provide or identify the build-specific source, patches and recipes for the executable below, particularly the native and generated components?

```text
Release/version: 2026.08.19, Windows x64 PyInstaller standalone
Publisher asset:
https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.exe
yt-dlp.exe SHA256:
66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a
Runtime original commit:
594bd50c2c78ac432f81600d309fdc4e0a92d82c
Generated release-tag commit:
3a08beaf031ab68f966401ead017ac81fe8486cf
```

The executable matches the publisher's release checksum. We have preserved the checksum-verified release sdist and full release Git archive, including bundle/workflow scripts, hash-pinned dependencies, hooks and version-generation/lazy-extractor steps. We have also collected the identified dependency source releases, custom PyInstaller source/recipe, and EJS source/locks. We inventoried 151 CArchive entries and PYZ module names. The aggregate third-party notices cover multiple platforms, so we still need the actual Windows build mapping rather than treating every notice entry as bundled here.

The outstanding items are:

1. **Original release record and component mapping (Y1).** Please identify the build/run record linking this EXE hash to its source commits, version-generation steps, build scripts, selected wheels and their hashes, original environment/toolchain versions, and included components/licenses/notices. For modified inputs we need the patch set; otherwise please confirm unmodified upstream source. We have not reconstructed the custom PyInstaller bootloader linkage. Its pinned wheel is identified in Appendix A. Please confirm which bootloader was incorporated, its upstream/custom recipe commits, any patches and the original MSYS2/compiler package snapshot; the collected recipe's update:true does not pin that snapshot.

2. **CPython and native external inputs (Y2).** Actual runtime/DLL evidence identifies CPython 3.10.11, OpenSSL 1.1.1t and SQLite 3.40.1.0. Please identify the original Windows runtime/installer inputs and their hashes, preferred sources, patches, exact cpython-source-deps/bin-deps revisions, external-build scripts/configuration and compiler provenance. PCbuild recipes suggest bzip2 1.0.8, libffi 3.3.0, XZ/liblzma 5.2.5 and zlib 1.2.13; those recipe versions are not independent proof of the embedded copies. Expat and mpdecimal versions are still unresolved. Please distinguish separate copies used by CPython, cffi, curl and the bootloader.

3. **Compiled Python dependency wheels (Y3).** Please map the selected native wheels to exact preferred source archives/commits, checksums, patches or no-patch confirmation, and build recipes/configuration/toolchain inputs. Relevant packages include PyCryptodome/Cryptodome, Brotli, cffi, charset-normalizer, websockets and curl_cffi; please confirm which selected wheels actually contain compiled code in this EXE. Known runtime versions and additional pinned recipe entries are separated in Appendix B. An upstream sdist by itself does not identify a native wheel's actual build inputs.

4. **curl-impersonate and static native libraries (Y4).** The embedded DLL matches the curl_cffi 0.16.0 Windows wheel byte-for-byte (hashes in Appendix A). The DLL reports libcurl/8.21.0-IMPERSONATE, while the wrapper recipe selects curl-impersonate 2.0.0; we have that source archive. Please identify the original Windows curl release asset/hash and the source/patch/configuration set that produced it, including exact BoringSSL, nghttp2, ngtcp2, nghttp3, zstd, Brotli and zlib inputs as actually incorporated. Please clarify the actual static/dynamic link graph and excluded/other-platform notice entries. If another component publisher holds those records, an exact build/asset reference would help us request the remaining inputs from them.

5. **EJS generated JavaScript (Y5).** We have EJS 0.8.0 TypeScript source, rollup configuration and package lock, plus Meriyah 6.1.4 and Astring 1.9.0 npm packages. Please identify the exact preferred JS/TS sources/commits behind those packages, and map the embedded core.min.js/lib.min.js to the publisher wheel and its source/build invocation. Where a package contains only compiled distribution files, we still need its matching preferred source. Please identify the pinned rollup/build dependencies and patches needed to generate these files. This is a source request, not a report of a live Download/EJS test result.

6. **Windows runtime redistribution records (Y6).** Included DLL file versions identify VCRUNTIME140 14.29.30139.0 and UCRT/API-set DLLs 10.0.26100.1742. Please identify their original redistributable packages, checksums, redistribution terms/notices and applicable system-component scope. We are asking for accurate licensing/origin records for closed-source runtime components, not unrelated OSS source archives.

For each item, immutable archive/commit references with SHA256, component licenses/notices, source-to-binary mapping and applicable build/install scripts would help us finish the review. Please mark unavailable, excluded, unmodified upstream and system-component items explicitly. If an existing source bundle covers this exact executable, a link and coverage manifest would be ideal. A nearby release or replacement binary would not identify the original inputs. Build records can omit credentials; we are not requesting a new build.

Thank you,

[Sender name]
Audio Tech Labs
[Reply-to email]

Appendix A — already identified source/build-input and native binding hashes

```text
Release sdist: yt-dlp-2026.08.19.tar.gz
SHA256: 072aad4f2a7604e92155f61a275a4752dc64046c8f6d90df3710525d94cd37c1

Custom PyInstaller wheel: pyinstaller-6.22.0-py3-none-win_amd64.whl
Publisher release: https://github.com/yt-dlp/Pyinstaller-Builds/releases/tag/2026.08.19.215425
SHA256: 294099ecb5fdd2a13ae4c29006d4e335b697a63b6a16cf052b90ec2b40bef05a
Upstream commit: 70fc17210920bce17f4ab09bbf8104b0dbd45338
Custom recipe commit: 5eb86b862d61adc3df0f44e6e0b815b7d74fa3f5

curl_cffi wheel: curl_cffi-0.16.0-cp310-abi3-win_amd64.whl
SHA256: e22a8212d830108e977ff394237f637238e265f5f65037d6c1ee71ea8cc03bcb
Embedded DLL: curl_cffi.libs/libcurl-impersonate-ec8ead0e422fe4ae62a99233a63f6007.dll
DLL SHA256: ec8ead0e422fe4ae62a99233a63f6007adc727caba97ff1f87385c00cafe200f
Binding: byte-for-byte match between the embedded DLL and this wheel
```

Appendix B — component versions and scope of existing evidence

```text
Identified by this EXE's offline runtime diagnostic:
Cryptodome 3.23.0; brotli 1.2.0; certifi 2026.07.22; curl_cffi 0.16.0;
mutagen 1.48.1; requests 2.34.2; urllib3 2.7.0; websockets 16.1.1;
yt_dlp_ejs 0.8.0; Python 3.10.11; OpenSSL 1.1.1t; SQLite 3.40.1.
SQLite DLL file version: 3.40.1.0.

Additional pinned Windows/Python 3.10 recipe entries (requesting actual inclusion/wheel mapping):
cffi 2.1.1; charset-normalizer 3.5.0; idna 3.18;
pycparser 3.0; typing-extensions 4.16.0.

CPython recipe-derived only, embedded-version confirmation still needed:
bzip2 1.0.8; libffi 3.3.0; XZ/liblzma 5.2.5; zlib 1.2.13.
Unresolved embedded versions: Expat; mpdecimal.

EJS lock/package evidence: Meriyah 6.1.4; Astring 1.9.0.
```

<!-- EMAIL BODY END -->
