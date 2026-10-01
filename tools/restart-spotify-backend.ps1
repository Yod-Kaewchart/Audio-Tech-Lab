$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Open PowerShell as administrator.' }
# Validate configuration without ever printing credentials before stopping anything.
& 'C:\Program Files\nodejs\node.exe' -e "try { if (!require(process.argv[1]).loadSpotifyConfig()) process.exit(2); console.log('Spotify configuration loaded'); } catch { console.error('Spotify configuration could not be loaded'); process.exit(1); }" (Join-Path $root 'server\spotify-config.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Configure Spotify first. Existing services were not stopped.' }
$runtime = Join-Path $root 'tools\runtime'
$state = Get-Content (Join-Path $runtime 'state.json') -Raw | ConvertFrom-Json
$supervisor = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.supervisorPid)"
$backend = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.services.backend.pid)"
if (-not $supervisor -or $supervisor.Name -ne 'node.exe' -or $supervisor.CommandLine -notlike "*$(Join-Path $root 'tools\web-demo-supervisor.cjs')*") { throw 'Expected supervisor is not running. No processes stopped.' }
if (-not $backend -or $backend.Name -ne 'node.exe' -or $backend.ParentProcessId -ne $supervisor.ProcessId -or $backend.CommandLine -notlike "*$(Join-Path $root 'server\upload-server.js')*") { throw 'Backend identity mismatch. No processes stopped.' }
foreach ($process in @($supervisor, $backend)) {
    $owner = Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid
    if ($owner.ReturnValue -ne 0) { throw "Cannot read Windows owner SID for process $($process.ProcessId) (WMI result $($owner.ReturnValue)). No processes stopped." }
    if ($owner.Sid -ne $identity.User.Value) { throw "Runtime owner SID $($owner.Sid) differs from credential user $($identity.Name) ($($identity.User.Value)). Run repair-spotify-task-identity.ps1 to correct the existing boot task. No processes stopped." }
}
$jobsFile = Join-Path $runtime 'security\processing-jobs.json'
if (Test-Path -LiteralPath $jobsFile) {
    $jobs = (Get-Content -LiteralPath $jobsFile -Raw | ConvertFrom-Json).jobs
    if (@($jobs | Where-Object { $_.status -in 'queued','running' }).Count) { throw 'Audio jobs are active. Retry after they finish; credentials are saved.' }
}
Stop-Process -Id $backend.ProcessId -Force
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    $next = Get-Content (Join-Path $runtime 'state.json') -Raw | ConvertFrom-Json
    if ($next.services.backend.pid -and $next.services.backend.pid -ne $backend.ProcessId) {
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:8787/health' -TimeoutSec 2
            if ($health.ok -and $health.service -eq 'audio-tech-labs-demo') {
                Write-Host 'Backend restarted and healthy. Sign in to Web Demo again, then Connect Spotify.'
                return
            }
        } catch {}
    }
}
throw 'Backend restart health check timed out. Check supervisor status.'
