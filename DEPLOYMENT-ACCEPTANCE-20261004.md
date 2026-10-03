# Web Demo Performance Deployment Acceptance — 2026-10-04

## Rollback baseline

- Project: `D:\Sites\Audio Tech Labs`
- Branch: `main`
- Performance code commit: `0aaef8ea4480bb9459b401ba6808432f1996a7ba`
- Commit message: `perf(web-demo): reduce idle polling and redundant UI work`
- Cloudflare Pages public marker verified: `performance1`
- Public backend health: HTTP 200, `ok=true`, instance `elitebook`

## Final verification before deployment

- Full automated suite: **121/121 passed**
- Stability checks: passed
- Split/Merge/QC functional checks: passed
- Delete lifecycle checks: passed
- Responsive verification: **28 layout cases passed**
- Waveform resize coalescing: **40 resize events -> 1 canvas draw**
- Secret scan of changed files: no credential-like literals found
- `git diff --check`: passed
- Cloudflare Pages build: passed

## Public Before -> After

Public measurements were collected separately from local measurements using Chrome 154, 3 samples per viewport, cache disabled. Values below are medians.

| Metric | 390px Before | 390px After | 1440px Before | 1440px After |
| --- | ---: | ---: | ---: | ---: |
| Requests | 24 | 24 | 26 | 24 |
| Transfer bytes | 66,561 | 59,774 | 67,282 | 59,767 |
| Wire bytes | 82,456 | 75,375 | 83,570 | 75,362 |
| DOMContentLoaded (ms) | 596.2 | 518.8 | 300.3 | 334.5 |
| Load (ms) | 600.3 | 523.0 | 305.1 | 337.9 |
| LCP (ms) | 316 | 232 | 244 | 340 |
| CLS | 0.000294 | 0.000294 | 0.000131 | 0.000131 |

Interpretation:
- Public payload and wire bytes decreased at both measured viewport sizes.
- Public request count decreased at 1440px and remained unchanged at 390px.
- LCP/DCL/Load vary between public samples, so this deployment does **not** claim a general Core Web Vitals improvement.
- The strongest controlled improvements remain reduced idle/background API activity and redundant DOM/canvas work.

## Production smoke test

- `https://demo.audiotechlabs.com/`: HTTP 200 after redirect handling
- `/demo/`: HTTP 200
- `/demo/merge/`: HTTP 200
- `/demo/qc/`: HTTP 200
- `/api/health`: HTTP 200, backend online
- Public asset marker `performance1`: verified
- Public measurement: no page errors and no failed transport requests
- Anonymous `/api/auth/me` HTTP 401 is expected behavior
- No favicon 404 returned in final measurement

## Known acceptance limits

Not exercised against live external providers in this deployment acceptance:
- Live OpenAI provider round trip
- Live Spotify provider round trip
- Physical EliteBook power-off / cold boot cycle

Covered by isolated/local tests:
- Offline -> Online backend recovery
- Authentication/session behavior
- Queue and mutation non-replay behavior
- Audio Analyze/QC/Preview/Export/Merge
- Delete/cleanup lifecycle
- OpenAI/Spotify integration contracts using mocks

## Rollback

The annotated Git tag created for this accepted state is:

`rollback-web-demo-perf-20261004`

To inspect the rollback point:

```powershell
git show rollback-web-demo-perf-20261004
```

To create a recovery branch from it without rewriting current history:

```powershell
git switch -c recovery/web-demo-perf-20261004 rollback-web-demo-perf-20261004
```

Do not use force-push or destructive reset for normal rollback handling.
