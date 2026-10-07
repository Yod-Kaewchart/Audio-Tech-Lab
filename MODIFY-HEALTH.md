# Modify Windows health monitoring

Control Center reads Modify's Windows host over the existing `modify-wsl` SSH alias. The connection terminates in WSL, then runs a fixed read-only Windows PowerShell script. No inbound monitoring port, new credential, firewall rule or remote service is needed.

## Configure the backend

Create ignored `tools/runtime/modify-monitor.json` under the backend root:

```json
{"enabled":true,"sshAlias":"modify-wsl"}
```

The backend account must already have a working, pinned-host SSH configuration for this alias. The script expects the Windows computer identity `MODIFY`. Strict host-key checks remain enabled; password/interactive authentication is disabled. No browser input may choose a host or command. Missing/disabled/invalid configuration reports an unknown state without launching SSH.

Configuration is reread on each request. Setting `enabled` to false disables future checks without restarting. The initial backend code upgrade requires a guarded restart after confirming no audio work/uploads/mutations are active. Existing administrator sessions must sign in again after a backend restart.

## Measurements and interpretation

- Windows version, uptime, CPU load, memory total/free, and each fixed drive's total/free space.
- `online`: verified Modify identity and valid measurements, with no configured threshold exceeded.
- `warning`: CPU at least 95%, memory used at least 90%, disk free below 10% or 5 GiB.
- `offline`: SSH timed out or the connection failed. This does not prove the physical computer is powered off.
- `unknown`: no verified measurements, unavailable configuration/SSH executable, or an unexpected remote identity/response.

CPU is a point-in-time sample. An unavailable CPU sample stays unknown; it is never reported as zero. No temperature, SMART disk condition, Windows service inventory, remote repair or sustained-load diagnosis is claimed.

## API and polling

`GET /api/admin/machines/modify/health?nonce=<fresh challenge>` requires an existing administrator session without a pending password change. The response identifies the machine-health service, carries the request challenge and a backend timestamp, and disables HTTP/CDN caches. Unknown query keys and all mutation methods are rejected.

Only whitelisted measurement fields are returned. SSH addresses, paths, stdout/stderr, credentials and process lists are excluded. One SSH request runs at a time across callers; samples, including failures, are shared for at most 10 seconds. SSH has a 10-second process deadline, bounded output and no automatic interactive prompts. Control Center uses a 14-second deadline for this endpoint and rejects stale/wrong-machine/wrong-challenge measurements. Regular visible-page refresh remains 15 seconds after a check completes.

The Modify card's Health Check opens the Health view. The view includes host measurements and the timestamp of the actual sample. Failed/offline/invalidated checks clear old measurements rather than displaying an old online result. Coverage describes configured targets, not the fraction currently online. Remote repair remains unconfigured. OpenAI configuration badges now distinguish configured/not connected from provider availability.

## Verification

Unit and isolated real-HTTP tests cover telemetry identity/ranges, threshold warnings, pinned SSH arguments, command/host injection rejection, shared caching/single-flight behavior, error sanitization, administrator/ordinary/forced-password-change access, freshness, unavailable-machine rendering and explicit OpenAI connection state.

Production credentials and user files are not used by these automated tests. A separate manual smoke probe uses the already-authorized SSH connection to verify live Modify telemetry under the backend account.

On 7 October 2026, all **146 portable tests passed**, the Pages build and patch checks passed, and an isolated browser/backend verified live Windows 11 telemetry from Modify on desktop and mobile. A synthetic unreachable response cleared old measurements, and the following successful probe restored them. The production backend was reloaded through its guarded idle-maintenance flow; public health then reported `machineHealthApiVersion: 1`, while anonymous access to the machine-health endpoint remained HTTP 401. The existing tunnel and supervisor were retained.
