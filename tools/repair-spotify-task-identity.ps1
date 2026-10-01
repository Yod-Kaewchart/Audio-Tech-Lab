# Run interactively as the Windows user who can decrypt the existing store.
# Change the existing task principal and, when requested, boot to user logon.
# No credentials are rewritten.
param([switch]$AfterLogon)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $PSScriptRoot 'runtime'
$taskName = 'Audio Tech Lab Backend'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Open PowerShell as administrator under MODIFY\Admin.' }
if ($identity.Name -ine 'MODIFY\Admin') { throw 'Run this repair as MODIFY\Admin, the existing DPAPI account.' }
$store = Join-Path $env:LOCALAPPDATA 'AudioTechLab\spotify.clixml'
if (-not (Test-Path -LiteralPath $store)) { throw 'Existing encrypted Spotify store not found. Nothing changed.' }
$storeHash = (Get-FileHash -LiteralPath $store -Algorithm SHA256).Hash
& 'C:\Program Files\nodejs\node.exe' -e "try { if (!require(process.argv[1]).loadSpotifyConfig()) process.exit(2); console.log('Spotify configuration loaded by current Windows user'); } catch { console.error('Spotify configuration could not be loaded'); process.exit(1); }" (Join-Path $root 'server\spotify-config.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Existing credentials cannot be loaded. Nothing changed.' }

$scheduler = New-Object -ComObject 'Schedule.Service'
$scheduler.Connect()
$folder = $scheduler.GetFolder('\')
$task = $folder.GetTask($taskName)
$definition = $task.Definition
if ($definition.Actions.Count -ne 1 -or $definition.Actions.Item(1).Arguments -notlike "*$(Join-Path $root 'tools\start-web-demo.ps1')*") { throw 'Unexpected task action. Nothing changed.' }
if ($definition.Triggers.Count -ne 1 -or $definition.Triggers.Item(1).Type -notin 8,9) { throw 'Unexpected startup triggers. Nothing changed.' }
function Assert-Idle {
    $jobsFile = Join-Path $runtime 'security\processing-jobs.json'
    if (Test-Path -LiteralPath $jobsFile) {
        $jobs = (Get-Content -LiteralPath $jobsFile -Raw | ConvertFrom-Json).jobs
        if (@($jobs | Where-Object { $_.status -in 'queued','running' }).Count) { throw 'Audio jobs are active. Retry after completion. No processes stopped.' }
    }
}
Assert-Idle
$credential = $null
if ($AfterLogon) {
    Write-Host 'Changing the existing Web Demo task to start after MODIFY\Admin logs in, using the existing interactive session.'
    $taskLogonType = 3 # TASK_LOGON_INTERACTIVE_TOKEN: no password is stored.
} else {
    Write-Host 'Changing the existing boot task to MODIFY\Admin using Password logon.'
    Write-Host 'Enter the existing Windows account password (not PIN and not Spotify credentials).'
    Write-Host 'Task Scheduler will store it securely for startup before anyone logs in.'
    $credential = Get-Credential -UserName $identity.Name -Message 'Existing Windows password for unattended Web Demo startup'
    if (-not $credential) { return }
    $credentialSid = (New-Object Security.Principal.NTAccount($credential.UserName)).Translate([Security.Principal.SecurityIdentifier]).Value
    if ($credentialSid -ne $identity.User.Value) { throw 'Credential account must be the current DPAPI user. Nothing changed.' }
    $taskLogonType = 1 # TASK_LOGON_PASSWORD
}
Assert-Idle
$state = Get-Content (Join-Path $runtime 'state.json') -Raw | ConvertFrom-Json
$targets = @()
foreach ($entry in @(
    @{ Pid = $state.supervisorPid; Script = 'tools\web-demo-supervisor.cjs' },
    @{ Pid = $state.services.backend.pid; Script = 'server\upload-server.js' },
    @{ Pid = $state.services.web.pid; Script = 'server\web-server.cjs' }
)) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.Pid)"
    if (-not $process -or $process.Name -ne 'node.exe' -or $process.CommandLine -notlike "*$(Join-Path $root $entry.Script)*") { throw 'Runtime process identity mismatch. Nothing changed.' }
    if ($entry.Pid -ne $state.supervisorPid -and $process.ParentProcessId -ne $state.supervisorPid) { throw 'Unexpected process parent. Nothing changed.' }
    $targets += $process
}
$backup = Join-Path $runtime ('spotify-task-before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.xml')
$task.Xml | Set-Content -LiteralPath $backup -Encoding Unicode
$definition.Principal.UserId = $identity.Name
$definition.Principal.LogonType = $taskLogonType
if ($AfterLogon) {
    $definition.Triggers.Clear()
    $logonTrigger = $definition.Triggers.Create(9) # TASK_TRIGGER_LOGON
    $logonTrigger.UserId = $identity.Name
    $logonTrigger.Enabled = $true
} elseif ($definition.Triggers.Item(1).Type -ne 8) {
    throw 'Password mode expects the original boot trigger. Nothing changed.'
}
$expectedXml = [xml]$definition.XmlText
try {
    # TASK_UPDATE: preserve action/settings; change boot to user logon only when requested.
    if ($AfterLogon) { $null = $folder.RegisterTaskDefinition($taskName, $definition, 4, $identity.Name, $null, $taskLogonType, $null) }
    else { $null = $folder.RegisterTaskDefinition($taskName, $definition, 4, $identity.Name, $credential.GetNetworkCredential().Password, $taskLogonType, $null) }
} catch { throw 'Task account update failed. Check the Windows password/account policy. Existing processes were not stopped.' }
finally { $credential = $null }
$updated = $folder.GetTask($taskName)
$afterXml = [xml]$updated.Definition.XmlText
$updatedSid = (New-Object Security.Principal.NTAccount($updated.Definition.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value
if ($updatedSid -ne $identity.User.Value -or $updated.Definition.Principal.LogonType -ne $taskLogonType) { throw 'Task principal verification failed. Existing processes were not stopped.' }
foreach ($part in @('Actions','Triggers','Settings')) {
    if ($expectedXml.Task.$part.OuterXml -ne $afterXml.Task.$part.OuterXml) { throw "Task $part unexpectedly changed. Existing processes were not stopped; inspect the saved task XML." }
}
# Changing a principal cannot change the identity of already running processes.
# Stop the task and only its verified supervisor/backend/web children; leave Cloudflared alone.
$updated.Stop(0)
foreach ($process in $targets) {
    $live = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ProcessId)"
    if ($live -and $live.CreationDate -eq $process.CreationDate) { Stop-Process -Id $live.ProcessId -Force }
}
$null = $folder.GetTask($taskName).Run($null)
for ($attempt = 0; $attempt -lt 45; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $next = Get-Content (Join-Path $runtime 'state.json') -Raw | ConvertFrom-Json
        if ($next.supervisorPid -eq $state.supervisorPid) { continue }
        foreach ($procId in @($next.supervisorPid, $next.services.backend.pid, $next.services.web.pid)) {
            $process = Get-CimInstance Win32_Process -Filter "ProcessId=$procId"
            if (-not $process) { throw 'Waiting for process' }
            $owner = Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid
            if ($owner.ReturnValue -ne 0 -or $owner.Sid -ne $identity.User.Value) { throw 'Waiting for target identity' }
        }
        $health = Invoke-RestMethod 'http://127.0.0.1:8787/health' -TimeoutSec 2
        $web = Invoke-WebRequest 'http://127.0.0.1:8080/demo/' -UseBasicParsing -TimeoutSec 2
        if (-not $health.ok -or $web.StatusCode -ne 200) { continue }
        if ((Get-FileHash -LiteralPath $store -Algorithm SHA256).Hash -ne $storeHash) { throw 'Credential store unexpectedly changed' }
        Write-Host 'Repair complete: supervisor/backend/web run as MODIFY\Admin; local health and demo are HTTP 200.'
        Write-Host 'Task action/settings and encrypted Spotify file are unchanged. Cloudflared was not restarted.'
        if ($AfterLogon) { Write-Host 'Automatic startup is now after MODIFY\Admin signs in, not before sign-in.' }
        else { Write-Host 'The existing boot trigger is unchanged.' }
        Write-Host 'Sign in to Web Demo again, then Connect Spotify.'
        return
    } catch {}
}
throw 'Task was updated but runtime verification timed out. Inspect Task Scheduler LastTaskResult and startup.log; do not rerun Spotify setup.'
