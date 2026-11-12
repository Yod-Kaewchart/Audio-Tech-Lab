param(
    [Parameter(Mandatory = $true)][int]$WorkerPid,
    [Parameter(Mandatory = $true)][string]$ExpectedPython,
    [Parameter(Mandatory = $true)][string]$ExpectedToken
)
$ErrorActionPreference = 'Stop'
if ($WorkerPid -le 0 -or $ExpectedToken -notmatch '^[0-9a-f-]{36}$') { exit 11 }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AtlProcessHandle {
    [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError=true)] public static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError=true)] public static extern bool CloseHandle(IntPtr handle);
}
'@

$handles = New-Object 'System.Collections.Generic.List[System.IntPtr]'
try {
    $snapshot = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    $root = $snapshot | Where-Object { [int]$_.ProcessId -eq $WorkerPid } | Select-Object -First 1
    if (-not $root) {
        $orphanIds = New-Object 'System.Collections.Generic.List[int]'
        $orphanSeen = New-Object 'System.Collections.Generic.HashSet[int]'
        [void]$orphanSeen.Add($WorkerPid)
        $orphanIds.Add($WorkerPid)
        for ($i = 0; $i -lt $orphanIds.Count; $i++) {
            foreach ($candidate in $snapshot) {
                $candidateId = [int]$candidate.ProcessId
                if ([int]$candidate.ParentProcessId -eq $orphanIds[$i] -and $orphanSeen.Add($candidateId)) { $orphanIds.Add($candidateId) }
            }
        }
        if ($orphanIds.Count -gt 1) { exit 11 }
        exit 10
    }
    if (-not $root.ExecutablePath -or $root.ExecutablePath -ine $ExpectedPython -or
        -not $root.CommandLine -or -not $root.CommandLine.Contains("atl_worker=$ExpectedToken")) { exit 11 }

    # Snapshot the full descendant tree before invoking taskkill. Retain a
    # process handle for every still-existing PID so PID reuse cannot create
    # a false "terminated" result while cleanup is being verified.
    $ids = New-Object 'System.Collections.Generic.List[int]'
    $seen = New-Object 'System.Collections.Generic.HashSet[int]'
    [void]$seen.Add($WorkerPid)
    $ids.Add($WorkerPid)
    for ($i = 0; $i -lt $ids.Count; $i++) {
        $parentId = $ids[$i]
        foreach ($candidate in $snapshot) {
            $candidateId = [int]$candidate.ProcessId
            if ([int]$candidate.ParentProcessId -eq $parentId -and $seen.Add($candidateId)) {
                $ids.Add($candidateId)
            }
        }
    }

    foreach ($id in $ids) {
        $expected = $snapshot | Where-Object { [int]$_.ProcessId -eq $id } | Select-Object -First 1
        $live = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction Stop
        if (-not $live) { continue }
        if ($live.CreationDate -ne $expected.CreationDate) { exit 11 }
        $handle = [AtlProcessHandle]::OpenProcess(0x101000, $false, $id)
        if ($handle -eq [IntPtr]::Zero) {
            $stillPresent = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction Stop
            if ($stillPresent) { exit 11 }
            continue
        }
        $handles.Add($handle)
    }

    if ($handles.Count -eq 0) { exit 10 }
    & "$env:SystemRoot\System32\taskkill.exe" /PID $WorkerPid /T /F 2>$null | Out-Null
    $killExit = $LASTEXITCODE

    $alive = $false
    foreach ($handle in $handles) {
        $wait = [AtlProcessHandle]::WaitForSingleObject($handle, 0)
        if ($wait -eq 258) { $alive = $true }
        elseif ($wait -ne 0) { exit 11 }
    }
    if ($alive) { exit 12 }
    if ($killExit -ne 0) { exit 10 }
    exit 0
} finally {
    foreach ($handle in $handles) { [void][AtlProcessHandle]::CloseHandle($handle) }
}