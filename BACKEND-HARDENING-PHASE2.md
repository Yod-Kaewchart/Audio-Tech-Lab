# Backend hardening Phase 2 — review and pending proxy verification

This branch starts at `origin/main` (`e8ddf13`), independently of Phase 1.
No configuration, firewall, tunnel, or deployed service is changed by this work.

## Registration and hashing policy

- Valid identities that pass their identity quotas consume one of 300
  instance-wide attempts per fixed 15-minute window. Invalid JSON/fields have a
  separate 300-attempt window, and requests already over an identity quota do
  not consume the valid-work budget. Requests rejected by the full scrypt queue
  refund the valid-work budget while retaining their identity quota. These are
  instance-wide circuit breakers, not per-client identity guarantees.
- After validation, username and email each have a separate quota of five
  attempts per fixed 15-minute window, reserved before scrypt. Duplicate names,
  queue rejection and subsequent processing failures still consume the quota.
  These identity quotas do not group unrelated users sharing an IP. An attacker
  can nevertheless exhaust the instance-wide circuit breaker; assess the 300
  threshold against legitimate traffic before any production rollout.
- Identity keys are digests, held in a bounded 4,096-entry in-memory map;
  expired entries are pruned. All counters reset on backend restart and are not
  coordinated across backend processes. Only a 429 response carries
  `Retry-After`. Requests with a non-JSON content type are rejected before the
  registration limiter; request-body size is independently capped.
- A process-wide gate limits asynchronous scrypt to two active and eight waiting
  jobs across registration, login, password changes and administrator account
  creation. A full queue returns 429 with `Retry-After: 1`. Existing synchronous
  bootstrap hashes run before that auth instance serves requests. The choice
  is conservative for this Cloud PC (4 logical CPUs, 8 GiB RAM); production
  capacity and concurrent request latency remain unverified.

## PENDING CONFIGURATION VERIFICATION — trusted proxy

The documented path is Client → Cloudflare Pages Function → backend host through
Cloudflare Tunnel → loopback backend. `functions/api/[[path]].js` forwards
headers, and login in `server/auth.cjs` still uses `CF-Connecting-IP` when it
is present, as on the baseline. A loopback peer alone does not authenticate a
proxy. The deployment's header replacement rules, subrequest behavior, local
process isolation, and tunnel access policy have not been verified. Therefore
the baseline login IP rate-limit key may be spoofable if an untrusted client can
deliver that header; this branch does not claim to fix that risk.

Registration no longer uses forwarded IP for its quotas. The pure
`server/trusted-client-ip.cjs` resolver and tests illustrate a fail-closed
proposal, but are **not connected to live request handling**. It ignores both
forwarded headers unless a caller provides independent verified-proxy evidence;
even then it accepts only a valid single `CF-Connecting-IP` address and never
parses arbitrary `X-Forwarded-For`. `verifiedProxy` is a trust decision that must
be implemented at a verified boundary, not enabled from a request header or
solely because the socket is loopback. A production design must first verify
the topology, spoofing resistance, real IPv4/IPv6 propagation, direct access
paths, and shared-IP behavior. Integrate and test the resolver only after that
verification and separate authorization.

## Firewall and Phase 1

The firewall verifier checks that ActiveStore returns exactly one each of
Domain, Private and Public, with each enabled and default inbound Block. Its
tests mock `Get-NetFirewallProfile`; they do not invoke the hardening script or
change a firewall. Production effective policy and ACLs remain unverified.

Phase 1 (`72b29ef`) is not an ancestor of this branch. Both phases touch
`server/upload-server.js`; integration must preserve Phase 1 worker recovery
and error propagation as well as Phase 2's 429 header handling, followed by
combined regression tests. No merge, rebase, commit or deployment is implied.
