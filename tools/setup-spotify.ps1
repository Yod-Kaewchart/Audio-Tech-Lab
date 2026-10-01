param([switch]$RestartBackend)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if ($RestartBackend -and -not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as administrator under the same Windows account as the backend, then run this command again.'
}
$directory = Join-Path $env:LOCALAPPDATA 'AudioTechLab'
$file = Join-Path $directory 'spotify.clixml'
Write-Host "Spotify credentials will be encrypted for Windows user $($identity.Name)."
Write-Host 'Redirect URI: https://demo.audiotechlabs.com/api/spotify/callback'
if (Test-Path -LiteralPath $file) {
    if ((Read-Host 'Replace the existing Spotify credential store? Type REPLACE to continue') -cne 'REPLACE') { return }
}
$clientId = (Read-Host 'Spotify Client ID').Trim()
if ($clientId -notmatch '^[a-fA-F0-9]{32}$') { throw 'Client ID must contain 32 hexadecimal characters.' }
$secret = Read-Host 'Spotify Client Secret (hidden)' -AsSecureString
$credential = New-Object System.Management.Automation.PSCredential($clientId, $secret)
if ($credential.GetNetworkCredential().Password -notmatch '^[a-fA-F0-9]{32}$') { throw 'Client Secret must contain 32 hexadecimal characters.' }
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetOwner($identity.User)
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($identity.User, [Security.Principal.SecurityIdentifier]'S-1-5-18')) {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $directory -AclObject $acl
# Export-Clixml encrypts the password with CurrentUser DPAPI on Windows.
$temporary = Join-Path $directory ([guid]::NewGuid().ToString() + '.tmp')
try {
    $credential | Export-Clixml -LiteralPath $temporary
    Move-Item -LiteralPath $temporary -Destination $file -Force
} finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
    $secret.Dispose()
    $credential = $null
}
Write-Host 'Encrypted Spotify credentials saved. No secret was printed.'
if ($RestartBackend) { & (Join-Path $PSScriptRoot 'restart-spotify-backend.ps1') }
