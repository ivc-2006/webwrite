Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot "..\icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
foreach ($size in 16, 48, 128) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
  $margin = [math]::Max(2, [int]($size * 0.15))
  $penWidth = [math]::Max(1, $size / 8)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $penWidth
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, $margin, $size - $margin, $size - $margin, $margin)
  $y2 = $margin + ($size / 4)
  $g.DrawLine($pen, $margin, $y2, $size - $margin, $y2)
  $path = Join-Path $dir ("icon{0}.png" -f $size)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose()
  $g.Dispose()
  $bmp.Dispose()
}
Write-Host "Icons saved to $dir"
