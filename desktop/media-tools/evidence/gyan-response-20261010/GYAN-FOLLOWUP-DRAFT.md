# ร่างถามกลับเรื่อง source และ build inputs ชุดเดิม

**DRAFT — NOT SENT** สำหรับพี่ยอดตรวจและส่งต่อใน email thread เดิม อิง Gyan RESPONDED — user-provided email text; source gate ยัง BLOCKED / INCOMPLETE

To: `builds@gyan.dev`

Subject: Re: Build-specific source, patches and recipes for Gyan FFmpeg 9.0.2 essentials (SHA256 identified)

<!-- EMAIL BODY START -->

Hi Gyan,

Thank you for the version details. We are continuing the source inventory for the same original FFmpeg/FFprobe binaries identified in our previous email (ZIP SHA256 `60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba`).

We understand that your build scripts are custom and not portable. Could you share the original scripts or the relevant portions, including per-library build options, FFmpeg configuration and linking commands? Machine-specific paths can be redacted. Existing config logs, generated configuration, pkg-config files and a link/package manifest would also help; we are not asking you to port the scripts or produce a new build.

We found these matching commits in upstream repositories:

- libxml2: `31094e5d0f65a528965e8c32a488e5a7f36118ca` in the GNOME/libxml2 GitHub mirror, 126 commits after `v2.15.0`.
- zlib-ng: `9174ab6bf58ac9a518dbe197b948c897f74834f5` in zlib-ng/zlib-ng, 2966 commits after `v1.2.8_jtkv4`.

Could you confirm the exact repository/mirror URLs and full commits used for these two inputs, and provide any local patches or confirm they were unmodified? For zlib-ng, please include its zlib compatibility setting (such as `ZLIB_COMPAT`/`--zlib-compat`), library naming and whether FFmpeg and the other linked libraries used this same zlib-ng build or separate stock zlib copies. For libxml2, please include the actual iconv/ICU/zlib/thread/static build settings and selected dependencies.

We also found matching MSYS2 recipes for bzip2 1.0.8-4, GnuTLS 3.8.13-3 and libiconv 1.19-1, with downstream patches. Were these the UCRT64 package inputs used for your build, or were they built separately? Please identify the original source packages/recipe revisions, fontconfig/GMP/XZ package revisions if applicable, compiler/package snapshot, and patches or no-patch status for the eight libraries and FFmpeg core. A manifest of the transitive libraries actually linked, with versions/source revisions, would help us avoid assuming that every package dependency was incorporated.

We have the official GMP 6.3.0 release tarball, but could not access its Mercurial revision metadata. If you used a repository checkout rather than that release tarball, please identify its repository and full changeset too.

Regards,
Yod

<!-- EMAIL BODY END -->

ไม่มี private paths, screenshots หรือ review kit ในเนื้อหาร่าง และไม่มีไฟล์แนบที่ agent ส่ง การ resolve upstream commits ไม่ถือว่า Gyan ยืนยัน input/patch/config ของ binary เดิมแล้ว
