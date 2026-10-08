$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'installer\assets\media-tools.ico'
$sizes = @(16,32,48,256)
$images = @()
foreach ($s in $sizes) {
  $bitmap = New-Object System.Drawing.Bitmap($s,$s)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::FromArgb(17,21,24))
    $gold = [System.Drawing.Color]::FromArgb(215,179,115)
    $pen = New-Object System.Drawing.Pen($gold,[Math]::Max(1.25, $s / 18))
    try {
      $pen.StartCap=[System.Drawing.Drawing2D.LineCap]::Round
      $pen.EndCap=[System.Drawing.Drawing2D.LineCap]::Round
      $pen.LineJoin=[System.Drawing.Drawing2D.LineJoin]::Round
      $xy = @(0.11,0.34,0.44,0.56,0.66,0.78,0.89)
      $yy = @(0.52,0.52,0.29,0.73,0.46,0.52,0.52)
      $points = [System.Drawing.PointF[]]::new(7)
      for ($i=0;$i -lt 7;$i++) {$points[$i]=[System.Drawing.PointF]::new([float]($s*$xy[$i]),[float]($s*$yy[$i]))}
      $graphics.DrawLines($pen,$points)
    } finally { $pen.Dispose() }
    $mem = New-Object System.IO.MemoryStream
    try {$bitmap.Save($mem,[System.Drawing.Imaging.ImageFormat]::Png);$images += ,([byte[]]$mem.ToArray())} finally {$mem.Dispose()}
  } finally {$graphics.Dispose();$bitmap.Dispose()}
}
$file = [System.IO.File]::Create($out)
$writer = New-Object System.IO.BinaryWriter($file)
try {
  $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$sizes.Count)
  $offset=6+16*$sizes.Count
  for($i=0;$i -lt $sizes.Count;$i++){
    $writer.Write([byte]($sizes[$i] % 256));$writer.Write([byte]($sizes[$i] % 256))
    $writer.Write([byte]0);$writer.Write([byte]0)
    $writer.Write([uint16]1);$writer.Write([uint16]32)
    $writer.Write([uint32]$images[$i].Length);$writer.Write([uint32]$offset)
    $offset+=$images[$i].Length
  }
  foreach($im in $images){$writer.Write([byte[]]$im)}
} finally {$writer.Dispose()}
Write-Output ("CREATED_ICON="+$out+" BYTES="+(Get-Item $out).Length)
