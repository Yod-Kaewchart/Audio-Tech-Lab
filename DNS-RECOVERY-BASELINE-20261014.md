# Audio Tech Labs — DNS Recovery Baseline (14 October 2026)

**Date/time zone:** 2026-10-14 (Asia/Bangkok, UTC+07:00)
**Scope:** Registrar email verification, domain reactivation, DNS and Cloudflare Pages custom-domain recovery.
**Result:** **PASS for the observed DNS queries and manual browser access on the user's machine.** No claim of global propagation or backend-service verification.

## Summary

On 14 October 2026, Z.com / GMO Onamae.com notified the registrant that the domain had been suspended because the registrant email address had not been verified. The verification page reported successful email validation, and a follow-up email at 15:11 stated that domain(s) using that registrant address were reactivated. The Z.com domain list subsequently showed `audiotechlabs.com` as **Active** (expiration **2027-09-30**, auto-renewal enabled in the UI).

A separate DNS problem remained: the Cloudflare zone had records for `backend`, `demo`, and `www` but no apex (`@`) web record. Queries for `audiotechlabs.com` returned no A or AAAA address, including a direct query to the authoritative server `linda.ns.cloudflare.com`. The operator added `audiotechlabs.com` as a custom domain of the existing Cloudflare Pages project `audio-tech-lab`. Cloudflare proposed an apex CNAME to `audio-tech-lab.pages.dev`; the operator activated it. Later DNS queries returned Cloudflare IPv4 answers for both apex and `www`. The operator confirmed that all three public website URLs opened.

## Registrar and nameservers

| Item | Confirmed observation |
| --- | --- |
| Registrar management UI | Z.com / Onamae.com |
| Domain | `audiotechlabs.com` |
| Email verification | Success shown by verification page and reactivation email |
| Registrar status | Active after verification |
| Registrar expiration shown | 2027-09-30 |
| Auto renewal shown | Enabled |
| Authoritative nameservers | `linda.ns.cloudflare.com`, `peter.ns.cloudflare.com` |
| Name server delegation changes | None requested or performed in this recovery |

**Security:** No verification URL, token, account email, login credentials, or cloud secret is included in this baseline.

## DNS record evidence

**Before apex change** (Cloudflare DNS → Records screenshot):
- `backend.audiotechlabs.com` — Tunnel, destination `audio-tech-lab-elitebook`, Proxied, TTL Auto.
- `demo.audiotechlabs.com` — CNAME to `audio-tech-lab.pages.dev`, Proxied, TTL Auto.
- `www.audiotechlabs.com` — CNAME to `audio-tech-lab.pages.dev`, Proxied, TTL Auto.
- No record for `@` / `audiotechlabs.com`; Cloudflare UI warned that visitors could not reach the apex domain.

**Change approved and applied in Cloudflare Pages UI** (2026-10-14):
- Workers & Pages → `audio-tech-lab` → Custom domains → Set up a custom domain.
- Added `audiotechlabs.com`. Cloudflare's confirmation screen proposed **CNAME `@` → `audio-tech-lab.pages.dev`**, TTL Auto.
- Selected **Activate domain**; Custom domains screen then showed `audiotechlabs.com`, `www.audiotechlabs.com`, and `demo.audiotechlabs.com` all **Active / SSL enabled**.
- The final complete DNS Records table after the change was not independently captured; the record proposal, successful activation, and A responses are evidence of the intended apex routing.

**Before change — diagnostics:**
- `Resolve-DnsName audiotechlabs.com -Type A -Server 1.1.1.1`: SOA in Authority, no A Answer.
- `Resolve-DnsName audiotechlabs.com -Type AAAA -Server 1.1.1.1`: SOA in Authority, no AAAA Answer.
- `Resolve-DnsName audiotechlabs.com -Type A -Server 8.8.8.8`: SOA in Authority, no A Answer.
- `Resolve-DnsName audiotechlabs.com -Type A -Server linda.ns.cloudflare.com`: SOA in Authority, no A Answer.

**After change — diagnostic output supplied by operator:**

```text
Resolve-DnsName audiotechlabs.com -Type A -Server 1.1.1.1
  104.21.16.32   (A, Answer, TTL 300)
  172.67.166.15  (A, Answer, TTL 300)

Resolve-DnsName www.audiotechlabs.com -Type A -Server 1.1.1.1
  104.21.16.32   (A, Answer, TTL 300)
  172.67.166.15  (A, Answer, TTL 300)
```

The addresses above are Cloudflare edge addresses returned by the queried resolver, **not** origin-server addresses to be copied into new records.

## Cloudflare Pages and site topology

- Pages project: `audio-tech-lab`; default hostname `audio-tech-lab.pages.dev`.
- Production source shown in Cloudflare: `Yod-Kaewchart/Audio-Tech-Lab` branch `main`, automatic deployments enabled.
- Existing `www` and `demo` Pages custom domains were retained unchanged in this recovery.
- Existing `backend` Cloudflare Tunnel DNS record was retained unchanged; no backend health or Control Center acceptance test is claimed here.
- Existing topology is described in `STABILITY.md`; older hosting material in `DEPLOYMENT.md` is historical.

## Manual acceptance and limits

| Check | Result | Evidence |
| --- | --- | --- |
| Registrar email verification | PASS | Verification success page and registrar confirmation email |
| Registrar status | PASS | Z.com UI showed Active |
| Cloudflare Pages custom domains + SSL | PASS in dashboard | All 3 domains Active / SSL enabled |
| Apex IPv4 DNS on 1.1.1.1 | PASS | Two A records returned |
| WWW IPv4 DNS on 1.1.1.1 | PASS | Same two A records returned |
| `https://audiotechlabs.com` | PASS in operator's browser | Operator manually confirmed opening |
| `https://www.audiotechlabs.com` | PASS in operator's browser | Operator manually confirmed opening |
| `https://demo.audiotechlabs.com` | PASS in operator's browser | Operator manually confirmed opening |
| Worldwide DNS propagation, IPv6 after fix, redirect behavior | NOT TESTED | Do not infer from local browser acceptance |
| Backend tunnel, API, auth, Control Center, email delivery | NOT TESTED | Outside this recovery acceptance |

Z.com stated that global website/email visibility could take up to 72 hours following registrar reactivation; Cloudflare also displayed a propagation warning of up to 48 hours during domain setup. Those are cautions from providers, not measured outage durations.

## Follow-up (deferred; no change made)

- Decide whether `www.audiotechlabs.com` will remain the canonical hostname, and if so plan and separately test a **301 redirect from apex to www**, preserving paths, query strings, HTTPS, SEO metadata and existing Pages/Control Center routes. Do **not** add redirects as part of this baseline.
- Optionally re-check DNS from another independent network and review Cloudflare DNS → Records to confirm the new `@` CNAME in the full post-change record list.
- Keep WHOIS / registrant email current and retain registrar verification notifications.

## Change boundaries

This recovery required only registrar email verification/reactivation and Cloudflare Pages custom-domain configuration. No source code, application build, Git merge, GitHub push, DNS nameserver replacement, tunnel configuration, backend service, or 301 redirect was changed as part of the documented manual recovery. This report is a documentation-only record and is **not** evidence of a new production deployment.
