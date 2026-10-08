param([Parameter(Mandatory=$true)][string]$Handle,[Parameter(Mandatory=$true)][string]$Exe,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
# Read-only WM_GETICON / resource inspection. No input, UI Automation, settings
# changes or synthetic taskbar. The taskbar's actual visual is a separate check.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ATLIconRead {
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
}
'@
$root=Split-Path -Parent $PSScriptRoot
$icon=Join-Path $root 'installer\assets\media-tools.ico'
New-Item -ItemType Directory -Force -Path $Output | Out-Null
function Pixels([System.Drawing.Bitmap]$b){
 $bytes=New-Object byte[] ($b.Width*$b.Height*4);$at=0
 for($y=0;$y -lt $b.Height;$y++){for($x=0;$x -lt $b.Width;$x++){$p=$b.GetPixel($x,$y);$bytes[$at++]=$p.A;$bytes[$at++]=$p.R;$bytes[$at++]=$p.G;$bytes[$at++]=$p.B}}
 return ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes))).Replace('-','').ToLowerInvariant()
}
$h=[IntPtr]([Int64]::Parse($Handle));$rows=@()
foreach($size in @(16,32)){
 $type=if($size -eq 32){1}else{0}
 $native=[ATLIconRead]::SendMessage($h,0x007F,[IntPtr]$type,[IntPtr]::Zero)
 if($native -eq [IntPtr]::Zero){throw "Window does not expose WM_GETICON $size"}
 $actual=[Drawing.Icon]::FromHandle($native).ToBitmap()
 $expected=[Drawing.Icon]::new($icon,[Drawing.Size]::new($size,$size)).ToBitmap()
 $actual.Save((Join-Path $Output "window-icon-$size.png"),[Drawing.Imaging.ImageFormat]::Png)
 $expected.Save((Join-Path $Output "expected-icon-$size.png"),[Drawing.Imaging.ImageFormat]::Png)
 $a=Pixels $actual;$e=Pixels $expected
 $rows+=[ordered]@{requested=$size;actualWidth=$actual.Width;actualHeight=$actual.Height;actualPixelSha256=$a;expectedPixelSha256=$e;matches=$a -eq $e}
 if($a -ne $e){throw "Window icon pixels differ at $size"}
 $actual.Dispose();$expected.Dispose()
}
$shell=[Drawing.Icon]::ExtractAssociatedIcon($Exe).ToBitmap();$shell.Save((Join-Path $Output 'shell-exe-icon.png'),[Drawing.Imaging.ImageFormat]::Png);$shell.Dispose()
[ordered]@{status='PASS';exe=$Exe;exeSha256=(Get-FileHash -LiteralPath $Exe -Algorithm SHA256).Hash.ToLowerInvariant();windowIcons=$rows;scope='Actual window WM_GETICON pixels and Windows shell EXE icon; taskbar visual separate'}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $Output 'windows-icon.json') -Encoding UTF8
