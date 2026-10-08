# Player continuous playback — 0.2.1 acceptance

Date: 2026-10-08, Windows x64 / EliteBook. Base: `a9d2ce2122133ea4627efb8b6ecb281f692c0e6c` (Player V1 0.2.0). Branch: `codex/player-continuous-playback`.

The repository was clean before work. No AGENTS.md was found in the repository or its parent directories. Only this task is included in the checkpoint. No dependency was added. No push, merge, deployment or installer is part of this release.

## Cause and implementation

Version 0.2.0 constructed its audio element, queue, playback state and audio event listeners in the Player document. Navigation replaced that document; its `pagehide` callback paused and detached audio. Main memory retained the file registry, but playback and controls were lost.

Version 0.2.1 keeps one audio element, PlayerQueue, playlist, playback controls and rotation clock in a private, hidden Electron BrowserWindow for the entire app session. The main process owns this window and the existing PlayerLibrary. Navigation still uses the existing local documents and shared header. The visible Player has no audio element or queue; it gets a current snapshot and subscribes to state updates, then sends validated controls through preload/IPC. On page exit it aborts only UI listeners and unsubscribes. There is no save-time/reopen workaround, no navigation-triggered audio reload, and no interval in the playback host.

The host uses `backgroundThrottling: false` so hidden media state processing continues, consistent with the [Electron BrowserWindow documentation](https://www.electronjs.org/docs/latest/api/browser-window). It accumulates the CD rotation time only while actual audio is playing and ready, excluding pauses and buffering. The Player applies that clock to the original 12-second CSS animation on return, including the current frozen angle while paused. The shared fonts, backgrounds, colors, geometry and reduced-motion rule are unchanged. The only generated shared-view change is the 0.2.1 version label.

Security remains context isolation + sandbox + no Node integration + webSecurity. The private host has a separate minimal preload and is excluded from approved public UI documents. Main validates its owned webContents, main frame and exact host URL before accepting replies/state. Public controls accept an exact allowlist and finite scalar ranges; renderers cannot supply playlists, media URLs, filesystem paths or private reset/shutdown commands. Other public pages can read current playback state but cannot mutate/reset Player. Audio still uses opaque protocol tokens and the original file identity/path checks, range streaming and revocation. Renderer networking and permissions remain denied.

Player reset detaches audio before revoking the library and waiting for import cleanup. Download/Convert retain their existing single shared processing job; their new-job buttons reset that job independently of Player. Closing the main window stops/releases the host, removes its IPC listener, destroys the hidden window and resets the library. Existing worker cancellation/cleanup confirmation remains in effect. The host cannot close independently during an app quit, and a crashed host reports stopped/error state without creating another audio instance.

## Actual acceptance results

Source execution completed successfully; isolated profiles were used for every application test.

| Check | Result |
| --- | --- |
| `npm test` | 23/23 passed, including real FFmpeg publishing/conversion, file identity/range/revocation, pending-import reset, queue boundaries and strict playback controls |
| Player regression | 29 checks passed: real WAV/MP3/FLAC metadata/artwork, Play/Pause/Resume/Stop/Ended, Seek, Volume/Mute, Previous/Next, Shuffle/Repeat, imports/drop/folders/removal/reorder/reset, unsupported/corrupt files, responsive/focus/reduced motion |
| 20 full navigation rounds | Player → Download → Convert → Player, 60 document changes. Same engine ID, host webContents ID and audio object; playlist and all controls restored; audio position and disc clock advanced each round |
| Duplicate resource check | Before/after: 2 windows, 1 audio element, 1 host IPC listener, 0 live main-process RPC timeout resources, 20 audio listeners including 6 test probes. No extra play, pause, emptied or loadstart events during navigation |
| Pause away and return | Exact audio position and host CD clock unchanged. Returned CSS animation time equals that clock. Resume advances from the same angle |
| Ended away | Actual short WAV completion advances playlist on another page; Repeat off stops at final item, Repeat one loops twice on Convert, Repeat all wraps to first on Download, Shuffle selects another registered track |
| Real Convert while playing | 8-second WAV → FLAC succeeded: 48 kHz, 16 bit, stereo, 118,292 bytes. Same audio continued without play/load/pause events |
| Real Download while playing | User-provided public URL `https://youtu.be/RaTUVhOb9jY` inspected and downloaded successfully using bundled yt-dlp. Original output: Opus/WebM, 48 kHz, stereo, 5,281.101 seconds, 91,691,492 bytes; unknown bit depth remains null. Same audio kept playing |
| Separate resets | Convert and Download new-job buttons clear only processing work and preserve Player plus published output. Player new-job clears audio source, playlist, metadata/artwork, position, options, input and rotation; same file can be imported again |
| App close while playing | Audio host destroyed, host IPC listener removed, app reached will-quit with zero remaining windows |
| Download/Convert UI regression | Real Convert across navigation/reload/cancel; 36 geometry/status cases; absent native bridge remains unavailable. Explicit format selection and both reset-form suites pass |
| Styling/accessibility | Computed local DM Sans/Noto Sans Thai, background rgb(20,23,25), text and accent match all three actual pages; no overflow at 360/390/768/1280/1440; keyboard transport/focus and reduced motion pass |
| Renderer regressions | Zero JavaScript errors and zero external requests from either UI or hidden renderer |

Source records: `test-output/player-acceptance-1791465908715/results.json`, `test-output/continuous-playback-1791466195231/results.json`, `test-output/ui-acceptance-1791466008693/results.json`, `test-output/format-selection-1791466284675/results.json`, and `test-output/new-job-reset-forms-{download,convert}-*/results.json`. Full test media and isolated profiles remain in ignored test-output, outside Git and user data.

## Final portable verification

Portable directory: `release/Media-Tools-0.2.1-win-x64-20261008T134449/`. Open `Audio Tech Labs Media Tools.exe` after closing the old app, then choose Player. It was built with `node scripts/prepare-ui.cjs` followed by the existing `node scripts/package.cjs --directory-only` workflow; no installer or system installation was created.

- Final portable Player regression: 29/29 checks, `test-output/player-acceptance-1791467135259/results.json`.
- Final portable continuity: all 20 full navigation rounds, exact paused angle/position, actual ended/Shuffle/Repeat, real Convert, independent resets, strict IPC, responsiveness and close cleanup passed. `test-output/continuous-playback-1791467159346/results.json` records 17 checks and one real provider failure discussed below.
- The live Download succeeded in the source run and first portable run (`test-output/continuous-playback-1791466822109/results.json`). The final portable run received `NETWORK_FAILED` during a repeat download; the UI showed the error, staging was cleaned, its reset worked and Player continued. One targeted retry on the **final portable** succeeded with the same 91,691,492-byte Opus/WebM result, while its original audio instance and playing track remained unchanged: `test-output/final-download-1791467370032/results.json`. This external failure is retained as evidence, not counted as a successful download.
- Final portable close with a real active Convert worker: dismissing the native close question preserved both audio and the job; confirming cancel/close waited for worker cancellation and staging cleanup. At quit: audio cleared, job cancelled, zero windows, zero host IPC listeners. `test-output/playback-close-1791467104478/results.json`.
- Startup failure and closing before the host was ready both exited with zero windows/listeners; the former showed exactly one error, the latter showed none. Native source harness records: `test-output/playback-startup-failure-1791467087041/results.json` and `test-output/playback-startup-early-close-1791467087866/results.json`. Initialization retains the host reference for cleanup, and a host that has not initialized is destroyed without waiting for an unavailable RPC receiver.
- Both native reset-form suites and filename UI validation/submission passed. Filename record: `test-output/filename-electron-1791467116906/results.json`.
- All **30 src/ui files** in the final portable matched source bytes. Packaged package.json reports 0.2.1 and intentionally omits build scripts/dev dependencies. Executable SHA256: `2529b494f4123f152bce346051f7bd855ef95006424a561953cf17c49a3d1ba8` (the existing Electron runtime; application source verification is separate).
- The pre-existing user profile's single local-media file remained SHA256-identical (`30b57b6f78b760acbc5e842b9d54ec5d50fe5e428ebb1f893ba89accc82e7f72`). No user profile was copied into the portable, reset, migrated or removed.

Committed evidence: `evidence/player-continuity-0.2.1.json`, `evidence/player-continuity-360.png` and `evidence/player-continuity-1280.png`. Desktop and mobile screenshots were visually reviewed against the existing layout and actual computed-style checks.

## Changed files

- Application lifetime and IPC: `src/main.cjs`, `src/preload.cjs`, new `src/playback.cjs` and `src/playback-preload.cjs`.
- Persistent engine: new `ui/playback-host.html` and `ui/playback-host.js`; the existing PlayerQueue and PlayerLibrary are reused unchanged.
- UI binding/navigation text: `ui/player.js`, `ui/player.html`, `ui/player-view.js`, `ui/adapters.js`, generated `ui/view.js` version label. Shared CSS, fonts and logo source are unchanged.
- Version/package/docs: package.json, package-lock.json, scripts/package.cjs, README.md, this report and the three evidence files.
- New test coverage/helpers: continuous-playback.cjs, playback-close.cjs, playback-startup-electron.cjs, playback.test.cjs, electron-ui.cjs. Existing Player/UI/format/paste/portable/filename/reset/new-job/smoke harnesses now identify the public UI document rather than relying on BrowserWindow ordering.

## Reproduction

Use the existing runtime/vendor and project scripts. On this machine Playwright is provided by the bundled Codex dependency directory; it is not added to the application dependency graph.

```powershell
cd 'D:\Sites\Audio Tech Labs\desktop\media-tools'
npm test
$env:NODE_PATH='C:\Users\EliteBook\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node test/player-acceptance.cjs
node test/ui-acceptance.cjs
node test/format-selection-ui.cjs
$env:ATL_TEST_YOUTUBE_URL='https://youtu.be/RaTUVhOb9jY'
node test/continuous-playback.cjs
node test/playback-close.cjs
node scripts/prepare-ui.cjs
node scripts/package.cjs --directory-only
# ATL_PLAYER_EXE selects the packaged executable for both Player suites.
$env:ATL_PLAYER_EXE=(Get-Content release/latest.json -Raw | ConvertFrom-Json).executable
node test/player-acceptance.cjs
node test/continuous-playback.cjs
```

Native reset/filename tests must select the public UI document rather than the first BrowserWindow. The private host may load first, and Windows launches with WindowStyle Hidden can hide the main window too. Async IPC acceptance predicates are polled after resolving their result; a Promise itself never counts as a successful check.

## Limits

The tests exercise real Electron decoding/playback and media events, not an external recording or physical listening test. Buffering signals in the Player regression are deliberately synthetic and identified separately from real Play/Ended tests. Synthetic terminal DTOs exercise Download/Convert geometry/reset forms only; the live Convert and YouTube Download above use real native IPC, workers, probing and publishing, with only native file-picker replies automated.

The YouTube result is a single public video URL containing a long audio compilation, not a playlist endpoint or live stream. Provider availability can change; no cookies, login, remote scripts/plugins or new software were used. The build remains unsigned and has not been checked on a clean Windows VM. Existing local-drive/codec restrictions and session-only playlist storage remain. The hidden renderer adds one persistent Electron renderer, but no additional playback engine. EQ, Crossfade, streaming services and installer work are outside this patch.
