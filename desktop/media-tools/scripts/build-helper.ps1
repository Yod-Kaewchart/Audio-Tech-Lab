$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
New-Item -ItemType Directory -Force (Join-Path $project 'vendor') | Out-Null
& $compiler /nologo /optimize+ /platform:x64 /target:exe ("/out:"+(Join-Path $project 'vendor/ProcessHost.exe')) (Join-Path $project 'native/ProcessHost.cs')
if($LASTEXITCODE -ne 0){throw 'ProcessHost compilation failed'}
& node (Join-Path $PSScriptRoot 'record-helper.cjs')
if($LASTEXITCODE -ne 0){throw 'ProcessHost manifest failed'}
