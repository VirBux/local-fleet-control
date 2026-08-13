# Erzeugt src-tauri/icons/icon.ico mit der vollen Windows-Groessenstaffel aus einer PNG-Quelle.
#
# Hintergrund: `tauri icon` legt nur 16/32/128/256 px in die ICO. Die Taskleiste braucht je nach
# Anzeigeskalierung 24/30/36/48 px und skaliert dann sichtbar unsauber herunter. Diese Groessen
# werden hier nativ mitgeliefert.
#
# Aufruf (aus dem Projektwurzelverzeichnis):
#   powershell -ExecutionPolicy Bypass -File scripts/generate-ico.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/generate-ico.ps1 -Source pfad/zum/logo.png

param(
  [string]$Source = "src-tauri/icons/icon.png",
  [string]$Target = "src-tauri/icons/icon.ico"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

# <=64 px als unkomprimiertes BMP (maximale Kompatibilitaet), darueber als PNG (Groesse).
$sizes = @(16, 20, 24, 32, 40, 48, 64, 96, 128, 256)
$pngThreshold = 64

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source).Path)
Write-Host "Quelle: $Source ($($src.Width)x$($src.Height))"

function Resize-Bitmap {
  param([System.Drawing.Image]$Image, [int]$Size)
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $attr = New-Object System.Drawing.Imaging.ImageAttributes
  $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
  $g.DrawImage($Image, $rect, 0, 0, $Image.Width, $Image.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $g.Dispose()
  $attr.Dispose()
  return $bmp
}

function Get-PngBytes {
  param([System.Drawing.Bitmap]$Bitmap)
  $ms = New-Object System.IO.MemoryStream
  $Bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $ms.Dispose()
  return $bytes
}

# BMP-Eintrag im ICO-Format: BITMAPINFOHEADER mit doppelter Hoehe, BGRA von unten nach oben,
# danach die (bei 32 bpp ungenutzte, aber pflichtgemaesse) AND-Maske.
function Get-IcoBmpBytes {
  param([System.Drawing.Bitmap]$Bitmap)
  $size = $Bitmap.Width
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $data = $Bitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                           [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $pixels = New-Object byte[] ($data.Stride * $size)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $pixels.Length)
  $Bitmap.UnlockBits($data)

  $maskStride = [math]::Ceiling($size / 32.0) * 4
  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter($ms)
  $bw.Write([uint32]40)            # biSize
  $bw.Write([int32]$size)          # biWidth
  $bw.Write([int32]($size * 2))    # biHeight (Bild + Maske)
  $bw.Write([uint16]1)             # biPlanes
  $bw.Write([uint16]32)            # biBitCount
  $bw.Write([uint32]0)             # biCompression = BI_RGB
  $bw.Write([uint32]($size * $size * 4 + $maskStride * $size))
  $bw.Write([int32]0); $bw.Write([int32]0)
  $bw.Write([uint32]0); $bw.Write([uint32]0)
  for ($y = $size - 1; $y -ge 0; $y--) {
    $bw.Write($pixels, $y * $data.Stride, $size * 4)
  }
  $bw.Write((New-Object byte[] ($maskStride * $size)))
  $bw.Flush()
  $bytes = $ms.ToArray()
  $bw.Dispose()
  return $bytes
}

$entries = @()
foreach ($size in $sizes) {
  $bmp = Resize-Bitmap -Image $src -Size $size
  $bytes = if ($size -gt $pngThreshold) { Get-PngBytes $bmp } else { Get-IcoBmpBytes $bmp }
  $bmp.Dispose()
  $entries += [pscustomobject]@{ Size = $size; Bytes = $bytes }
  Write-Host ("  {0,3}x{1,-3} {2,7} Bytes  {3}" -f $size, $size, $bytes.Length,
    $(if ($size -gt $pngThreshold) { "PNG" } else { "BMP" }))
}
$src.Dispose()

$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($out)
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$entries.Count)
$offset = 6 + 16 * $entries.Count
foreach ($e in $entries) {
  $dim = if ($e.Size -ge 256) { 0 } else { $e.Size }
  $bw.Write([byte]$dim); $bw.Write([byte]$dim)
  $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$e.Bytes.Length)
  $bw.Write([uint32]$offset)
  $offset += $e.Bytes.Length
}
foreach ($e in $entries) { $bw.Write([byte[]]$e.Bytes, 0, $e.Bytes.Length) }
$bw.Flush()

$targetPath = Join-Path (Get-Location) $Target
[System.IO.File]::WriteAllBytes($targetPath, $out.ToArray())
$bw.Dispose()
Write-Host "Geschrieben: $Target ($((Get-Item $targetPath).Length) Bytes, $($entries.Count) Groessen)"
