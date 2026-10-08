# Media Tools — development checkpoint (8 October 2026)

Status: **internal Windows x64 application**, not publicly released or integrated into Web Demo or the main website.

## Saved functionality

- Download Audio: YouTube public single-item source inspection, explicit format selection, optional output filename stem (no extension), protected destination and unique collision suffixes.
- Convert Audio: local source selection, MP3/WAV/FLAC/ALAC encoding with verified dependencies.
- Shared current-job state across both pages, native cancellation and guarded cleanup.
- **เริ่มงานใหม่** clears only a finished job's persisted state, without deleting its exported audio; active or cleanup-required jobs cannot be cleared.
- No public media API; Electron renderer is sandboxed, and all source/format/folder operations go through restricted native IPC.

## Verified at checkpoint

- `npm test`: 11/11 passed on EliteBook.
- Syntax: 31/31 local JavaScript/CJS files passed `node --check`.
- `test/new-job-electron.cjs`: native Electron UI and persistence checks previously passed.
- Local portable build is retained under ignored `release/`. Its executable, bundled dependencies, archive(s), and media fixtures are **not** Git backups.

## Important release constraints

- Authorized live-provider acceptance, clean Windows machine tests, code signing, and dependency redistribution/license review remain open; do not advertise this as a public release.
- Website integration remains **deferred** by user decision. Do not add public links or expose a download until approved.
- `scripts/prepare-ui.cjs` is an older prototype regeneration script and overwrites native UI files, including more recent features. **Do not rerun it on the current checked-in UI** without reviewing and porting all native UI changes first.
- `vendor/`, `cache/`, `release/`, `node_modules/`, and `test-output/` intentionally stay on the local machine (ignored by Git).
- Git source checkpoint can reproduce the code and design; it is not a distribution of the portable program.

See `README.md`, `ACCEPTANCE-REPORT.md`, and `DEPENDENCIES.md` for detailed build, usage, and test scope.
