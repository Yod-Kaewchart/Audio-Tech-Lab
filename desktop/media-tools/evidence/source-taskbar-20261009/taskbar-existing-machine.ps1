param([ValidateSet('Install','Cleanup')][string]$Stage)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$target=Join-Path $env:LOCALAPPDATA 'Programs\Audio Tech Labs Media Tools'
$registry='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AudioTechLabs.MediaTools_is1'
$startShortcut=Join-Path ([Environment]::GetFolderPath('Programs')) 'Audio Tech Labs Media Tools.lnk'
$desktopShortcut=Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Audio Tech Labs Media Tools.lnk'
$profile=Join-Path $env:APPDATA 'Audio Tech Labs Media Tools'
$testDir=Join-Path $root 'test-output\source-taskbar-round2'
$receipt=Join-Path $testDir 'installation-ownership.json'
function Snapshot {
 if(-not(Test-Path -LiteralPath $profile)){return @()}
 @(Get-ChildItem -LiteralPath $profile -File -Recurse -Force | ForEach-Object {
  [pscustomobject]@{file=$_.FullName.Substring($profile.Length);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
 } | Sort-Object file)
}
function DesktopHash {
 if(Test-Path -LiteralPath $desktopShortcut){return (Get-FileHash -LiteralPath $desktopShortcut -Algorithm SHA256).Hash}
 return $null
}
if($Stage -eq 'Install') {
 foreach($p in @($target,$registry,$startShortcut,$receipt)){if(Test-Path -LiteralPath $p){throw "Refusing to overwrite existing state: $p"}}
 if(Get-Process -Name 'Audio Tech Labs Media Tools' -ErrorAction SilentlyContinue){throw 'Existing app running'}
 New-Item -ItemType Directory -Path $testDir -Force | Out-Null
 $baseline=@(Snapshot);$desktopBefore=DesktopHash
 $candidate=Get-Content -Raw -LiteralPath (Join-Path $root 'release\installers\installer-candidate.json') | ConvertFrom-Json
 if($candidate.version -ne '0.2.2-beta.2' -or $candidate.sha256 -ne '11549c34e61f94dab4170e781db2176fbd2def6add9de849a2ea8fc0bc901c27'){throw 'Wrong candidate'}
 if((Get-FileHash -LiteralPath $candidate.file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $candidate.sha256){throw 'Setup hash mismatch'}
 # Normal AppId/default install path. No Desktop task: retain the user's legacy shortcut byte-for-byte.
 $p=Start-Process -FilePath $candidate.file -ArgumentList @('/CURRENTUSER','/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/TASKS=',('/LOG="'+(Join-Path $PSScriptRoot 'normal-install.log')+'"')) -WindowStyle Hidden -PassThru -Wait
 if($p.ExitCode -ne 0){throw "Install exit $($p.ExitCode)"}
 [ordered]@{target=$target;registry=$registry;startShortcut=$startShortcut;desktopBefore=$desktopBefore;profileBefore=$baseline;setupSha256=$candidate.sha256;createdByThisTest=$true} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $receipt -Encoding utf8
 $exe=Join-Path $target 'Audio Tech Labs Media Tools.exe'
 if((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne '94b0deb9e81e26c2aec82551c811811de415214666ec1622d9e326946ed8a05d'){throw 'Installed EXE hash mismatch'}
 $shell=New-Object -ComObject WScript.Shell;$s=$shell.CreateShortcut($startShortcut)
 [ordered]@{scope='existing-machine normal installed app only';setupSha256=$candidate.sha256;exe=$exe;exeSha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant();version=(Get-Item -LiteralPath $exe).VersionInfo.ProductVersion;fileVersion=(Get-Item -LiteralPath $exe).VersionInfo.FileVersion;shortcutPath=$startShortcut;shortcutTarget=$s.TargetPath;shortcutArguments=$s.Arguments;launchMethod='EXE directly with isolated --user-data-dir; shortcut metadata observed only';desktopPreserved=((DesktopHash) -eq $desktopBefore);profileUnchanged=(($baseline|ConvertTo-Json -Depth 5 -Compress) -eq (@(Snapshot)|ConvertTo-Json -Depth 5 -Compress))} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'normal-installed-identity.json') -Encoding utf8
} else {
 $owned=Get-Content -Raw -LiteralPath $receipt | ConvertFrom-Json
 if(-not $owned.createdByThisTest -or $owned.target -ne $target -or $owned.registry -ne $registry -or $owned.startShortcut -ne $startShortcut){throw 'Ownership mismatch'}
 if(Get-Process -Name 'Audio Tech Labs Media Tools' -ErrorAction SilentlyContinue){throw 'App still running; close only test-owned instances first'}
 $exe=Join-Path $target 'Audio Tech Labs Media Tools.exe'
 if((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne '94b0deb9e81e26c2aec82551c811811de415214666ec1622d9e326946ed8a05d'){throw 'Installed EXE changed; refusing cleanup'}
 $p=Start-Process -FilePath (Join-Path $target 'unins000.exe') -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/LOG="'+(Join-Path $PSScriptRoot 'normal-uninstall.log')+'"')) -WindowStyle Hidden -PassThru -Wait
 if($p.ExitCode -ne 0){throw "Uninstall exit $($p.ExitCode)"}
 foreach($p in @($target,$registry,$startShortcut)){if(Test-Path -LiteralPath $p){throw "Test installation residue: $p"}}
 $result=[ordered]@{status='PASS';scope='cleanup after normal installed taskbar follow-up on existing machine';desktopPreserved=((DesktopHash) -eq $owned.desktopBefore);profileFiles=@($owned.profileBefore).Count;profileUnchanged=((@($owned.profileBefore)|ConvertTo-Json -Depth 5 -Compress) -eq (@(Snapshot)|ConvertTo-Json -Depth 5 -Compress));normalInstallationRemoved=$true;setupSha256=$owned.setupSha256}
 if(-not $result.desktopPreserved -or -not $result.profileUnchanged){throw 'User-state preservation failed'}
 $result|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'normal-cleanup.json') -Encoding utf8
 $result|ConvertTo-Json -Depth 6
}
