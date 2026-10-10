# ร่างอ้างอิงถึง Gyan

สถานะล่าสุด: **Gyan RESPONDED — user-provided email text** พี่ยอดให้ข้อความคำตอบในแชตวันที่ 10 ตุลาคม 2026; ดู [หลักฐาน/audit](../gyan-response-20261010/README.md) และ [ร่างถามกลับ — NOT SENT](../gyan-response-20261010/GYAN-FOLLOWUP-DRAFT.md) เอกสารนี้เก็บเนื้อหาร่างเดิมจากรอบ 9 ตุลาคม ไม่ยืนยันว่าเป็นฉบับที่ส่งจริง; ไม่มี original email headers หรือ independent authentication

To: `builds@gyan.dev`

Subject: Build-specific source, patches and recipes for Gyan FFmpeg 9.0.2 essentials (SHA256 identified)

ช่องทางนี้แปลงจากข้อความ “builds at this domain” บน [หน้า Notes ของผู้เผยแพร่](https://www.gyan.dev/ffmpeg/builds/#notes) เป็น builds@gyan.dev ตรวจเมื่อ 9 ตุลาคม 2026; ยังไม่ได้ทดสอบการส่งหรือการรับอีเมล

เก็บ placeholders `[Sender name]` / `[Reply-to email]` และเนื้อหาร่างเดิมไว้เป็นอ้างอิง ไม่เติมข้อมูลผู้ส่งหรืออีเมลตอบกลับของฉบับจริงโดยไม่มีหลักฐาน Appendix ในร่างไม่ใช่การยืนยันว่ามีหรือไม่มีไฟล์แนบในอีเมลที่พี่ยอดส่ง

<!-- EMAIL BODY START -->

Hello Gyan,

We are preparing Audio Tech Labs Media Tools 0.2.2-beta.2 for a private review before public release. We plan to redistribute your Windows FFmpeg and FFprobe binaries unchanged and are assembling the corresponding source and notices for the exact build. Could you provide the build-specific source/input set, patches and build recipes, or point us to an existing set that covers the hashes below?

The package was obtained from https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip and saved as ffmpeg-9.0.2-essentials.zip. Because that URL can change, the SHA256 values identify our request:

```text
Original ZIP SHA256:
60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba
ffmpeg.exe SHA256:
3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec
ffprobe.exe SHA256:
f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52
```

Both executables identify the build as 9.0.2-essentials_build-www.gyan.dev. The package identifies FFmpeg core commit 946fcce07b6dcd0331c8cc609192aeff5e1924f8; the executable reports GCC 16.2.0 (Rev3, Built by MSYS2 project). We matched the executables and README to the original ZIP. We have collected the exact core archive, Rubber Band v4.0.0 and vid.stab commit e2445c4081658318223762a696eb1c645c2d7168, together with the package's GPLv3 notice. These do not yet establish the full input set.

The specific outstanding items are:

1. **Core/library source and patches (F1).** Please identify any modifications to the FFmpeg core commit above and provide the patches, or an explicit no-patch confirmation. For every library listed in Appendix A, please provide the exact source archive/immutable repository commit, archive checksum, applicable license/copyright notices and all patches used, or confirmation that the source was unmodified. Please resolve abbreviated revisions to full commits, including libraries identified only by a version. Eight additional enabled libraries have no version recorded in the package: **fontconfig, iconv, GnuTLS, libxml2, GMP, bzip2, XZ/liblzma and zlib**. We need their exact versions/commits and the same source/patch information.

2. **Recipes and configuration (F2).** Please provide the scripts and commands used to build the libraries and FFmpeg/FFprobe, per-library configure/CMake/compiler/linker options, generated configuration or equivalent build records (such as config.log/config.h), and the final link or package manifest. Appendix B preserves the configuration reported by our executable; we still need the steps and inputs behind it.

3. **Original toolchain/package snapshot (F3).** Please identify the original MSYS2 UCRT/compiler packages, package versions and checksums, relevant source packages/PKGBUILDs and patches, build environment and installation/build instructions. Today's package versions would not identify this original build. Please distinguish build tools from runtime code incorporated into the executables.

4. **Actual transitive and hardware inputs (F4).** Please identify which dependencies were incorporated, dynamically required or excluded. Open questions include cairo/pixman/png; fontconfig/expat; GnuTLS/nettle/hogweed/p11-kit/tasn1; Vorbis/ogg; Rubber Band FFT/resampler choices; and any pthread/compiler-runtime copies. These are questions about the actual link graph, not a claim that all were bundled. We also need the exact CUDA/LLVM, Windows SDK/Media Foundation, AMF, ffnvcodec, VAAPI and VPL/header inputs and their source or applicable licensing scope. The package README refers to libmfx while the executable reports --enable-libvpl; could you clarify that mapping?

5. **Source delivery mapping (F5).** Please identify a source/notices set covering the two executable hashes above, including the applicable preferred sources, modifications and build/install scripts. Immutable links plus checksums and an explicit source-to-build mapping would be useful. If something is unavailable, excluded, an unmodified upstream input or a system component, please state that per item. We are requesting records for this existing build; a nearby source release or a newly built binary would not resolve its identity.

Our app uses ffmpeg.exe and ffprobe.exe, not ffplay.exe. We are not requesting a replacement build. Existing archives or references are welcome; build records can omit credentials. If another maintainer holds some inputs, a direct reference to the original build record would help us follow up accurately.

Thank you,

[Sender name]
Audio Tech Labs
[Reply-to email]

Appendix A — external-library version lines from the original package README

```text
AMF               v1.5.2-2-gc35f613
aom               v3.15.0-25-g023743a7d7
AviSynthPlus      v3.7.5-383-g5c82777b
cairo             1.18.5
ffnvcodec         n13.1.15.0-1-geddcea9
freetype          VER-2-14-3
fribidi           v1.0.16-19-gc928e4c
gsm               1.0.24
harfbuzz          14.4.0-108-g64e2b532
lame              3.100
libass            0.17.5-8-gb2fe9d8
libgme            0.6.6
libopencore-amrnb  0.1.6
libopencore-amrwb  0.1.6
libssh            0.12.2
libtheora         v1.2.0
libwebp           v1.6.0-249-g1f34635
openal-soft       1.25.2-48-g7532541
openjpeg2         2.5.4
openmpt           libopenmpt-0.6.30-3-g6c0a06bc
opus              v1.6.1-68-g503d81b1
rubberband        v4.0.0
SDL               release-2.32.0-234-gb90ac9502
speex             Speex-1.2.1-51-g0589522
srt               v1.5.7-7-gcae8f62
VAAPI             2.25.0.
vidstab           v1.1.2-214-ge2445c4
vmaf              v3.2.0-13-gf85a8536
vo-amrwbenc       0.1.3
vorbis            v1.3.7-37-g1b75110b
VPL               2.17
vpx               v1.17.0-57-gd2413e2ca
x264              v0.165.3223
x265              4.3-45-g116b875
xvid              v1.3.7
zeromq            4.3.5
zimg              release-3.0.6-253-g67e0603
```

Appendix B — reported FFmpeg configuration (line breaks added)

```text
--enable-gpl --enable-version3 --enable-static --disable-w32threads --disable-autodetect
--enable-cairo --enable-fontconfig --enable-iconv --enable-gnutls --enable-libxml2 --enable-gmp
--enable-bzlib --enable-lzma --enable-zlib --enable-libsrt --enable-libssh --enable-libzmq
--enable-avisynth --enable-sdl2 --enable-libwebp --enable-libx264 --enable-libx265 --enable-libxvid
--enable-libaom --enable-libopenjpeg --enable-libvpx --enable-mediafoundation --enable-libass
--enable-libfreetype --enable-libfribidi --enable-libharfbuzz --enable-libvidstab --enable-libvmaf
--enable-libzimg --enable-amf --enable-cuda-llvm --enable-cuvid --enable-dxva2 --enable-d3d11va
--enable-d3d12va --enable-ffnvcodec --enable-libvpl --enable-nvdec --enable-nvenc --enable-vaapi
--enable-openal --enable-libgme --enable-libopenmpt --enable-libopencore-amrwb --enable-libmp3lame
--enable-libtheora --enable-libvo-amrwbenc --enable-libgsm --enable-libopencore-amrnb
--enable-libopus --enable-libspeex --enable-libvorbis --enable-librubberband
```

<!-- EMAIL BODY END -->
