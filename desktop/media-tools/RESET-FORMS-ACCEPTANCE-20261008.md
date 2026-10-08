# Media Tools — Reset 01/02/03 acceptance (8 October 2026)

## Problem fixed

Previously, **เริ่มงานใหม่** only cleared section 03 (Current Job). Renderer-held source, source metadata, format/quality selection, destination folder and custom Download output name in sections 01/02 remained on screen.

## 0.1.1 behavior

- Clear section **01** source token and source information; Download URL and link messages are cleared.
- Clear section **02** every selected radio format, reset MP3 bitrate to 192 kbps and sample rate/bit depth to source/16 bit defaults, clear output folder, output-name stem and validation messages.
- Clear section **03** job, result and progress details, disable Open File/Folder, return to Ready. The Start button remains disabled until a new input, format and destination are chosen.
- Native engine clears stale source/folder tokens, finished inspections and request tokens **only after** the terminal job is safely persisted as empty. Block reset during active or cleanup-required jobs; keep old job intact if persistence fails.
- Neither Download nor Convert resets delete or mutate the previous output files. Source files and arbitrary user folders are not touched.
- This is a renderer + job-lifecycle fix; no API, public Web Demo, Cloudflare Pages or server changes.

## Evidence

- `npm test`: **15/15 passed** with engine persistence, collision, security, source-token invalidation and installer guards.
- `test/reset-forms-electron.cjs`, mode `download`: PASS. Real Electron IPC, synthetic source and folder selection; fields 01/02/03 empty after reset, result bytes preserved and across-page Ready.
- `test/reset-forms-electron.cjs`, mode `convert`: PASS. Same live UI/IPC tests and output preservation. Synthetic source selection avoids modifying actual user audio.
- The dedicated Electron QA runs in isolated `test-output/` profile, not `%APPDATA%\Audio Tech Labs Media Tools` production profile.
- Inno Setup **0.1.1 QA** built with the exact v0.1.1 portable files (210,868,336 bytes; SHA256 `c5e26619c1142e6c525b9133ba83265f0e589cc109304bdbbff1ca85d89a2834`). A real per-user install, Start Menu/Desktop shortcuts, packaged engine/UI/helper SHA256 checks, clean uninstall, and comparison of the actual existing local-media profile (1 file) all **passed** at 18:06 Bangkok time.
- All dependency binaries stay bundled with the Windows portable and Inno Setup installer. Source/portable SHA256 guard must pass before installer build.

## Release scope

Internal Windows **v0.1.1**. Original v0.1.0 portable and installer are retained in ignored release directories for rollback. The internal installer candidate `Audio-Tech-Labs-Media-Tools-Setup-0.1.1-Win64.exe` was compiled successfully: **210,868,306 bytes**, SHA256 `f21c3b6badd8ec8905fb97fdf7ea1b1945a115b099bdc81fc8fbdc91095f440e`, unsigned and not public. Details and SHA256 are recorded locally under `release/installers/installer-candidate.json`. Not public; unsigned, not approved for clean-room release, legal/vendor redistribution review outstanding.

Checkpoints are Git source-only; portable archives and .exe remain local and ignored.
