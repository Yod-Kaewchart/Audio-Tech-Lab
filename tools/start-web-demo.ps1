param([switch]$Restart)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root 'tools\runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$deploymentFile = Join-Path $runtime 'deployment.json'
if (Test-Path -LiteralPath $deploymentFile) {
    $deployment = Get-Content -LiteralPath $deploymentFile -Raw | ConvertFrom-Json
    $env:ATL_DEMO_ORIGIN = $deployment.demoOrigin
    $env:ATL_MAIN_ORIGIN = $deployment.mainOrigin
    $env:ATL_INSTANCE_ID = $deployment.instanceId
    $env:ATL_EXTERNAL_TUNNEL = if ($deployment.tunnelMode -eq 'external') { '1' } else { '' }
    $env:ATL_TUNNEL_CONFIG = $deployment.tunnelConfig
    if ($deployment.audioPython) {
        if (-not (Test-Path -LiteralPath $deployment.audioPython -PathType Leaf)) { throw 'Configured audioPython does not exist' }
        $env:ATL_AUDIO_PYTHON = $deployment.audioPython
    }
    if ($deployment.splitterRoot) {
        if (-not (Test-Path -LiteralPath $deployment.splitterRoot -PathType Container)) { throw 'Configured splitterRoot does not exist' }
        $env:ATL_SPLITTER_ROOT = $deployment.splitterRoot
    }
}
& 'C:\Program Files\nodejs\node.exe' -e "require(process.argv[1]).deploymentMode()" (Join-Path $root 'tools\deployment-config.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Invalid deployment configuration; existing services were not stopped' }
if ($env:ATL_EXTERNAL_TUNNEL -eq '1' -and (Get-Service Cloudflared -ErrorAction Stop).Status -ne 'Running') {
    throw 'The existing Cloudflared service must be running before starting the production demo'
}
function Get-DemoProcesses {
    Get-CimInstance Win32_Process | Where-Object {
        ($_.Name -eq 'node.exe' -and ($_.CommandLine -like '*D:\Sites\Audio Tech Labs\server\upload-server.js*' -or $_.CommandLine -like '*D:\Sites\Audio Tech Labs\server\web-server.cjs*' -or $_.CommandLine -like '*D:\Sites\Audio Tech Labs\tools\web-demo-supervisor.cjs*')) -or
        ($_.Name -eq 'python.exe' -and $_.CommandLine -like '*-m http.server 8080*' -and $_.CommandLine -like '*D:\Sites\Audio Tech Labs\dist*') -or
        ($_.Name -eq 'cloudflared.exe' -and $_.CommandLine -match 'tunnel --url http://127\.0\.0\.1:(8080|8787)(\s|$)' -and $_.ExecutablePath -eq 'D:\Sites\Audio Tech Labs\tools\cloudflared.exe')
    }
}
if ($Restart) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Restart requires PowerShell Run as administrator' }
    $jobsFile = Join-Path $runtime 'security\processing-jobs.json'
    $existing = @(Get-DemoProcesses)
    if ($existing.Count -gt 0 -and (Test-Path -LiteralPath $jobsFile)) {
        $jobs = (Get-Content -LiteralPath $jobsFile -Raw | ConvertFrom-Json).jobs
        if (@($jobs | Where-Object { $_.status -in 'queued','running' }).Count -gt 0) { throw 'Audio jobs are active; retry after they finish' }
    }
    $ordered = $existing | Sort-Object @{ Expression = { if ($_.CommandLine -like '*web-demo-supervisor.cjs*') { 0 } else { 1 } } }
    foreach ($process in $ordered) { if (Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue) { Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop } }
}
$mutex = New-Object System.Threading.Mutex($false, 'Global\AudioTechLabWebDemo')
$held = $false
try {
    try { $held = $mutex.WaitOne($(if ($Restart) { 10000 } else { 0 })) } catch [System.Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { exit 0 }
    Add-Content (Join-Path $runtime 'startup.log') "$(Get-Date -Format o) Starting Web Demo"
    $legacy = Get-DemoProcesses
    foreach ($process in $legacy) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
    & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'tools\web-demo-supervisor.cjs')
    if ($LASTEXITCODE -ne 0) { throw "Web Demo supervisor exited with code $LASTEXITCODE" }
} catch {
    Add-Content (Join-Path $runtime 'startup.log') "$(Get-Date -Format o) ERROR: $($_.Exception.Message)"
    exit 1
} finally {
    if ($held) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
