# Player V1 — Windows 0.2.0 · 8 October 2026

Implemented and verified locally on EliteBook. No push, deployment, public release or installation over the user's existing application.

## Repository and scope

- Started at clean `feature/media-tools-convert-filename-v0.1.2`, commit `4bc57934f724ce461552eff8ba08ca389a823498`; continued on `codex/player-v1`.
- Searched the repository (including hidden files) and `D:/`, `D:/Sites/` ancestors: no applicable `AGENTS.md` exists.
- Inspected current native Download/Convert views, navigation, design tokens, bridge, FFprobe/FFmpeg runner, packaging and existing reset/filename tests. The native app had no playback engine; Player uses one real Electron `HTMLAudioElement`, with the existing runner for metadata/artwork.
- Existing source files, conversion/download job snapshots, codecs/encoders, provider behavior, user credentials and public website are preserved. One pre-existing `local-media` profile file was SHA256-identical after testing; all test applications used separate profiles. No dependency was added; package/lock version only changes to 0.2.0.

## Delivered behavior

- Player navigation uses the shared header/view and styles. Desktop has CD/metadata/transport at left and Playlist at right; small screens stack vertically.
- Actual Audio Tech Labs logo is the existing `.brand` wordmark/equalizer from `ui/view.js`, styled by the unchanged shared `media-tools.css`. No separate Audio Tech Labs bitmap was found; the exact existing brand DOM is reused, with no replacement logo generated. Fonts remain local DM Sans/Noto Sans Thai.
- CD has a center opening and subtle reflections. CSS animation is 12 seconds per revolution; real audio events and ready state control its play state. Pause preserves the angle; Resume continues; Stop/Ended/Error freeze it; new job resets its angle. Loading is separate from playback status. Reduced motion disables spinning.
- Logo is default. Embedded artwork can be selected, and absent/failed artwork falls back to the existing logo. Actual title/artist/album tags are read by FFprobe, with filename fallback. Format/sample rate/bit depth/channels only appear when known.
- Native multi-file picker, recursive folder picker and disk-backed Drag & Drop work. The preload uses Electron's supported [webUtils file API](https://www.electronjs.org/docs/latest/api/web-utils); renderer code receives opaque media URLs instead of filesystem paths.
- Previous/Play/Pause/Next/Stop, seek/time, volume/mute, shuffle with previous-song history and repeat off/one/all are functional. A shuffled cycle visits each song once.
- Playlist shows order, title, duration and current playback state. Double click/Enter plays; remove works; drag or accessible up/down buttons reorder. Removing the active song stops playback and selects a neighbor at zero.
- New Job is the shared button style in section 03, matching Download/Convert. Native confirmation precedes clearing. It stops/releases audio, revokes media/artwork, cancels pending imports and waits for worker/artwork cleanup, clears all fields/metadata/seek/input/options and returns to a stationary logo. The same file can be selected again.
- Page navigation/reload stops audio and destroys that page's player/listeners. Playlist survives in main-process memory for the app session. Returning creates exactly one idle player; there is no overlapping audio or duplicate subscription.
- Local streaming supports validated byte ranges. Only selected, unchanged regular files are served through opaque IDs. Reset/removal revoke IDs; changed/missing sources fail. No media HTTP server or external network requests are introduced.

## Files in this checkpoint

| Files under `desktop/media-tools/` | Change |
| --- | --- |
| `ui/player.html`, `ui/player-view.js` | Player page and shared brand/header reuse |
| `ui/player.css` | CD/layout geometry using existing tokens only |
| `ui/player.js`, `ui/player-queue.js` | Real playback/event lifecycle, playlist and queue rules |
| `src/player-library.cjs` | Local probing, artwork, folder import, ranged streaming and resource cleanup |
| `src/main.cjs`, `src/preload.cjs`, `src/security.cjs` | Player-only IPC, native pickers/confirmation, protocol routes and page allowlist |
| `ui/view.js`, `ui/native.css` | Shared Player menu, wrapping navigation and version label |
| `scripts/prepare-ui.cjs`, `scripts/package.cjs` | Preserve native filename/reset controls during UI regeneration; include Player menu and ship this report with portable builds |
| `package.json`, `package-lock.json` | Internal version 0.2.0; existing Electron dependency unchanged |
| `test/player.test.cjs`, `test/player-acceptance.cjs` | Queue/security/library and real Electron/portable acceptance |
| `README.md`, this report | Usage, tests and limitations |
| `evidence/player-v1-desktop.png`, `evidence/player-v1-mobile.png` | Verified portable screenshots |

`ui/media-tools.css`, fonts, Download/Convert HTML and controllers are unchanged relative to the starting checkpoint. Regeneration produces the same native filename/reset controls and original shared stylesheet.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **22/22 PASS**: original tests plus queue boundaries/shuffle, metadata, range validation, pending-reset cleanup, real FFprobe/stream/reorder/revocation/source modification |
| Player Electron development acceptance | **PASS**, including real WAV/MP3/FLAC playback, artwork and metadata, native file drop, queue/options and lifecycle |
| Player packaged acceptance | **29 checks PASS**, same real path using the 0.2.0 portable executable, including reset during real playback and pending import, worker cleanup, same-file reselection, navigation/IPC isolation |
| CD angle | Animation time remains fixed after Pause settles and advances from that same time on Resume; actual audio clock resumes. Stop and natural Ended freeze it; new job returns to angle zero |
| Buffering signals | Synthetic `waiting`/`playing` events verify freeze/loading/resume; real playing/pause/ended/error tested separately. No network buffering test is claimed for this local-file app |
| Metadata truthfulness | Actual tagged MP3 title/artist/album/artwork displayed; absent MP3 bit depth omitted; WAV/FLAC measured 48 kHz/16 bit/2 channels |
| Errors | Corrupt MP3 rejected during real FFprobe; AIFF produces a readable real decoder error. Neither case leaves spinning/loading state |
| `test/ui-acceptance.cjs` | **PASS after UI regeneration**: real convert/navigation/cancel, strict IPC, absent-bridge behavior, 36 geometry/status cases for Download/Convert and no remote requests |
| `test/filename-electron.cjs` | **PASS**: both filename fields, valid/custom/blank submissions, validation and responsive widths |
| `test/reset-forms-electron.cjs` | **PASS**, Download + Convert: sections 01/02/03 clear and generated output files remain intact |
| `test/format-selection-ui.cjs` on portable | **PASS**: Download starts without a preselected format; manual choice/quality gates and responsive layouts preserved |
| Responsive / keyboard | Player 360/390/768/1280/1440 px without horizontal overflow; screenshot inspection; skip link, visible focus, Enter play and accessible reorder; reduced motion verified |
| Build | Existing `prepare-ui.cjs` → `package.cjs --directory-only` **PASS** with dependency checksum verification. 12 shipped source/UI files match source SHA256; package metadata matches (build strips development-only fields) |
| Syntax / diff | 11 changed JS/CJS modules pass `node --check`; `git diff --check` passes; final diff reviewed before commit |
| Original user data | One existing local-media profile file unchanged byte-for-byte by SHA256; no test worker/app process left running |

Computed Player and Download styles match: font `"DM Sans", "Noto Sans Thai", sans-serif`, background `rgb(20,23,25)` / `#141719`, text `rgb(240,238,232)` / `#f0eee8`, primary accent `rgb(201,170,112)` / `#c9aa70`. Convert uses the same unchanged shared stylesheet and was checked visually alongside Player.

Detailed local test records (ignored generated fixtures/profiles):

- `test-output/player-acceptance-1791464270300/results.json` — packaged Player, 29 checks including the final in-flight stream revocation fix.
- `test-output/player-acceptance-1791463616680/results.json` — development Player.
- `test-output/ui-acceptance-1791463909476/results.json` — regenerated Download/Convert regression.
- `test-output/format-selection-1791463933071/results.json` — portable format regression.

## Open Player

Open the complete portable folder's executable:

`D:\Sites\Audio Tech Labs\desktop\media-tools\release\Media-Tools-0.2.0-win-x64-20261008T125654\Audio Tech Labs Media Tools.exe`

Then click **Player** in Media Tools navigation. Keep executable/resources together. Close an already-running Media Tools version first because the app uses a single-instance lock. The existing installed shortcut still opens its old version; this task did not replace that installation.

For development, from `desktop/media-tools/`, run `npm start` and click Player. The page is `atl-media://app/player.html`; it must be opened inside the native application.

## Limits

- Maximum 500 tracks; regular local drives only, no UNC/symlink/junction/playlist manifests. Folder scan considers existing supported audio extensions; direct file selection probes the real container instead of trusting the filename.
- FFprobe-readable formats may be unsupported by Chromium. `canPlayType` and real decoder errors determine playback support; no guessed compatibility or automatic transcoding. WAV, MP3 and FLAC were played in acceptance; this is not a certification of every codec variant.
- Playlist is session-only and playback stops when leaving Player. No EQ/Crossfade/streaming service is included.
- CD logo source is the project's existing HTML/CSS wordmark, because there is no standalone Audio Tech Labs logo image in the inspected project assets.
- Native picker and confirmation responses are injected only in the test process to automate selection/approval; metadata workers, IPC, actual media bytes, Electron decoding and cleanup are real. Disk drop is exercised with Chromium's file-drag protocol.
- Existing Download live-provider acceptance remains outside this local Player task; regression checks cover existing native UI/job behavior and local conversion.
- Portable is internal/unsigned. No new installer or public ZIP was needed for testing, and no public release was made.
