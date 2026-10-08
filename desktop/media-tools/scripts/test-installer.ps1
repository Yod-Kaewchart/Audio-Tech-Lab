param([string]$Installer)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$manifestPath=Join-Path $root 'release\installers\installer-qa.json'
if(-not $Installer) { $Installer=(Get-Content $manifestPath -Raw |ConvertFrom-Json).file }
if(-not (Test-Path -LiteralPath $Installer)) {throw 'Installer QA binary not found'}
$target=Join-Path $env:LOCALAPPDATA 'Programs\Audio Tech Labs Media Tools Installer QA'
$name='Audio Tech Labs Media Tools (Installer QA)'
$shortcutDesktop=Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) ($name+'.lnk')
$shortcutStart=Join-Path ([Environment]::GetFolderPath('Programs')) ($name+'.lnk')
$uninstaller=Join-Path $target 'unins000.exe'
$testHome=Join-Path $root ('test-output\installer-test-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $testHome -Force|Out-Null
$registry='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AudioTechLabs.MediaTools.InternalQA_is1'
$profile=Join-Path $env:APPDATA 'Audio Tech Labs Media Tools\local-media'
function Snapshot {
 if(-not (Test-Path -LiteralPath $profile)){return @()}
 $items=@(Get-ChildItem -LiteralPath $profile -File -Recurse -ErrorAction Stop|ForEach-Object {
    [pscustomobject]@{name=$_.FullName.Substring($profile.Length);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
 })
 return @($items | Sort-Object name)
}
if((Test-Path -LiteralPath $target) -or (Test-Path -LiteralPath $registry) -or (Test-Path -LiteralPath $shortcutDesktop) -or (Test-Path -LiteralPath $shortcutStart)){
 throw 'QA test app already exists. Refusing to overwrite an existing installation.'
}
$before=@(Snapshot)
$checks=New-Object System.Collections.Generic.List[string]
$installRan=$false
try {
 $p=Start-Process -FilePath $Installer -ArgumentList @('/CURRENTUSER','/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/TASKS=desktopicon',('/LOG="'+(Join-Path $testHome 'install.log')+'"')) -PassThru -Wait
 if($p.ExitCode -ne 0){throw "Installer exit code $($p.ExitCode)"}
 $installRan=$true
 if(-not(Test-Path -LiteralPath $uninstaller)){throw 'Uninstaller absent'}
 if(-not(Test-Path -LiteralPath $registry)){throw 'Uninstall entry missing'}
 foreach($path in @($shortcutDesktop,$shortcutStart)){
  if(-not(Test-Path -LiteralPath $path)){throw "Shortcut missing: $path"}
  $shell=New-Object -ComObject WScript.Shell;$targetPath=$shell.CreateShortcut($path).TargetPath
  if($targetPath -ne (Join-Path $target 'Audio Tech Labs Media Tools.exe')){throw "Shortcut target mismatch: $path => $targetPath"}
 }
 $checks.Add('Per-user install, uninstall registration, Start Menu and Desktop shortcuts')
 $record=Get-Content (Join-Path $root 'release\latest.json') -Raw|ConvertFrom-Json
 foreach($rel in @('Audio Tech Labs Media Tools.exe','resources\app\src\engine.cjs','resources\app\ui\view.js','resources\vendor\ffmpeg.exe','resources\vendor\ffprobe.exe','resources\vendor\yt-dlp.exe','resources\vendor\ProcessHost.exe')){
  $a=Join-Path $record.directory $rel;$b=Join-Path $target $rel
  if(-not(Test-Path -LiteralPath $b)){throw "Installed payload missing: $rel"}
  if((Get-FileHash -LiteralPath $a -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $b -Algorithm SHA256).Hash){throw "Payload hash mismatch: $rel"}
 }
 $checks.Add('Installed EXE, engine, UI, and native media helpers match portable SHA256')
} finally {
 if(Test-Path -LiteralPath $uninstaller){
   $u=Start-Process -FilePath $uninstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/LOG="'+(Join-Path $testHome 'uninstall.log')+'"')) -PassThru -Wait
   if($u.ExitCode -ne 0){throw "Uninstall failed: $($u.ExitCode)"}
 }
}
if((Test-Path -LiteralPath $target) -or (Test-Path -LiteralPath $registry) -or (Test-Path -LiteralPath $shortcutDesktop) -or (Test-Path -LiteralPath $shortcutStart)){
 throw 'Uninstall left QA application, registry or shortcuts behind'
}
$checks.Add('Uninstall removed QA application, registry and both shortcuts')
$after=@(Snapshot)
if(($before|ConvertTo-Json -Depth 5 -Compress) -ne ($after|ConvertTo-Json -Depth 5 -Compress)){
 throw 'Production app profile changed during install/uninstall test'
}
$checks.Add('Actual Audio Tech Labs Media Tools profile remained byte-for-byte unchanged')
$result=[ordered]@{passed=$true;installer=$Installer;qaAppId='AudioTechLabs.MediaTools.InternalQA';checks=@($checks);profileFiles=$before.Count;loggedAt=(Get-Date).ToString('o')}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $testHome 'result.json') -Encoding UTF8
Write-Output ($result|ConvertTo-Json -Depth 5)
