'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const powershell = String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const script = path.join(__dirname, 'firewall-verification.ps1').replace(/'/g, "''");
for (const [name, mutation, expected] of [
  ['all profiles enabled and blocked', '', 0],
  ['disabled profile', "$profiles[1].Enabled = 'False'", 1],
  ['inbound allow', "$profiles[2].DefaultInboundAction = 'Allow'", 1],
  ['missing profile', '$profiles = @($profiles[0], $profiles[1])', 1],
  ['duplicate profile', '$profiles = @($profiles[0], $profiles[1], $profiles[1], $profiles[2])', 1]
]) test('firewall verification: ' + name, { skip: process.platform !== 'win32' }, () => {
  const source = `. '${script}'\n$profiles = @(@{Name='Domain';Enabled='True';DefaultInboundAction='Block'},@{Name='Private';Enabled='True';DefaultInboundAction='Block'},@{Name='Public';Enabled='True';DefaultInboundAction='Block'})\n${mutation}\nfunction Get-NetFirewallProfile { param($PolicyStore, $ErrorAction) if ($PolicyStore -ne 'ActiveStore') { throw 'Wrong policy store' }; $profiles }\ntry { Confirm-AtlFirewallProfiles; exit 0 } catch { exit 1 }`;
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(result.status, expected, result.stderr);
});
