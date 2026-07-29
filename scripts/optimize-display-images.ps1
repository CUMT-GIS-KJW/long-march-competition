Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot

function Resize-Png {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Target,
    [Parameter(Mandatory = $true)][int]$Width,
    [Parameter(Mandatory = $true)][int]$Height
  )

  $sourcePath = Join-Path $projectRoot $Source
  $targetPath = Join-Path $projectRoot $Target
  $temporaryPath = "$targetPath.tmp.png"
  $image = [System.Drawing.Image]::FromFile($sourcePath)
  $bitmap = New-Object System.Drawing.Bitmap(
    $Width,
    $Height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($image, 0, 0, $Width, $Height)
    $bitmap.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $image.Dispose()
  }

  Move-Item -LiteralPath $temporaryPath -Destination $targetPath -Force
}

function Resize-Jpeg {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Target,
    [Parameter(Mandatory = $true)][int]$Width,
    [Parameter(Mandatory = $true)][int]$Height,
    [int]$Quality = 88
  )

  $sourcePath = Join-Path $projectRoot $Source
  $targetPath = Join-Path $projectRoot $Target
  $temporaryPath = "$targetPath.tmp.jpg"
  $image = [System.Drawing.Image]::FromFile($sourcePath)
  $bitmap = New-Object System.Drawing.Bitmap(
    $Width,
    $Height,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" }
  $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality,
    [long]$Quality
  )

  try {
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($image, 0, 0, $Width, $Height)
    $bitmap.Save($temporaryPath, $jpegCodec, $encoderParameters)
  }
  finally {
    $encoderParameters.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    $image.Dispose()
  }

  Move-Item -LiteralPath $temporaryPath -Destination $targetPath -Force
}

Resize-Png `
  -Source "assets/images/home-poster/logal.png" `
  -Target "assets/images/home-poster/logal-display.png" `
  -Width 240 `
  -Height 160

Resize-Png `
  -Source "assets/images/cpc-party-flag.png" `
  -Target "assets/images/cpc-party-flag-display.png" `
  -Width 288 `
  -Height 192

Resize-Jpeg `
  -Source "assets/images/home/map-background.png" `
  -Target "assets/images/home/map-background-display.jpg" `
  -Width 1667 `
  -Height 943 `
  -Quality 88

Resize-Jpeg `
  -Source "assets/images/poetry/source-bg.jpg" `
  -Target "assets/images/poetry/source-bg-display.jpg" `
  -Width 1920 `
  -Height 1200 `
  -Quality 86

Resize-Png `
  -Source "assets/images/poetry/location.png" `
  -Target "assets/images/poetry/location-display.png" `
  -Width 96 `
  -Height 82

Resize-Jpeg `
  -Source "assets/images/poetry/VCG211634570806.jpg" `
  -Target "assets/images/poetry/VCG211634570806-display.jpg" `
  -Width 1024 `
  -Height 768 `
  -Quality 86

Resize-Jpeg `
  -Source "assets/images/poetry/VCG211611345420.jpg" `
  -Target "assets/images/poetry/VCG211611345420-display.jpg" `
  -Width 1024 `
  -Height 683 `
  -Quality 86

Resize-Jpeg `
  -Source "assets/images/poetry/VCG211643672387.jpg" `
  -Target "assets/images/poetry/VCG211643672387-display.jpg" `
  -Width 1024 `
  -Height 683 `
  -Quality 86

Resize-Jpeg `
  -Source "assets/images/poetry/VCG211444428325.jpg" `
  -Target "assets/images/poetry/VCG211444428325-display.jpg" `
  -Width 1024 `
  -Height 768 `
  -Quality 86

Resize-Jpeg `
  -Source "assets/images/poetry/VCG211353582315.jpg" `
  -Target "assets/images/poetry/VCG211353582315-display.jpg" `
  -Width 1024 `
  -Height 683 `
  -Quality 86

Resize-Jpeg `
  -Source "assets/images/poetry/VCG211458592604.jpg" `
  -Target "assets/images/poetry/VCG211458592604-display.jpg" `
  -Width 817 `
  -Height 1024 `
  -Quality 86
