# Windows Installer internal QA — 8 October 2026

## Scope and environment

EliteBook (Windows 11 x64), per-user Inno Setup 6.7.3 installed via WinGet with publisher SHA256 verification. The working branch is `feature/media-tools-installer-20261008`, based on the source-only Media Tools Git checkpoint.

The installer compiles from the previously accepted portable directory; the compiler wrapper checks the exact source/portable hashes for critical native IPC, engine and UI files, as well as the presence of bundled FFmpeg, FFprobe, yt-dlp, ProcessHost and manifest. Application code and audio worker behavior have not been modified to support the installer.

## Verified results

- `npm test`: **15/15 passed** (existing filename/job/security tests plus installer guard tests).
- QA installer built: `Audio-Tech-Labs-Media-Tools-Setup-0.1.0-Win64-QA.exe`, 210,868,075 bytes, SHA256 `19ddb4398d36b1f01e3b2571a5d273c5d4939164e0ce921b0e67825d25a80844`.
- Internal candidate Setup built: `Audio-Tech-Labs-Media-Tools-Setup-0.1.0-Win64.exe`, **210,868,046 bytes**, SHA256 `bf24aac94a98c9933596d27e418ea5e4d6e93b2ecac1408fd5be02a1a810a480`. Recomputed SHA256 matched the build manifest; Authenticode status was `NotSigned`. The candidate was **not installed or published**.
- QA installer uses a separate AppId and install folder, not the normal app's AppId.
- Real silent **install succeeded** under current Windows user's profile; uninstall registration exists, Start Menu and Desktop shortcut targets point at the correct installed executable.
- Installed executable, native engine and UI source files, plus FFmpeg/FFprobe/yt-dlp/ProcessHost binaries matched the accepted portable via SHA256.
- Real **uninstall succeeded**; QA installation directory, uninstall registry key and both shortcuts no longer existed.
- Actual `%APPDATA%\Audio Tech Labs Media Tools\local-media\` file hashes were equal before and after the full QA install/uninstall round. This preserves the real app's persistent data.
- Test logs and receipts remain locally in ignored `test-output/installer-test-*`. Installers and their sha256 manifests are local in ignored `release/installers/`.

## Not done / required before public release

The normal-candidate installer is **not** installed by this QA. An installed app launch and upgrade from an older installed candidate require separate acceptance, as does testing on a fresh, clean Windows user/VM. The installer is unsigned; Windows SmartScreen may warn. Bundled runtime redistribution/GPL obligations, provider-authorized download acceptance and signer/trust review remain open. There is **no public download**, no website link, no Cloudflare/GitHub release deployment, and no modification to the Web Demo backend.

Do not interpret successful QA installer file-copy and uninstall tests as proof of an end-to-end YouTube download or an independent clean-room machine installation.
