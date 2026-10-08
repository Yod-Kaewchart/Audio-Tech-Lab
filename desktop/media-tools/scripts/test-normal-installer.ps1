param([switch]$Theme)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$candidate=Get-Content -LiteralPath (Join-Path $root 'release\installers\installer-candidate.json') -Raw|ConvertFrom-Json
$portable=Get-Content -LiteralPath (Join-Path $root 'release\latest.json') -Raw|ConvertFrom-Json
$Installer=$candidate.file
if($candidate.kind -ne 'internal-candidate' -or $candidate.signed -or $candidate.publicRelease){throw 'Expected unsigned normal candidate'}
if((Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $candidate.sha256){throw 'Candidate hash mismatch'}
if($candidate.portableSha256 -ne $portable.sha256){throw 'Portable/candidate receipt mismatch'}
$target=Join-Path $env:LOCALAPPDATA 'Programs\Audio Tech Labs Media Tools'
$registry='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AudioTechLabs.MediaTools_is1'
$registryMachine='HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AudioTechLabs.MediaTools_is1'
$name='Audio Tech Labs Media Tools'
$shortcuts=@((Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) ($name+'.lnk')),(Join-Path ([Environment]::GetFolderPath('Programs')) ($name+'.lnk')))
$uninstaller=Join-Path $target 'unins000.exe'
# Never replace an installation or shortcuts owned by the user. This harness uses
# the normal AppId, but it is deliberately labelled existing-machine QA.
foreach($p in @($target,$registry,$registryMachine)+$shortcuts){if(Test-Path -LiteralPath $p){throw "Existing normal installation/shortcut found; refusing overwrite: $p"}}
if(Get-Process -Name 'Audio Tech Labs Media Tools' -ErrorAction SilentlyContinue){throw 'App is running; refusing installer QA'}
$testHome=Join-Path $root ('test-output\normal-installer-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $testHome | Out-Null
$profile=Join-Path $env:APPDATA 'Audio Tech Labs Media Tools'
function Snapshot {
 if(-not(Test-Path -LiteralPath $profile)){return @()}
 return @(Get-ChildItem -LiteralPath $profile -File -Recurse -Force|ForEach-Object{[pscustomobject]@{file=$_.FullName.Substring($profile.Length);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}}|Sort-Object file)
}
$before=@(Snapshot);$before|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $testHome 'profile-before.json') -Encoding UTF8
# Only our own fixture is created, outside the install/profile folders.
$audio=Join-Path $testHome 'preserved-existing-audio.wav'
node -e "require('./test/fixtures.cjs').wave(process.argv[1],2)" $audio
if($LASTEXITCODE -ne 0){throw 'Audio fixture failed'}
$audioHash=(Get-FileHash -LiteralPath $audio -Algorithm SHA256).Hash
$checks=New-Object System.Collections.Generic.List[object]
function Preserve([string]$stage){
 $after=@(Snapshot)
 if(($before|ConvertTo-Json -Depth 5 -Compress) -ne ($after|ConvertTo-Json -Depth 5 -Compress)){throw "Actual user profile changed: $stage"}
 if((Get-FileHash -LiteralPath $audio -Algorithm SHA256).Hash -ne $audioHash){throw "External audio changed: $stage"}
 $checks.Add([ordered]@{stage=$stage;profileFiles=$before.Count;profileUnchanged=$true;externalAudioSha256=$audioHash})
}
function Install([string]$file,[string]$stage){
 $p=Start-Process -FilePath $file -ArgumentList @('/CURRENTUSER','/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/TASKS=desktopicon',('/LOG="'+(Join-Path $testHome ($stage+'.log'))+'"')) -WindowStyle Hidden -PassThru -Wait
 if($p.ExitCode -ne 0){throw "Install failed: $stage exit=$($p.ExitCode)"}
 if(-not(Test-Path -LiteralPath $uninstaller) -or -not(Test-Path -LiteralPath $registry)){throw "Missing uninstall registration: $stage"}
}
function Verify([string]$stage){
 $entry=Get-ItemProperty -LiteralPath $registry
 if($entry.DisplayName -ne $name -or $entry.DisplayVersion -ne $candidate.version -or $entry.DisplayIcon -ne (Join-Path $target 'app-icon.ico')){throw 'Uninstall name/version/icon mismatch'}
 foreach($p in $shortcuts){
  $shell=New-Object -ComObject WScript.Shell;$s=$shell.CreateShortcut($p)
  if($s.TargetPath -ne (Join-Path $target ($name+'.exe')) -or $s.IconLocation -ne ((Join-Path $target 'app-icon.ico')+',0')){throw "Shortcut target/icon mismatch: $p"}
  $sh=New-Object -ComObject Shell.Application;$folder=$sh.Namespace([IO.Path]::GetDirectoryName($p));$item=$folder.ParseName([IO.Path]::GetFileName($p))
  if($item.ExtendedProperty('System.AppUserModel.ID') -ne 'AudioTechLabs.MediaTools'){throw "Shortcut AppUserModelID mismatch: $p"}
 }
 $sums=Get-Content -LiteralPath (Join-Path $portable.directory 'SHA256SUMS.json') -Raw|ConvertFrom-Json
 foreach($row in $sums){$installed=Join-Path $target $row.file;if(-not(Test-Path -LiteralPath $installed) -or (Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha256){throw "Installed payload mismatch: $($row.file)"}}
 $v=(Get-Item -LiteralPath (Join-Path $target ($name+'.exe'))).VersionInfo
 if($v.ProductName -ne $name -or $v.FileVersion -ne '0.2.2.1' -or $v.ProductVersion -ne $candidate.version){throw 'Installed EXE branding mismatch'}
 $checks.Add([ordered]@{stage=$stage;passed=$true;payloadFiles=$sums.Count;appId='AudioTechLabs.MediaTools';productName=$v.ProductName;fileVersion=$v.FileVersion;shortcutIcons=$true;shortcutAppUserModelId=$true;uninstallIcon=$entry.DisplayIcon})
 Preserve $stage
}
function Uninstall([string]$stage){
 $p=Start-Process -FilePath $uninstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/LOG="'+(Join-Path $testHome ($stage+'.log'))+'"')) -WindowStyle Hidden -PassThru -Wait
 if($p.ExitCode -ne 0){throw "Uninstall failed: $stage"}
 foreach($p in @($target,$registry)+$shortcuts){if(Test-Path -LiteralPath $p){throw "Uninstall residue: $p"}}
 Preserve $stage
}
try{
 Install $Installer 'fresh-existing-machine';Verify 'fresh-existing-machine';Uninstall 'uninstall-after-fresh'
 $checkpoint=Get-Content -LiteralPath (Join-Path $root 'evidence\public-beta\checkpoint.json') -Raw|ConvertFrom-Json
 $old=@($checkpoint.artifacts|Where-Object {$_.path -like '*Setup-0.2.1-Win64.exe'})[0]
 if(-not $old -or (Get-FileHash -LiteralPath $old.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $old.sha256){throw 'Old installer checkpoint hash mismatch'}
 Install $old.path 'install-0.2.1-baseline';Preserve 'install-0.2.1-baseline'
 Install $Installer 'upgrade-0.2.1-to-beta';Verify 'upgrade-0.2.1-to-beta';Uninstall 'uninstall-after-upgrade'
 Install $Installer 'reinstall-beta';Verify 'reinstall-beta'
 if($Theme){
  $saved=@{ATL_THEME_EXE=$env:ATL_THEME_EXE;ATL_THEME_KIND=$env:ATL_THEME_KIND;ATL_THEME_OUTPUT=$env:ATL_THEME_OUTPUT}
  try{$env:ATL_THEME_EXE=Join-Path $target ($name+'.exe');$env:ATL_THEME_KIND='normal-installed';$env:ATL_THEME_OUTPUT=Join-Path $root 'evidence\public-beta';node test/theme-acceptance.cjs;if($LASTEXITCODE -ne 0){throw 'Installed native/offline theme acceptance failed'}}
  finally{$env:ATL_THEME_EXE=$saved.ATL_THEME_EXE;$env:ATL_THEME_KIND=$saved.ATL_THEME_KIND;$env:ATL_THEME_OUTPUT=$saved.ATL_THEME_OUTPUT}
  Preserve 'installed-app-isolated-profile'
 }
 Uninstall 'uninstall-after-reinstall'
 $result=[ordered]@{status='PASS';scope='existing-machine QA ONLY';cleanMachineStatus='BLOCKED';installerSha256=$candidate.sha256;portableSha256=$portable.sha256;version=$candidate.version;appId='AudioTechLabs.MediaTools';checks=@($checks);signed=$false;publicRelease=$false;loggedAt=(Get-Date).ToUniversalTime().ToString('o')}
 $result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $testHome 'result.json') -Encoding UTF8
 Copy-Item -LiteralPath (Join-Path $testHome 'result.json') -Destination (Join-Path $root 'evidence\public-beta\normal-installer.json')
 foreach($log in Get-ChildItem -LiteralPath $testHome -Filter '*.log'){Copy-Item -LiteralPath $log.FullName -Destination (Join-Path $root ('evidence\public-beta\normal-'+$log.Name))}
 $result|ConvertTo-Json -Depth 8
}catch{
 [ordered]@{status='FAIL';scope='existing-machine QA ONLY';installerSha256=$candidate.sha256;error=$_.Exception.Message;checks=@($checks);target=$target;logs=$testHome}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $testHome 'failure.json') -Encoding UTF8
 # Leave diagnostic state on failure. Never blindly uninstall a path after a
 # failure or delete user data to make a test pass.
 throw
}
