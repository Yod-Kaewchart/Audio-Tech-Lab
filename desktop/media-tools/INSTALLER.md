# Windows installer — INTERNAL QA (8 October 2026)

This installer adds a traditional Setup EXE alongside the existing **portable** Windows application. It is **not a public release**; website integration remains paused. Do not upload an installer to a public site or GitHub Release without explicit approval.

## Toolchain

- Windows 10/11 x64.
- Inno Setup 6.7.3, installed from the `JRSoftware.InnoSetup` WinGet package (publisher checksum verified).
- Complete current portable build in ignored `release/`, including Electron, yt-dlp, FFmpeg/FFprobe, ProcessHost and local font assets.
- Run `node scripts/package.cjs --directory-only` when source has changed; verify the packaged app before producing any Setup.
- Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-installer-icon.ps1` only when regenerating the icon.

## Build commands

From `desktop/media-tools`:

```powershell
node scripts/build-installer.cjs --qa
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-installer.ps1
node scripts/build-installer.cjs
```

This creates:
- `release/installers/Audio-Tech-Labs-Media-Tools-Setup-0.1.0-Win64-QA.exe`: uses a **separate QA AppId**, folder and shortcuts. Only QA is installed and removed during the test.
- `release/installers/Audio-Tech-Labs-Media-Tools-Setup-0.1.0-Win64.exe`: **internal candidate**; not installed during automated QA, not public.
- `installer-qa.json` and `installer-candidate.json` with SHA256 and unsigned/publicRelease flags.

`scripts/build-installer.cjs` rejects stale source-vs-portable payload (critical engine, preload, UI), invalid release paths, missing vendor dependencies, and unknown command-line options.

## Expected installation behavior

- **Per-user**: Windows profile, no Administrator requirement.
- **Install folder**: `%LOCALAPPDATA%\Programs\Audio Tech Labs Media Tools` (editable in Setup Wizard).
- **Start Menu** shortcut is created; **Desktop** shortcut is an optional Setup task.
- Windows **Settings → Apps → Installed apps** provides uninstall.
- Updates can overwrite program files in the same installation location; close Media Tools before upgrading.
- The app's profile data is **not inside the install directory**: `%APPDATA%\Audio Tech Labs Media Tools\local-media`. Uninstall deliberately does not delete user settings or current-job state.
- The app's downloaded and converted output is wherever the user selected; no uninstall cleanup targets those files.
- Installer does not create services, start tasks, add file associations, or modify the Web Demo/backend/Cloudflare.
- Portable installation and QA AppId remain distinct.

## Acceptance and release gates

QA checks the user-scoped installer, uninstall entry, Desktop/Start Menu shortcuts, packaged executable/engine and bundled helper hashes, full removal of QA installation, and byte-for-byte unchanged existing user profile. The currently used portable app is preserved. Native Electron UI/processing verification remains a separate test suite.

**Still required before public distribution:** clean-room Windows x64 VM/user install, real-world upgrade across versions, approved live-provider acceptance, Windows signing/SmartScreen trust, legal review of bundled Electron/FFmpeg GPLv3/yt-dlp/Node redistribution and corresponding-source obligations. An unsigned test installer may trigger Windows SmartScreen warnings. Do not bypass trust warnings when assessing release readiness.

Only source, script, icon, documentation, and tests belong in Git. `node_modules/`, `vendor/`, `cache/`, `test-output/`, `release/` remain ignored and local; GitHub backup does not provide the Setup EXE.
