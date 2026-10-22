# Audio Tech Labs — Cloudflare Security Baseline
**Date:** 2026-10-22 (Asia/Bangkok, UTC+07:00)
**Type:** Verified operational configuration record; NOT a Cloudflare configuration export or one-click restore backup.
**Scope:** Cloudflare account MFA; `audiotechlabs.com` SSL/TLS, HSTS, WAF, security.txt; production Web Demo authentication, upload, analysis, export, download.
**Status:** Accepted within observed/tested scope.

## Scope and safety boundary
- Captured from Cloudflare dashboard screenshots, user-confirmed changes and tests, public HTTP response headers, and read-only inspection of the EliteBook backend.
- No passwords, authenticator seed/QR, recovery codes, API keys, session cookies, or private security telemetry are stored here.
- No Cloudflare changes or production backend restarts were performed to create this baseline.
- This record **does not** reproduce the Cloudflare dashboard settings as an importable backup, certify every DNS record, or guarantee security against every exploit.

## Cloudflare account authentication
| Setting | Observed status |
| --- | --- |
| Account two-factor authentication | Active (Authenticator/TOTP) |
| TOTP setup after initial shared QR screenshot | Reconfigured, user-confirmed |
| Recovery codes | Privately saved by account owner; never captured here |
| Backup code reminders | ON (dashboard screenshot) |
| Security key | Not configured at review |
| Email authentication | Not enabled at review |
| Security Insights old “Users without MFA” item | Stale scan dated 2026-10-21; dashboard on 2026-10-22 showed MFA active; confirm via newer account-level rescan before archiving |

**Recovery:** Preserve at least one verified MFA method and securely stored backup codes. If locked out, use the provider's official account-recovery procedure. Never store MFA material in Git or issue-tracking.

## Zone SSL/TLS and HTTP response hardening
| Item | Accepted value / observation |
| --- | --- |
| Zone | `audiotechlabs.com` |
| SSL/TLS encryption mode | Full (strict) |
| Universal edge certificate | Active; managed by Cloudflare; dashboard showed expiry 2026-12-29 |
| Backup edge certificate | Issued; dashboard showed expiry 2026-12-31 |
| Coverage | Apex plus first-level wildcard `*.audiotechlabs.com` |
| Always Use HTTPS | ON |
| Minimum TLS version | TLS 1.2 |
| HTTP Strict Transport Security | Enabled, trial policy |
| HSTS max-age | 2,592,000 seconds (30 days) |
| HSTS includeSubDomains | OFF (header omitted) |
| HSTS preload | OFF (header omitted) |
| HSTS No-Sniff | OFF during trial; not implied by HSTS header |
| Response evidence | `HTTP/1.1 200 OK`, `Strict-Transport-Security: max-age=2592000`, `Server: cloudflare` on `https://audiotechlabs.com/.well-known/security.txt` on 2026-10-22 |

**Important:** This HSTS policy is served at zone scope; independently verify intended HTTPS behavior on apex, www, demo and backend, even without `includeSubDomains`. Do not casually remove Cloudflare proxy/HTTPS or switch to an insecure origin. Browsers cache the policy for max-age. Maintain a valid certificate and Full (strict) before extending HSTS lifetime.

## security.txt (RFC 9116)
**Public endpoint:** `https://audiotechlabs.com/.well-known/security.txt`
**Verified:** HTTP 200 with `Content-Type: text/plain; charset=utf-8` and user-observed content:
```text
Contact: https://audiotechlabs.com/
Expires: 2027-04-22T21:00:00Z
Preferred-Languages: th, en
```
The UTC expiry is 2027-04-23 04:00 in Bangkok. `Contact` currently points to the main site, not a dedicated security intake; consider routing to a verified public contact page or mailbox in future. Revalidate and renew before expiry. No unverified `security@audiotechlabs.com` address was published.

## WAF / bot posture
- Cloudflare Managed Free Ruleset: active; security-event evidence showed **Block** action on requests matching `React - RCE - CVE-2025-55182`.
- Such detections demonstrate WAF rule activity, **not** confirmed compromise of the backend.
- A read-only source/dependency scan in `D:\Sites\Audio Tech Labs` found no references to targeted React Server Components/Next package names in checked files. This is scoped evidence, not an exhaustive inventory of deployed Pages/Workers.
- Bot Fight Mode: OFF intentionally while assessing compatibility of Web Demo API and automated uploads.
- AI Labyrinth: OFF / not required at acceptance.
- Turnstile: not configured; production site uses login and server-side controls; avoid enabling without coordinated front-end and backend token validation.
- Security Insights old items are not the same as an actively exploited vulnerability; archive only after verifying.

## Production Web Demo acceptance — 2026-10-22
| Check | Result |
| --- | --- |
| `https://audiotechlabs.com/` | HTTP 200 over validated HTTPS |
| `https://demo.audiotechlabs.com/demo/` | HTTP 200 over validated HTTPS |
| `https://demo.audiotechlabs.com/api/health` | HTTP 200 over validated HTTPS |
| Anonymous GET `/api/uploads`, `/api/auth/me` | HTTP 401 (expected) |
| `https://backend.audiotechlabs.com/` without session | HTTP 401 / sign-in required (expected) |
| Production Web Demo login | User confirmed functional |
| Upload: `Soft Rock Ballads.wav`, 790,282,318 bytes | Success |
| Analyze V2 | `succeeded`; roughly 4 minutes |
| Export WAV | `succeeded`, **29 files**, **0 failures** |
| Files on EliteBook | 29 WAV files present, size metadata match on all 29 |
| Export download | User confirmed successful |
| Isolated backend HTTP integration suite | 6/6 passed, including WAV/FLAC/ALAC upload, analysis, export and download (not via Cloudflare) |
| Isolated Playwright browser regression | PASS at 1440/1024/768/390/320 widths, 10 split downloads, merge regression, 0 JavaScript errors (not via Cloudflare) |

**Interpretation:** These checks support the accepted workflow. They do not prove that every user, larger workload or browser variation will succeed; continue monitoring.

## Quick verification commands (read-only)
```powershell
curl.exe -sSI https://audiotechlabs.com/.well-known/security.txt
curl.exe -sS -o NUL -w "Demo HTTP %{http_code} TLS %{ssl_verify_result}\n" https://demo.audiotechlabs.com/demo/
curl.exe -sS -o NUL -w "API HTTP %{http_code} TLS %{ssl_verify_result}\n" https://demo.audiotechlabs.com/api/health
curl.exe -sS -o NUL -w "Anonymous auth HTTP %{http_code}\n" https://demo.audiotechlabs.com/api/auth/me
```
Expected: `security.txt` status 200, MIME `text/plain`, HSTS `max-age=2592000` with no preload/includeSubDomains; Demo and API health 200; anonymous `/api/auth/me` 401.

## Recovery and change-control checklist
1. Save evidence of current status before any subsequent change; identify Cloudflare account/zone and affected host.
2. Check origin/backend and Cloudflare health separately, including tunnel and Pages routes; do **not** restart services automatically.
3. Confirm certificate + Full (strict), Always Use HTTPS, 30-day HSTS and all four hostnames before changing SSL or proxy.
4. For WAF false positives, inspect Security Analytics events (hostname, path, action, matched rule) before narrowly scoping an exception. Keep React RCE managed protection active absent clear contrary evidence.
5. For Web Demo regression, reproduce with a disposable/test account and lossless fixture; verify `queued → running → succeeded`, actual output file sizes and public download.
6. Treat rollback of HSTS separately from app deployment: cached browser policy can remain effective after a configuration change.
7. Renew `security.txt` before `2027-04-22T21:00:00Z`; re-check account MFA and archive any stale Security Insights item only after confirmation.
8. Git checkpoint for this **document** is not a production application rollback or Cloudflare settings backup. Document the actual deployment commit and Cloudflare export separately before attempting app/infra recovery.

## Integrity / handoff
- This snapshot is documentation-only.
- Earlier DNS recovery record `DNS-RECOVERY-BASELINE-20261014.md` existed untracked before this work; it was deliberately excluded from this checkpoint.
- No production code, DNS, Cloudflare settings, keys, database, uploads, or exports were changed for this snapshot.
