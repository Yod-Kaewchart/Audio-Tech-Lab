# Cloudflare Pages + EliteBook operations (2026-10-03)

This supersedes the old deployment topology in DEPLOYMENT.md.

## Current topology and release

The existing **audio-tech-lab** Cloudflare Pages project builds `main` from `Yod-Kaewchart/Audio-Tech-Lab` with `node tools/build-pages.cjs`. The artifact is `.site-build/pages`; Functions are in `functions/`. GitHub Actions validates code; Cloudflare Git integration deploys it. The main site is `www.audiotechlabs.com`. Only the root of `demo.audiotechlabs.com` redirects to `/demo/`. All HTML, CSS, scripts and images are static Pages assets. `/api/*` goes to `backend.audiotechlabs.com/*`, through the existing Cloudflared service to `127.0.0.1:8787`. Port 8080 is intentionally unused in Pages mode. No service, tunnel, DNS or hosting migration is needed.

## Health, login and reconnect

Health requires HTTP success, JSON, `ok=true`, service `audio-tech-labs-demo`, numeric API version 1, authentication true, and the exact request nonce. All layers disable caching. Proxy health timeout covers headers and body (4.5 seconds); browser deadline is 5 seconds. Polling is single flight every 15 seconds while visible, plus immediate checks on resume/network return. Online polls do not flash CHECKING. API actions revalidate health older than 20 seconds. Offline events invalidate older health responses.

Login/register are single flight, with guards in submit handlers and state-aware finally blocks. Reconnect preserves password/user messages and clears only its own obsolete connection text. Workspaces retain recoverable data offline; session checks and job/resource reads run again on recovery. Expired sessions return to login. Processing submissions, passwords and uploads are never replayed automatically. If a submission response is lost, inspect job history before retrying manually; the backend may already have accepted it.

## Startup and process recovery

- Cloudflared is an Automatic Windows service under LocalSystem. Existing recovery restarts it after 20 seconds.
- **Audio Tech Lab Backend** is an interactive, limited Scheduled Task under `ELITEBOOK\EliteBook`, triggered at **Windows login**, not boot before login.
- It runs `wscript.exe //B //NoLogo tools/start-web-demo-hidden.vbs`, waits for hidden PowerShell, and uses hidden child processes. Working directory is `D:\Sites\Audio Tech Labs`.
- Configuration is ignored `tools/runtime/deployment.json`, selecting the existing core `D:\Projects\Audio Album Splitter AI` and `.venv-backend\Scripts\python.exe`. The existing core provides FFmpeg/FFprobe; no reinstall is required.
- Backend startup tolerates Cloudflared/network not yet ready. Public health becomes online only when the whole path works.
- The global launcher mutex prevents duplicate starts. An orphan backend is reported, not killed by ordinary startup.
- A crashed backend is restarted after 10 seconds; repeated short failures back off to 20/40/80/160/300 seconds, resetting after five stable minutes. Failed health is logged without killing potentially busy workers.
- Supervisor exceptions stop children and return failure. Existing task recovery retries up to three times, one minute apart. A forcibly killed supervisor leaving a live orphan backend requires inspection; the launcher refuses to create a duplicate.
- Logs: `tools/runtime/startup.log`, `supervisor.log` (5 MB rotation), and `state.json`.

## Restart safely

`tools/start-web-demo.ps1 -Restart` checks persisted queued/running jobs, then calls loopback-only `POST /internal/maintenance`. This refuses active jobs/uploads/mutations; otherwise it blocks new mutations for up to two minutes before stopping processes. Tunnel/forwarded/Origin requests cannot call maintenance. Run as the task owner; Windows may require elevation to control another identity. Retry busy restarts after work finishes. Never shut down/reboot the machine as a test.

A pre-maintenance backend deliberately cannot use this guarded restart command. Its first upgrade requires checking its persisted queue and partial uploads immediately before a controlled stop/start of the existing task.

## Verification and rollback

Full EliteBook suite: set `ATL_AUDIO_PYTHON` to the configured interpreter, then run `node --test server/*.test.cjs tools/*.test.cjs`. Browser regressions: `node tools/verify-stability.cjs` and `node tools/verify-split-ui.cjs` with the existing Playwright package on NODE_PATH. They use isolated accounts/storage. Linux CI runs `node tools/test-portable.cjs`; it explicitly excludes three suites requiring the separately installed audio core. Do not claim Linux CI tests that core.

For an authorized production outage: `node tools/verify-public-stability.cjs --allow-backend-stop`. It refuses active work, stops the existing task, checks public Pages while offline and browser recovery without reload, and restores the task in finally. `--bootstrap-old-backend` is only for the first audited upgrade. Evidence is ignored under `tools/runtime/`.

Pre-change HEAD is `05e989251ac9a9263504f441d906b27d32312e10`. Task/configuration backup is `tools/runtime/rollback-stability-20261003/`. Roll back by reverting the stability commits and pushing main through the same Cloudflare integration, preserving unrelated changes. Use the maintenance-capable version to stop an idle backend before restoring older backend code. A frontend-only rollback can select the previous successful deployment in Cloudflare Pages. Restore task XML/configuration only if those settings changed. Preserve users/uploads/exports and never include runtime/secrets in the Pages artifact.

Physical power-off and real boot/login remain separate manual acceptance tests; a successful task launch during an existing login is not evidence of a boot test.
