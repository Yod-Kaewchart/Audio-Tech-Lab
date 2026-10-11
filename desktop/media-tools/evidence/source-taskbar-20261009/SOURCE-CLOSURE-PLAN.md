# Corresponding source closure — current decision, 11 October 2026

**FFmpeg BLOCKED / INCOMPLETE; yt-dlp BLOCKED / INCOMPLETE.** Continue source work for existing binaries. 84 component rows, 42 retained source/build-input files (34 archived r2 + 8 later local archives); not an exhaustive transitive SBOM or complete deliverable source bundle. Archived r2 kit/manifests remain unchanged.

## Publisher coverage

**Gyan RESPONDED — user-provided email text; yt-dlp AWAITING RESPONSE.** Second reply supplied 2026-10-11 Asia/Bangkok, deduplicated once, no original headers/independent authentication/reply timestamp. Quoted 2026-10-10 09:31 pm is Yod's request, not Gyan's reply time. [Reply review](../gyan-followup-20261011/README.md), [tracking](../source-requests-20261009/contact-verification.json). Original drafts/reply/receipts remain historical evidence.

New confirmations: GNOME/libxml2 `31094e5d0f65a528965e8c32a488e5a7f36118ca`; zlib-ng/zlib-ng `9174ab6bf58ac9a518dbe197b948c897f74834f5`, compatibility ON/all downstream in Gyan FFmpeg context; vanilla CMake for libxml2; MSYS2 origin of bzip2/GnuTLS/libiconv/GMP. These do not establish all flags/patches, exact recipe commit/architecture, GMP pkgrel, fontconfig/XZ MSYS2 origin or yt-dlp inputs. Ephemeral artifacts mostly unarchived; possible recording from 9.1 is not a promise, and no upgrade occurs.

## Necessary source versus audit evidence

A = actual preferred source/modifications and necessary generation/install/run/modify control scripts/configuration. B = additional audit/reproducibility evidence, not a blocker by itself. C = unresolved inclusion/selection/scope. Necessary scripts cannot be dismissed as optional logs; every transient log/compiler snapshot/no-patch attestation/link map is not a separately prescribed document. Apply System Library, unmodified available-tool and regenerable-material exclusions to actual content. [GPLv3 §1](https://www.gnu.org/licenses/gpl-3.0.html#section1).

Source must be the source of the distributed binaries, but a rebuilt binary need not match their SHA256. No bit-identical rebuild is an acceptance prerequisite. [GNU FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#MustSourceBuildToMatchExactHashOfBinary). Publisher opinion alone does not establish completeness. [Official snapshots](../gyan-followup-20261011/legal-receipts.json), [A/B/C issues and prior missing items](../gyan-followup-20261011/source-gap-assessment.json).

## Instruction/recipe coverage

- Core FFmpeg, saved configure arguments/compiler identity, rubberband/vid.stab and eight later sources are retained. **35 of 37 README external rows still lack collected source**; actual modifications/included transitives need coverage.
- Matching bzip2 1.0.8-4, GnuTLS 3.8.13-3 and libiconv 1.19-1 recipes cover checksummed sources, patches and prepare/build/install commands. Candidate GMP 6.3.0-2 covers release source/two patches/static/shared build/install; GMP pkgrel remains unconfirmed. MSYS2 origin is confirmed for four, exact recipe commit/architecture/patch selection remains C.
- GMP recipe uses release tarball SHA `a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898`, not Hg. Historical Hg 403 is **not a standalone blocker** for that route; reopen identity if a different checkout is indicated.
- Exact libxml2/zlib-ng upstream README/CMake provide build/install controls; compat ON is confirmed. Vanilla CMake does not itemize libxml2 iconv/ICU/zlib/thread/static/shared settings or prove no source patches. Upstream defaults and modern comparison-only MSYS2 recipes do not establish selected inputs.
- Retained controls provide partial coverage. Necessary portions of the publisher's custom combined-build scripts have not been supplied; identify which controls/configuration are needed. Missing logs alone do not cause BLOCKED. Existing 14 unchanged candidate patch checks demonstrate applicability, not publisher patch use or build success.
- yt-dlp release workflow/bundle, custom PyInstaller source/recipe, CPython source/Python packages and EJS TS/config/locks are retained. Native sources/controls, missing JS preferred sources and actual payload/runtime scope remain incomplete. Existing curl DLL-to-wheel hash binding is useful but does not close transitive source coverage. Gyan's reply adds no yt-dlp evidence.

## Remaining work

| Owner/component | A — necessary inputs | C — identify/classify | B — extra evidence |
| --- | --- | --- | --- |
| FFmpeg core/direct libraries | Actual source for 35 remaining README rows, applicable modifications/transitives and necessary custom generation/install controls | Core/library patch selection, chosen recipes/configuration/inclusion | Logs/link maps/compiler/package snapshots helpful, not individually mandatory |
| Eight version follow-ups | Selected required source/patch/config/control portions; eight archives retained | Exact recipe commit/architecture/GMP pkgrel, libxml2 flags, remaining zlib-ng selections; no MSYS2 extension to fontconfig/XZ | GMP Hg metadata unnecessary for release recipe; unchanged patch checks need not be rerun |
| FFmpeg hardware/SDK/transitives | Required included source/modifications after scope classification | CUDA/LLVM/SDK/header/runtime scope, libmfx/libvpl alias, cairo/fontconfig/GnuTLS/vorbis/rubberband branches, incorporated runtimes; package depends is not a link graph | Original manifest/link map is an evidence route, not the sole acceptable artifact |
| yt-dlp/bootloader/native wheels | Missing native source/patch/control inputs; existing workflow/recipes partly cover build | Actual bootloader/wheel selection/modifications and included/runtime scope | Runner/compiler snapshot and historic logs alone do not decide GPL source completeness |
| CPython native copies | Actual OpenSSL/SQLite/bzip2/libffi/XZ/zlib and embedded Expat/mpdecimal sources/modifications/Windows controls | Distinguish copies in CPython/cffi/curl/bootloader and selected versions | Existing hashes may establish selection without matching a rebuilt hash |
| curl-impersonate | Actual required native source/modifications/controls once identified | Actual BoringSSL/nghttp2/ngtcp2/nghttp3/zstd/brotli/zlib versions/inclusion; wheel match does not resolve all inputs | Build logs/config dumps useful |
| EJS/JS | Missing preferred JS/TS and necessary generation controls/configuration | Minified payload correspondence and required inputs; unmodified available build tools not automatically source-delivery inputs | Bit-identical output optional; source evidence is not live Download/EJS PASS |
| Runtime/union notices | Applicable delivery notices/terms once classified | Actual Windows payload origin/rights/System Library scope; no unrelated OSS tarballs or assumed platform-union inclusion | Additional provenance records helpful |

Resolve A/C sufficiently for each combined binary independently; deliver actual sources/modifications/necessary controls and applicable notices. Neither gate waits solely on B artifacts or an exact rebuilt hash. Source collection is still incomplete even if some ephemeral artifacts no longer exist.

## Identity and future delivery

Same original candidate: FFmpeg ZIP SHA `60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba`, FFmpeg `3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec`, FFprobe `f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52`, yt-dlp `66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a`. Hashes identify artifacts; they do not require rebuilt-hash identity.

Keep Setup/Portable/source review private. A future authorized release needs actual applicable preferred source/modifications/necessary controls, notices and a corresponding-source delivery route under [GPLv3 §6](https://www.gnu.org/licenses/gpl-3.0.html#section6). Mutable upstream links alone are not a retained delivery set. Workstation logs/paths/screenshots remain private. Local source archives are ignored and not uploaded by this docs-only Git backup. No public release/deploy is authorized here.

Portable taskbar PASS stays; normal taskbar visual, live Download/EJS, clean-machine installer, signing/SmartScreen and Public Beta readiness remain BLOCKED under existing evidence. No runtime test/rebuild, FFmpeg 9.1 upgrade, dependency installation, vendor/version/binary/shortcut change.

## Controlled-source build alternatives (proposal only)

| Alternative | Codecs / behavior impact | Dependencies and size | Required regression before replacement |
| --- | --- | --- | --- |
| Obtain and archive the original publisher input set | Keeps accepted codec/protocol set and candidate binaries | Source bundle likely much larger; runtime Setup/Portable unchanged. Size cannot be measured until inputs arrive | Source/build graph audit and notices delivery verification; rerun runtime tests only if binaries change |
| Rebuild a full FFmpeg configuration in a frozen source/toolchain environment | Intends to retain all existing codecs/protocols/hardware adapters; patch/config drift can change outputs | Pin every direct/transitive source + compiler/package snapshot, scripts and licenses. Broad GPLv3 graph; size may differ, **unmeasured** | Real FFmpeg/FFprobe format/metadata matrix, lossless PCM comparison, MP3/AAC/Opus/Vorbis outputs, Player seek/navigation/playlist, cancel/process cleanup/recovery, native Windows installed/Portable and Download with authorized URL |
| Build an audio-focused FFmpeg/FFprobe from the exact approved core source | Keep native PCM/FLAC/ALAC/AAC and required demuxers/metadata; pin LAME/Opus/Vorbis/ogg when required. Removing rubberband/video/hardware/network libraries reduces capability; cannot assume accepted inputs remain supported | Smaller dependency graph; likely smaller binaries but **no size claim until measured**. LGPL-compatible design is possible only after checking every selected component/license/config; changing GPL build to LGPL is not an automatic legal conclusion | Enumerate current accepted input/output formats and prove feature parity or obtain explicit approval for exclusions. Repeat all relevant audio/Player/Download/cleanup tests, package hashes and installer QA for a new candidate |
| Rebuild yt-dlp standalone from its exact release Git commit with all frozen wheels and native inputs | Keeps standalone/offline behavior; Python version, TLS/curl impersonation, bootloader and EJS changes can affect sites/runtime compatibility | Need Python/native sources, PyInstaller exception/notices, mutagen GPL source, JS preferred source and exact rollup inputs. Could grow/shrink; **unmeasured** | Actual authorized YouTube inspect/Original/MP3/lossless/cancel/network loss/retry/live EJS; Windows single-instance/packaging/clean-machine/signing QA for new hashes |

No alternative was implemented. Do not start a replacement toolchain or replace vendor binaries until a separate round selects the approach. The current beta.2 hashes remain the review candidate.
