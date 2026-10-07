# Control Center verification — 7 October 2026

> Follow-up: Modify Windows host monitoring is now connected, and the OpenAI configuration badge distinguishes configured/not connected. See [MODIFY-HEALTH.md](MODIFY-HEALTH.md) for current behavior and release checks. The details below record the initial dashboard release.

The dashboard now reads the existing backend health, administrator audit and saved AI provider configuration APIs. No new backend route, remote agent, credential or monitoring connection was added.

## Behavior

- Backend health requires HTTP success, JSON, the expected service identity, numeric API version 1, authentication enabled and an exact fresh request nonce. Requests bypass caches and have a five-second deadline covering response bodies.
- EliteBook displays backend service reachability. Web Demo displays the same API result; these are not independent machine checks.
- Modify displays **NOT MONITORED**. Its Details control explains that an authenticated monitoring connection is required. A nonfunctional remote Health Check button was removed.
- The global status displays partial monitoring coverage, incomplete checks or an unreachable service. There is no fabricated health score or all-systems-online claim.
- Health Check and Run Diagnose open the Health view and run current read-only checks. Diagnose does not call an AI model or perform remote repair.
- Recent Activity and Activity Logs read the administrator audit API. Older records load using its cursor. Untrusted event fields render as text. Refresh discards stale pagination results, and failed reads clear obsolete logs.
- AI Agents displays the current administrator's saved OpenAI connection state. A saved connection is not presented as proof of provider availability. Manage Integrations links to the existing Web Demo.
- All six navigation links select working views, including URL hashes and browser history. Details controls expand/collapse; Open Service links to the Web Demo.
- Refresh runs automatically every 15 seconds while visible, with a browser-local option to disable it. Offline/background/pagehide events invalidate pending results. Reconnect, visible-page return and cached-page restoration recheck current state.
- Administrator sessions are rechecked with refresh. Invalid, non-admin or forced-password-change sessions hide the dashboard and return to login. Sign out retains its existing revocation, CSRF and Cloudflare Access flow.
- Session code was extracted into `session.js`, so the dashboard also runs under a same-origin script policy without inline JavaScript.

## Verification

**78 automated tests passed** across these suites:

```text
node --test tools/control-center-dashboard.test.cjs tools/control-center-security.test.cjs tools/control-center-logout.test.cjs tools/pages-proxy.test.cjs tools/pages-routing.test.cjs
node --test tools/deployment.test.cjs server/health-status.test.cjs server/activity.test.cjs server/openai-http.test.cjs
```

The first command passed 35 tests; the second passed 43, including nested cases. Pages build and `git diff --check` also passed. Source and distributed dashboard HTML/JavaScript are checked for equality.

Before release, `node tools/test-portable.cjs` passed all **135 tests**. This suite excludes the three suites requiring the separately installed audio core; no audio-core changes were made.

Browser verification used a separate temporary backend with a synthetic administrator and isolated storage. It exercised all menu destinations, Health Check, Details, Run Diagnose, the auto-refresh option, real isolated audit/provider responses, synthetic HTTP 503 health failure and recovery. Desktop and a 390 × 844 mobile viewport were checked; mobile document width equaled its scroll width and visible buttons were at least 44 pixels high.

## Remaining scope and release

Modify machine monitoring and remote repair require a separately configured authenticated endpoint/agent. CPU, memory and disk metrics are not collected by the current health API. Saved OpenAI configuration is read without testing the provider or making model calls.

Release uses the existing Cloudflare Pages Git integration for `Yod-Kaewchart/Audio-Tech-Lab`, branch `main`, build command `node tools/build-pages.cjs` and output `.site-build/pages`. The owner authorized Cloudflare publication on 7 October 2026. Production dashboard acceptance still requires Cloudflare Access authentication after release. Modify monitoring and Cloudflare Access policy changes are outside this release.
