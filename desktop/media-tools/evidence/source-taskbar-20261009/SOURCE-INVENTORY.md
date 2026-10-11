# Source inventory — current review 11 October 2026

**BLOCKED / INCOMPLETE — FFmpeg and yt-dlp assessed separately.** 84 component rows, 42 retained source/build-input files (34 archived r2 + 8 later local archives). This is not an exhaustive transitive SBOM.

Gyan **RESPONDED — user-provided email text**; yt-dlp **AWAITING RESPONSE**. The second reply confirms libxml2/zlib-ng repo/full commit, zlib compatibility ON/downstream usage in Gyan FFmpeg context, vanilla CMake for libxml2, and MSYS2 origin for bzip2/GnuTLS/libiconv/GMP. Publisher assertions remain separate from independent binary verification.

A = necessary preferred source/modifications/build controls; B = additional audit/reproducibility evidence; C = unresolved inclusion/selection. B alone does not block the source gate. GPL does not require a bit-identical rebuild. [Current assessment](../gyan-followup-20261011/README.md) · [issue details and per-row reassessment](../gyan-followup-20261011/source-gap-assessment.json) · [closure plan](SOURCE-CLOSURE-PLAN.md).

The 35 remaining README external-library rows without collected source are the main known FFmpeg collection gap. Custom control scripts needed for generation/install are still not supplied; upstream instructions and recipes cover only part of the combined build. Actual patch/graph/configuration choices remain C. GMP Mercurial metadata is no longer a standalone blocker for the MSYS2 release-tarball route.

| Component | Version / provenance | Presence | Source archives | Review issues | Status |
| --- | --- | --- | ---: | --- | --- |
| FFmpeg / FFprobe core (avcodec,avformat,avutil,avfilter,avdevice,swresample,swscale) | 9.0.2; 946fcce07b6dcd0331c8cc609192aeff5e1924f8 | confirmed | 1 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS, B-TOOLCHAIN, B-EXACT-HASH | BLOCKED |
| FFmpeg external: AMF | v1.5.2-2-gc35f613 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: aom | v3.15.0-25-g023743a7d7 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: AviSynthPlus | v3.7.5-383-g5c82777b | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: cairo | 1.18.5 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: ffnvcodec | n13.1.15.0-1-geddcea9 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: freetype | VER-2-14-3 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: fribidi | v1.0.16-19-gc928e4c | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: gsm | 1.0.24 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: harfbuzz | 14.4.0-108-g64e2b532 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: lame | 3.100 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: libass | 0.17.5-8-gb2fe9d8 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: libgme | 0.6.6 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: libopencore-amrnb | 0.1.6 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: libopencore-amrwb | 0.1.6 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: libssh | 0.12.2 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: libtheora | v1.2.0 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: libwebp | v1.6.0-249-g1f34635 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: openal-soft | 1.25.2-48-g7532541 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: openjpeg2 | 2.5.4 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: openmpt | libopenmpt-0.6.30-3-g6c0a06bc | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: opus | v1.6.1-68-g503d81b1 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: rubberband | v4.0.0 | confirmed | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: SDL | release-2.32.0-234-gb90ac9502 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: speex | Speex-1.2.1-51-g0589522 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: srt | v1.5.7-7-gcae8f62 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: VAAPI | 2.25.0. | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: vidstab | v1.1.2-214-ge2445c4 | confirmed | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: vmaf | v3.2.0-13-gf85a8536 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: vo-amrwbenc | 0.1.3 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: vorbis | v1.3.7-37-g1b75110b | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: VPL | 2.17 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: vpx | v1.17.0-57-gd2413e2ca | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: x264 | v0.165.3223 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: x265 | 4.3-45-g116b875 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: xvid | v1.3.7 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: zeromq | 4.3.5 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: zimg | release-3.0.6-253-g67e0603 | confirmed | 0 | A-FF-SOURCE, A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, B-LOGS | BLOCKED |
| FFmpeg external: fontconfig | 2.18.3; upstream 0f236723a3c26bd9745e32ba2b3ee21e5f809295 | enabled in baseline; version publisher-reported via supplied email text | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, C-FF-RECIPES, B-LOGS, B-TOOLCHAIN | BLOCKED |
| FFmpeg external: iconv | 1.19-1; upstream a8850dc314a906b7bbe49a7c60424c7b10f57236 | enabled in baseline; reported version and MSYS2 package origin publisher-confirmed via supplied email text | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, C-FF-RECIPES, B-LOGS, B-TOOLCHAIN | BLOCKED |
| FFmpeg external: gnutls | 3.8.13-3; upstream b390d80208ed60f1b33ad899475951a8efb40ccd | enabled in baseline; reported version and MSYS2 package origin publisher-confirmed via supplied email text | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, C-FF-RECIPES, B-LOGS, B-TOOLCHAIN | BLOCKED |
| FFmpeg external: libxml2 | v2.15.0-126-g31094e5d; upstream 31094e5d0f65a528965e8c32a488e5a7f36118ca | enabled in baseline; version and exact source repository/commit publisher-confirmed via user-provided email text | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, C-FF-XML-CONFIG, B-LOGS, B-TOOLCHAIN | BLOCKED |
| FFmpeg external: gmp | 6.3.0; release tarball SHA256 pinned; MSYS2 origin confirmed; package revision unconfirmed | enabled in baseline; reported version and MSYS2 package origin publisher-confirmed via supplied email text | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, C-FF-RECIPES, B-LOGS, B-TOOLCHAIN, B-GMP-HG | BLOCKED |
| FFmpeg external: bzlib/bzip2 | 1.0.8-4; upstream 6a8690fc8d26c815e798c588f796eabe9d684cf0 | enabled in baseline; reported version and MSYS2 package origin publisher-confirmed via supplied email text | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, C-FF-RECIPES, B-LOGS, B-TOOLCHAIN | BLOCKED |
| FFmpeg external: lzma/xz | 5.8.4; upstream d3e650e63c110e830fd5391e7f8b45df0b91d3da | enabled in baseline; version publisher-reported via supplied email text | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, C-FF-RECIPES, B-LOGS, B-TOOLCHAIN | BLOCKED |
| FFmpeg external: zlib | v1.2.8_jtkv4-2966-g9174ab6; upstream 9174ab6bf58ac9a518dbe197b948c897f74834f5 | enabled in baseline; version and exact source repository/commit publisher-confirmed via user-provided email text | 1 | A-FF-CONTROL, C-FF-PATCHES, C-FF-GRAPH, C-FF-ZLIB-CONFIG, B-LOGS, B-TOOLCHAIN | BLOCKED |
| FFmpeg hardware / SDK / transitive inputs | AMF/ffnvcodec/VAAPI/VPL versions above; remaining UNKNOWN | confirmed | 0 | C-FF-GRAPH, C-FF-PATCHES, B-LOGS, B-TOOLCHAIN | BLOCKED |
| yt-dlp application | 2026.08.19; original 594bd50c2c78ac432f81600d309fdc4e0a92d82c; generated release 3a08beaf031ab68f966401ead017ac81fe8486cf | confirmed | 2 | A-YT-NATIVE, A-YT-JS, A-YT-CONTROL, C-YT-MAPPING, B-EXACT-HASH | BLOCKED |
| PyInstaller bootloader / runtime hooks | 6.22.0; upstream 70fc17210920bce17f4ab09bbf8104b0dbd45338; custom recipe 5eb86b862d61adc3df0f44e6e0b815b7d74fa3f5 | confirmed | 2 | A-YT-CONTROL, C-YT-MAPPING, B-LOGS, B-TOOLCHAIN | BLOCKED |
| CPython runtime / standard library | 3.10.11 (python310.dll and offline diagnostic) | confirmed | 1 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS, B-TOOLCHAIN | BLOCKED |
| yt-dlp Python package: mutagen | 1.48.1 | module confirmed | 1 | C-YT-MAPPING | BLOCKED |
| yt-dlp Python package: pycryptodomex | 3.23.0 | module confirmed | 1 | A-YT-CONTROL, C-YT-MAPPING, B-LOGS, B-TOOLCHAIN | BLOCKED |
| yt-dlp Python package: brotli | 1.2.0 | module confirmed | 1 | A-YT-CONTROL, C-YT-MAPPING, B-LOGS, B-TOOLCHAIN | BLOCKED |
| yt-dlp Python package: certifi | 2026.7.22 | module confirmed | 1 | C-YT-MAPPING | BLOCKED |
| yt-dlp Python package: curl_cffi | 0.16.0 | module confirmed | 1 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS, B-TOOLCHAIN | BLOCKED |
| yt-dlp Python package: requests | 2.34.2 | module confirmed | 1 | C-YT-MAPPING | BLOCKED |
| yt-dlp Python package: urllib3 | 2.7.0 | module confirmed | 1 | C-YT-MAPPING | BLOCKED |
| yt-dlp Python package: websockets | 16.1.1 | module confirmed | 1 | A-YT-CONTROL, C-YT-MAPPING, B-LOGS, B-TOOLCHAIN | BLOCKED |
| yt-dlp Python package: cffi | 2.1.1 | module confirmed | 1 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS, B-TOOLCHAIN | BLOCKED |
| yt-dlp Python package: charset-normalizer | 3.5.0 | module confirmed | 1 | A-YT-CONTROL, C-YT-MAPPING, B-LOGS, B-TOOLCHAIN | BLOCKED |
| yt-dlp Python package: idna | 3.18 | module confirmed | 1 | C-YT-MAPPING | BLOCKED |
| yt-dlp Python package: pycparser | 3.0 | module confirmed | 1 | C-YT-MAPPING | BLOCKED |
| yt-dlp Python package: typing-extensions | 4.16.0 | module confirmed | 1 | C-YT-MAPPING | BLOCKED |
| yt-dlp JS: yt-dlp-ejs | 0.8.0 | confirmed | 1 | A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp JS: Meriyah | 6.1.4 | confirmed | 1 | A-YT-JS, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp JS: Astring | 1.9.0 | confirmed | 1 | A-YT-JS, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp CPython native: bzip2 | 1.0.8 recipe | confirmed | 0 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp CPython native: libffi | 3.3.0 CPython recipe; separate cffi wheel copy may differ | confirmed | 0 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp CPython native: OpenSSL 1.x | 1.1.1t DLL/diagnostic | confirmed | 0 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp CPython native: SQLite | 3.40.1.0 DLL/diagnostic | confirmed | 0 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp CPython native: liblzma | 5.2.5 recipe | confirmed | 0 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp CPython native: zlib | 1.2.13 recipe; curl/bootloader copies separate | confirmed | 0 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp CPython native: Expat | UNKNOWN exact embedded copy | confirmed | 0 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp CPython native: mpdecimal | UNKNOWN exact embedded copy | confirmed | 0 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp curl-impersonate / libcurl | 2.0.0 per curl_cffi scripts/build.py; DLL FileVersion/string 8.21.0-IMPERSONATE | confirmed | 2 | A-YT-NATIVE, A-YT-CONTROL, C-YT-MAPPING, B-LOGS, B-TOOLCHAIN | BLOCKED |
| yt-dlp curl native: BoringSSL | UNKNOWN exact statically linked version/commit | native graph not fully resolved | 0 | C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp curl native: nghttp2 | UNKNOWN exact statically linked version/commit | native graph not fully resolved | 0 | C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp curl native: ngtcp2 | UNKNOWN exact statically linked version/commit | native graph not fully resolved | 0 | C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp curl native: nghttp3 | UNKNOWN exact statically linked version/commit | native graph not fully resolved | 0 | C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp curl native: zstd | UNKNOWN exact statically linked version/commit | native graph not fully resolved | 0 | C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp curl native: brotli | UNKNOWN exact statically linked version/commit | native graph not fully resolved | 0 | C-YT-MAPPING, B-LOGS | BLOCKED |
| yt-dlp curl native: zlib | UNKNOWN exact statically linked version/commit | native graph not fully resolved | 0 | C-YT-MAPPING, B-LOGS | BLOCKED |
| Windows redistributable runtime DLLs | VCRUNTIME140 14.29.30139.0; UCRT/api-ms DLLs 10.0.26100.1742 | confirmed | 0 | C-YT-RUNTIME, B-LOGS | BLOCKED |
| Platform-union notices not proven bundled | GNU Readline/ncurses/libstdc++/libgcc/libuuid/libintl/libidn2/libunistring/Tornado/httpx/SecretStorage/cryptography/Jeepney | notice-only / unresolved static copies | 0 | C-YT-RUNTIME, B-LOGS | BLOCKED |

## Retained sources/build inputs

Local archives are ignored working evidence and are not included in this docs commit or private Git backup. Receipts/selected text are tracked; current source collection remains incomplete. The archived r2 inventory/kit is unchanged.

| File | Bytes | SHA256 | Publisher URL |
| --- | ---: | --- | --- |
| [archives/yt-dlp-release-git-3a08beaf031a.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/yt-dlp-release-git-3a08beaf031a.tar.gz) | 3115089 | `7206981142eb461cfa603c360a55e0d08f3ed58cc754000ed821ad3ebac31ea0` | [source](https://github.com/yt-dlp/yt-dlp/archive/3a08beaf031ab68f966401ead017ac81fe8486cf.tar.gz) |
| [archives/Python-3.10.11.tar.xz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/Python-3.10.11.tar.xz) | 19640792 | `3c3bc3048303721c904a03eb8326b631e921f11cc3be2988456a42f115daf04c` | [source](https://www.python.org/ftp/python/3.10.11/Python-3.10.11.tar.xz) |
| [archives/rubberband-v4.0.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/rubberband-v4.0.0.tar.gz) | 290305 | `24300f48a8014b7c863b573a9647e61b1b19b37875e2cdd92005e64c6424d266` | [source](https://github.com/breakfastquay/rubberband/archive/refs/tags/v4.0.0.tar.gz) |
| [archives/vidstab-e2445c4.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/vidstab-e2445c4.tar.gz) | 316810 | `39506541c073b2be1e376b59fc90e6a79ba4d16cbf4a4a2a58a6badc3a4ce1c3` | [source](https://github.com/georgmartius/vid.stab/archive/e2445c4.tar.gz) |
| [archives/mutagen-1.48.1.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/mutagen-1.48.1.tar.gz) | 1276978 | `8f95637ab9f6f305cec6bd1294e197debe207998e3e068596563c74f86b0a173` | [source](https://files.pythonhosted.org/packages/df/70/1675da133ea92227da41bf5b24e1c66be597ff736a1533ade41da986852f/mutagen-1.48.1.tar.gz) |
| [archives/pycryptodomex-3.23.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/pycryptodomex-3.23.0.tar.gz) | 4922157 | `71909758f010c82bc99b0abf4ea12012c98962fbf0583c2164f8b84533c2e4da` | [source](https://files.pythonhosted.org/packages/c9/85/e24bf90972a30b0fcd16c73009add1d7d7cd9140c2498a68252028899e41/pycryptodomex-3.23.0.tar.gz) |
| [archives/brotli-1.2.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/brotli-1.2.0.tar.gz) | 7388632 | `e310f77e41941c13340a95976fe66a8a95b01e783d430eeaf7a2f87e0a57dd0a` | [source](https://files.pythonhosted.org/packages/f7/16/c92ca344d646e71a43b8bb353f0a6490d7f6e06210f8554c8f874e454285/brotli-1.2.0.tar.gz) |
| [archives/certifi-2026.7.22.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/certifi-2026.7.22.tar.gz) | 138112 | `741e2c3b351ddf169a738da9f2c048608ff7f2c5cc02f1ebc6b118bb090d5d55` | [source](https://files.pythonhosted.org/packages/a3/c2/24167ea9858356b47a87a50d39908bfdb72ceeefe0041586e704e5376b3a/certifi-2026.7.22.tar.gz) |
| [archives/curl_cffi-0.16.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/curl_cffi-0.16.0.tar.gz) | 238344 | `b00b423da8028eb6221e3b63bcd63d681150c07cee8b16000d1f7ea292731895` | [source](https://files.pythonhosted.org/packages/b4/23/d32e113b16dbfb458bea408871ed98dd12f306a366a04215e84537e0af7e/curl_cffi-0.16.0.tar.gz) |
| [archives/requests-2.34.2.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/requests-2.34.2.tar.gz) | 142856 | `f288924cae4e29463698d6d60bc6a4da69c89185ad1e0bcc4104f584e960b9ed` | [source](https://files.pythonhosted.org/packages/ac/c3/e2a2b89f2d3e2179abd6d00ebd70bff6273f37fb3e0cc209f48b39d00cbf/requests-2.34.2.tar.gz) |
| [archives/urllib3-2.7.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/urllib3-2.7.0.tar.gz) | 433602 | `231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c` | [source](https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz) |
| [archives/websockets-16.1.1.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/websockets-16.1.1.tar.gz) | 182204 | `db234eda965dcce15df96bb9709f587cd87d4d52aaf0e80e2f34ec04c7670c57` | [source](https://files.pythonhosted.org/packages/21/f7/bc3a25c5ec26ce62ce487690becc2f3710bbc7b33338f005ad390db0b986/websockets-16.1.1.tar.gz) |
| [archives/yt_dlp_ejs-0.8.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/yt_dlp_ejs-0.8.0.tar.gz) | 96571 | `d5fa1639f63b5c4af8d932495f60689d5370f1a095782c944f7f62a303eb104e` | [source](https://files.pythonhosted.org/packages/d3/e6/cceb9530e8f4e5940f6f7822d90e9d94f1b85343329a16baaf47bbbb3de1/yt_dlp_ejs-0.8.0.tar.gz) |
| [archives/cffi-2.1.1.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/cffi-2.1.1.tar.gz) | 530807 | `dd31f52ea1086513bb9df30f8fcee9b8918323ae067a3d5b78bc826a000712be` | [source](https://files.pythonhosted.org/packages/9e/ef/008a1939e372c06329a3fce4279c02f328488f3526744906eeec3da7ad5f/cffi-2.1.1.tar.gz) |
| [archives/charset_normalizer-3.5.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/charset_normalizer-3.5.0.tar.gz) | 169295 | `49bd5feb59b0bf3cbf6ebcf4352e371c95b9da9bacd4449f8b64d0ad2c10a26e` | [source](https://files.pythonhosted.org/packages/cb/31/4971872b3ed8715346231fb6eb4da8fcba65a4143c189db151ee28a2812b/charset_normalizer-3.5.0.tar.gz) |
| [archives/idna-3.18.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/idna-3.18.tar.gz) | 196711 | `ffb385a7e039654cef1ab9ef32c6fafe283c0c0467bba1d9029738ce4a14a848` | [source](https://files.pythonhosted.org/packages/cd/63/9496c57188a2ee585e0f1db071d75089a11e98aa86eb99d9d7618fc1edce/idna-3.18.tar.gz) |
| [archives/pycparser-3.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/pycparser-3.0.tar.gz) | 103492 | `600f49d217304a5902ac3c37e1281c9fe94e4d0489de643a9504c5cdfdfc6b29` | [source](https://files.pythonhosted.org/packages/1b/7d/92392ff7815c21062bea51aa7b87d45576f649f16458d78b7cf94b9ab2e6/pycparser-3.0.tar.gz) |
| [archives/typing_extensions-4.16.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/typing_extensions-4.16.0.tar.gz) | 113555 | `dc983d19a509c94dba722ee6abd33940f7c05a89e243c47e907eb4db6f1a43e5` | [source](https://files.pythonhosted.org/packages/f6/cc/6253133b5bb138fc3306cebfbda2c520f545d36b5be2c7255cc528bb45d6/typing_extensions-4.16.0.tar.gz) |
| [archives/pyinstaller-6.22.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/pyinstaller-6.22.0.tar.gz) | 4072247 | `8b0166fff4583b374bbe7fa044bf03ddc33cab0f792a665807d96048e63f060e` | [source](https://files.pythonhosted.org/packages/05/03/669d06735cf57d7e2e5dfc3c2e1643554b34c559eff21449c58172ca0335/pyinstaller-6.22.0.tar.gz) |
| [archives/pyinstaller_hooks_contrib-2026.6.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/pyinstaller_hooks_contrib-2026.6.tar.gz) | 173354 | `bef5002c32f4f50bd55b005da12cff64eca8783e7eaf86a06a62410164bab725` | [source](https://files.pythonhosted.org/packages/94/5b/c9fe0db5e83ee1c39b2258fa21d23b15e1a60786b6c5990ee5074ead8bb6/pyinstaller_hooks_contrib-2026.6.tar.gz) |
| [build-inputs/pyinstaller-6.22.0-py3-none-win_amd64.whl](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/build-inputs/pyinstaller-6.22.0-py3-none-win_amd64.whl) | 1101025 | `294099ecb5fdd2a13ae4c29006d4e335b697a63b6a16cf052b90ec2b40bef05a` | [source](https://github.com/yt-dlp/Pyinstaller-Builds/releases/download/2026.08.19.215425/pyinstaller-6.22.0-py3-none-win_amd64.whl) |
| [archives/Pyinstaller-Builds-5eb86b862d61.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/Pyinstaller-Builds-5eb86b862d61.tar.gz) | 7782 | `65fa1589e00923522b289ad4fbde68feca06850acd699e1a4764882b2734c582` | [source](https://github.com/yt-dlp/Pyinstaller-Builds/archive/5eb86b862d61adc3df0f44e6e0b815b7d74fa3f5.tar.gz) |
| [archives/PyInstaller-70fc17210920.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/PyInstaller-70fc17210920.tar.gz) | 3617860 | `587eb41e1087aeaf2a879b04db35b68bbe44b85f9227e263c873396806103540` | [source](https://github.com/pyinstaller/pyinstaller/archive/70fc17210920bce17f4ab09bbf8104b0dbd45338.tar.gz) |
| [build-inputs/curl_cffi-0.16.0-cp310-abi3-win_amd64.whl](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/build-inputs/curl_cffi-0.16.0-cp310-abi3-win_amd64.whl) | 1976497 | `e22a8212d830108e977ff394237f637238e265f5f65037d6c1ee71ea8cc03bcb` | [source](https://files.pythonhosted.org/packages/ad/03/b9df2973f1119f9d11d8fb3bf2682e5ffe5c52ef3ab89f720473c60fe97e/curl_cffi-0.16.0-cp310-abi3-win_amd64.whl) |
| [archives/meriyah-6.1.4.tgz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/meriyah-6.1.4.tgz) | 278043 | `c0f105d9fb01bb48c76ea6ee382e6099277b95e3f351fb99b67ddfb79d6088b8` | [source](https://registry.npmjs.org/meriyah/-/meriyah-6.1.4.tgz) |
| [archives/astring-1.9.0.tgz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/astring-1.9.0.tgz) | 60574 | `422cca9707aca293e85eb54fdbbc5a0a167ad415236a325ff342e720e67afb49` | [source](https://registry.npmjs.org/astring/-/astring-1.9.0.tgz) |
| [archives/curl-impersonate-v2.0.0.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/archives/curl-impersonate-v2.0.0.tar.gz) | 207780 | `a9827cfce8246e78b86e26f012ae9fcb9bc05822009cd7ce4c9e130af6bdfb6f` | [source](https://github.com/lexiforest/curl-impersonate/archive/refs/tags/v2.0.0.tar.gz) |
| [baseline/dependencies.lock.json](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/baseline/dependencies.lock.json) | 2681 | `db7152bdfe328dee09931d3fd5c5f3ca6ddc40985bb9d9695285ae784dc91903` | repository dependencies.lock.json |
| [baseline/FFmpeg-946fcce07b.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/baseline/FFmpeg-946fcce07b.tar.gz) | 17333895 | `0aa2b1de2a5698b20a23e93d539a9a8e82ca0117496c5bdf05d198805f42bb3b` | [source](https://github.com/FFmpeg/FFmpeg/archive/946fcce07b6dcd0331c8cc609192aeff5e1924f8.tar.gz) |
| [baseline/FFmpeg-GPLv3.txt](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/baseline/FFmpeg-GPLv3.txt) | 35147 | `8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903` | [source](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip) |
| [baseline/FFmpeg-README.txt](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/baseline/FFmpeg-README.txt) | 41577 | `0342de6bb39dd421cbec2c00d89ad274b640d75ad3f2cab09ffd647ce2d8f949` | [source](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip) |
| [baseline/yt-dlp-2026.08.19.tar.gz](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/baseline/yt-dlp-2026.08.19.tar.gz) | 6020567 | `072aad4f2a7604e92155f61a275a4752dc64046c8f6d90df3710525d94cd37c1` | [source](https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.tar.gz) |
| [baseline/yt-dlp-SHA2-256SUMS.txt](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/baseline/yt-dlp-SHA2-256SUMS.txt) | 1595 | `a63701f30755cb4d9317950d69703e9d751d490cb1b7059e1bb501a353fe7dcb` | [source](https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/SHA2-256SUMS) |
| [baseline/yt-dlp-THIRD_PARTY_LICENSES.txt](../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/baseline/yt-dlp-THIRD_PARTY_LICENSES.txt) | 243550 | `472aefe951c7db35e1657c1d13fd337140511ed6f2b329205105ad441c5a02b7` | [source](https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/THIRD_PARTY_LICENSES.txt) |
| [../gyan-response-20261010/archives/bzip2-1.0.8.tar.gz](../gyan-response-20261010/archives/bzip2-1.0.8.tar.gz) | 810029 | `ab5a03176ee106d3f0fa90e381da478ddae405918153cca248e682cd0c4a2269` | [source](https://sourceware.org/pub/bzip2/bzip2-1.0.8.tar.gz) |
| [../gyan-response-20261010/archives/fontconfig-2.18.3.tar.gz](../gyan-response-20261010/archives/fontconfig-2.18.3.tar.gz) | 666753 | `9ae01e1d53acdef56010c5451cd34aa41d325b2faccd8606448d8fa01b2496b3` | [source](https://gitlab.freedesktop.org/fontconfig/fontconfig/-/archive/2.18.3/fontconfig-2.18.3.tar.gz) |
| [../gyan-response-20261010/archives/gmp-6.3.0.tar.xz](../gyan-response-20261010/archives/gmp-6.3.0.tar.xz) | 2094196 | `a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898` | [source](https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.xz) |
| [../gyan-response-20261010/archives/gnutls-3.8.13.tar.xz](../gyan-response-20261010/archives/gnutls-3.8.13.tar.xz) | 7275324 | `ffed8ec1bf09c2426d4f14aae377de4753b53e537d685e604e99a8b16ca9c97e` | [source](https://www.gnupg.org/ftp/gcrypt/gnutls/v3.8/gnutls-3.8.13.tar.xz) |
| [../gyan-response-20261010/archives/libiconv-1.19.tar.gz](../gyan-response-20261010/archives/libiconv-1.19.tar.gz) | 5921103 | `88dd96a8c0464eca144fc791ae60cd31cd8ee78321e67397e25fc095c4a19aa6` | [source](https://ftp.gnu.org/gnu/libiconv/libiconv-1.19.tar.gz) |
| [../gyan-response-20261010/archives/xz-5.8.4.tar.xz](../gyan-response-20261010/archives/xz-5.8.4.tar.xz) | 1567192 | `4ce24038fd4221e0d13bc1a2de7a4db56e90b92b3bf75321f6c14be73f65de4b` | [source](https://github.com/tukaani-project/xz/releases/download/v5.8.4/xz-5.8.4.tar.xz) |
| [../gyan-response-20261010/archives/libxml2-31094e5d.tar.gz](../gyan-response-20261010/archives/libxml2-31094e5d.tar.gz) | 2969367 | `59331aad695deccb223fa24c26f4f0c4dce97bfd749283368c9e2e6585d25d91` | [source](https://codeload.github.com/GNOME/libxml2/tar.gz/31094e5d0f65a528965e8c32a488e5a7f36118ca) |
| [../gyan-response-20261010/archives/zlib-ng-9174ab6.tar.gz](../gyan-response-20261010/archives/zlib-ng-9174ab6.tar.gz) | 2575995 | `1c831bec942239255eea0ae64a4b3543c465f8549794c3875fe7495434d4e402` | [source](https://codeload.github.com/zlib-ng/zlib-ng/tar.gz/9174ab6bf58ac9a518dbe197b948c897f74834f5) |

License/notices, build evidence, per-row missing items and full upstream details are retained in [source-inventory.json](source-inventory.json). Historical unclassified requirements are preserved in the baseline and current assessment, rather than treated as current automatic gate criteria.
