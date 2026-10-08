# Convert Audio — Custom output filename + New Job (8 October 2026)

Internal Windows **v0.1.2**; Source project on EliteBook `desktop/media-tools/`. No public website or Web Demo deployment.

## Requested improvements

1. Convert Audio now shows **เปลี่ยนชื่อไฟล์ปลายทาง** in section 02, directly after output folder, just like Download Audio. Enter an optional filename **stem** (e.g., `เพลงใหม่`); the engine supplies the chosen audio extension (FLAC → `.flac`, ALAC → `.m4a`). Leave empty for the existing automatic `source name — converted.ext` behavior.
2. Convert Audio retains the same **เริ่มงานใหม่** button and lifecycle rules as Download Audio in section 03. The button is shown for succeeded, failed, cancelled, interrupted only. A successful reset clears sections **01, 02, 03**, including Convert's new output-name field, without deleting the original or exported media. Running/cleanup-required jobs remain protected.

## Implementation / safeguards

- Native `startRequest` now permits `outputName` in Convert as well as Download, using the existing strict filename-stem validator. Renderer cannot pass filesystem paths, file extensions, extra arguments or invalid Windows reserved names.
- `Engine.start` already persists `outputBaseName`, and its atomic publish already handles collisions via ` (1)`, ` (2)` instead of overwriting. No change in media processing worker, FFmpeg arguments, file paths, safety guards or stored job schema.
- Shared native UI validates the optional field, blocks Start on invalid names, sends it to either `startDownload` or `startConvert`, and clears it on terminal reset. Format/quality selection, source and folder must be chosen again.
- Both Download and Convert still use one shared active-job slot.

## Verification (EliteBook)

- `npm test`: **16/16 passed**, including real FFmpeg WAV conversion with custom Thai stem, same-name collision handling, default-name fallback, conversion into original source directory without overwriting original, and invalid-name rejection.
- `test/filename-electron.cjs`: **PASS**, live Electron UI/native IPC with four recorded Download + Convert submissions, malformed-name disabled-state checks, and responsive widths 360/390/768/1280; conversion page screenshot stored only in ignored `test-output/`.
- `test/reset-forms-electron.cjs`: **PASS** for Download and Convert; real Electron UI and reset IPC with isolated test user profiles. Convert custom output stem clears with sections 01/02/03, and output file content stays unchanged.
- `node --check` on 6 changed JavaScript/CJS modules: **6/6 passed**.
- Portable v0.1.2 is built under ignored `release/` and the build checks the dependency manifest before packaging.
- Inno Setup **0.1.2 QA** built from the same verified portable: 210,859,430 bytes; SHA256 `e8695fd2bb0f8edbe838d1282d19625ff0b75803d01e67212217877b68934f58`. Real per-user silent **install → inspect shortcuts/uninstall registration → verify installed executable, FFmpeg, FFprobe, yt-dlp, ProcessHost, source/UI hashes → uninstall** passed on EliteBook. The 1 pre-existing local-media profile file stayed byte-for-byte unchanged; no QA folder/shortcuts/registry residue.

## Release limits

The internal Windows installer **0.1.2** was built successfully as `Audio-Tech-Labs-Media-Tools-Setup-0.1.2-Win64.exe`: **210,859,390 bytes**, SHA256 `2d8d480a9407f313f6341ff163f7a1ec2e2115e87d781da80a7bfa993e21f5d3`. It is unsigned and was **not installed or publicly released**. The Windows Installer and Portable remain **internal**, not a website download or GitHub Release. Installer QA must confirm user-scope install/uninstall, exact bundled files and untouched real user settings. `release/`, `test-output/` and `vendor/` are excluded from Git; Git only backs up source/tests. Unsigned Windows Installer may prompt SmartScreen. Clean-room Windows, software signing, license and live-provider acceptance remain open for public distribution.
