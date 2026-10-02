# EliteBook backend-only staging

Prepared for the existing audio core at `D:\Projects\Audio Album Splitter AI`.
The website checkout is `D:\Sites\Audio Tech Labs`.

- Python 3.12 with a separate `.venv-backend`; pinned packages in `server/requirements-backend.txt`.
- No PySide6, PyQtGraph, sounddevice, PyAudio, GUI, or sound card required.
- FFmpeg/FFprobe 9.0.2 essentials installed in the core's ignored `tools/ffmpeg-local/extracted`.
- Download: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
- ZIP SHA256: `60F467265B1E312373DBCD92200C2618A74850F98D3D078E94296BB3FA2047BA`.

Run from the website checkout:
```powershell
.\tools\setup-backend-only.ps1
node tools/start-backend-only.cjs
```

Staging listens only at `http://127.0.0.1:8788`.
Its independent data root is `tools/runtime/backend-only`; generated first-login credentials live there.
This entry point does not import production users/database, load Spotify credentials, start a web frontend, register startup tasks, or start/change Cloudflare Tunnel.
The existing service on 8787 and the Modify machine are left running.
`ATL_SPLITTER_ROOT` selects the core source; `ATL_AUDIO_PYTHON` selects its interpreter in the API.

Verification:
```powershell
$env:ATL_AUDIO_PYTHON = 'D:\Projects\Audio Album Splitter AI\.venv-backend\Scripts\python.exe'
node --test --test-reporter=spec tools/backend-e2e.test.cjs server/*.test.cjs tools/deployment.test.cjs
node tools/backend-load.cjs 80
node tools/backend-load.cjs 120
```

Tests use isolated temporary accounts/storage and delete their audio fixtures after completion.
JSON reports remain in ignored `tools/runtime/backend-verification`.
Short fixtures cover WAV/FLAC/ALAC, exact non-integer-duration frames, preview caching/range reads, whole/split WAV/FLAC exports, mixed-container merge, and invalid merge track counts.
Long runs use synthetic 48 kHz/24-bit stereo FLAC; PCM SHA256 and frame count are checked for preview, WAV export, split FLAC, and merged FLAC using bounded-memory decoding.
