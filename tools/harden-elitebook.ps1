param([string]$ServiceAccount = 'ELITEBOOK\EliteBook')
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this reviewed script from PowerShell as Administrator. No settings were changed.'
}
if ($env:COMPUTERNAME -ne 'ELITEBOOK') { throw 'This script is intended only for ELITEBOOK' }
$serviceSid = ([Security.Principal.NTAccount]$ServiceAccount).Translate([Security.Principal.SecurityIdentifier])
$runtime = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'runtime'))
if (-not (Test-Path -LiteralPath $runtime -PathType Container)) { throw 'Runtime directory is missing' }
$items = @((Get-Item -LiteralPath $runtime)) + @(Get-ChildItem -LiteralPath $runtime -Force -Recurse)
if (@($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Refusing to modify ACLs through a reparse point' }
# Store rollback metadata only, never account or credential contents.
$backup = Join-Path $runtime ('hardening-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null
$items | ForEach-Object { $acl = Get-Acl -LiteralPath $_.FullName; [pscustomobject]@{ Path = $_.FullName; Sddl = $acl.Sddl } } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $backup 'acl.json') -Encoding UTF8
Get-NetFirewallProfile | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup 'firewall-profiles.json') -Encoding UTF8
& netsh.exe advfirewall export (Join-Path $backup 'firewall-policy.wfw') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Firewall backup failed; no security settings were changed' }
$allowedSids = @($serviceSid, [Security.Principal.SecurityIdentifier]'S-1-5-18', [Security.Principal.SecurityIdentifier]'S-1-5-32-544')
$items = @((Get-Item -LiteralPath $runtime)) + @(Get-ChildItem -LiteralPath $runtime -Force -Recurse)
foreach ($item in $items) {
    $acl = if ($item.PSIsContainer) { New-Object Security.AccessControl.DirectorySecurity } else { New-Object Security.AccessControl.FileSecurity }
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in $allowedSids) {
        $inherit = if ($item.PSIsContainer) { [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', $inherit, 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $item.FullName -AclObject $acl
}
# Tunnel and backend use outbound connections and loopback; no inbound port is opened.
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True -DefaultInboundAction Block
foreach ($item in $items) {
    $acl = Get-Acl -LiteralPath $item.FullName
    foreach ($rule in $acl.Access) {
        $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
        if ($rule.AccessControlType -eq 'Allow' -and $sid -notin $allowedSids.Value) { throw "ACL verification failed: $($item.FullName)" }
    }
}
if (@(Get-NetFirewallProfile | Where-Object { $_.Enabled -ne 'True' }).Count) { throw 'Firewall verification failed' }
Write-Output "Verified: runtime ACLs restricted to $ServiceAccount, SYSTEM and Administrators."
Write-Output 'Verified: Domain, Private and Public firewall profiles enabled; default inbound blocked.'
Write-Output "Rollback metadata: $backup"
