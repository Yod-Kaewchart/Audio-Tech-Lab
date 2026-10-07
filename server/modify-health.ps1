$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$os = Get-CimInstance Win32_OperatingSystem -OperationTimeoutSec 3
$processors = @(Get-CimInstance Win32_Processor -OperationTimeoutSec 3)
$cpu = ($processors | Where-Object { $null -ne $_.LoadPercentage } | Measure-Object LoadPercentage -Average).Average
$disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -OperationTimeoutSec 3 |
    Where-Object { $_.Size -gt 0 } | ForEach-Object {
        [pscustomobject]@{ drive = $_.DeviceID; totalBytes = [double]$_.Size; freeBytes = [double]$_.FreeSpace }
    })
[pscustomobject]@{
    machine = $env:COMPUTERNAME
    os = $os.Caption
    uptimeSeconds = [math]::Floor(((Get-Date) - $os.LastBootUpTime).TotalSeconds)
    totalMemoryBytes = [double]$os.TotalVisibleMemorySize * 1024
    freeMemoryBytes = [double]$os.FreePhysicalMemory * 1024
    cpuPercent = $(if ($null -eq $cpu) { $null } else { [double]$cpu })
    disks = $disks
} | ConvertTo-Json -Depth 4 -Compress
