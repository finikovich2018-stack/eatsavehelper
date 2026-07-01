# Generates vertical Telegram tutorial video from marketing tutorial slides.
# Requires: ffmpeg, running Next.js on $BaseUrl (default localhost:3000)

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OutFile = "public/videos/eatsave-manual-add-ru.mp4"
)

$ErrorActionPreference = "Stop"
$framesDir = Join-Path $env:TEMP "eatsave-tutorial-frames"
if (Test-Path $framesDir) { Remove-Item $framesDir -Recurse -Force }
New-Item -ItemType Directory -Path $framesDir | Out-Null
$outDir = Split-Path $OutFile -Parent
if ($outDir -and -not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Add-Type -AssemblyName System.Drawing

function Capture-Step {
  param([int]$Step, [string]$OutPath)
  $url = "$BaseUrl/marketing/tutorial-manual?step=$Step"
  Write-Host "Capturing step $Step from $url"

  # Use Edge headless screenshot if available
  $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  if (-not (Test-Path $edge)) {
    $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
  }

  if (Test-Path $edge) {
    & $edge --headless=new --disable-gpu --window-size=430,900 --screenshot=$OutPath $url 2>$null
    if (Test-Path $OutPath) { return }
  }

  throw "Could not capture screenshot for step $Step. Open $url manually and save as $OutPath"
}

1..5 | ForEach-Object {
  Capture-Step -Step $_ -OutPath (Join-Path $framesDir ("step-{0:D2}.png" -f $_))
}

$concatFile = Join-Path $framesDir "concat.txt"
@(
  "file 'step-01.png'"
  "duration 4"
  "file 'step-02.png'"
  "duration 4"
  "file 'step-03.png'"
  "duration 4"
  "file 'step-04.png'"
  "duration 5"
  "file 'step-05.png'"
  "duration 5"
  "file 'step-05.png'"
) | Set-Content -Path $concatFile -Encoding ASCII

Push-Location $framesDir
ffmpeg -y -f concat -safe 0 -i concat.txt -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0a0f0c,format=yuv420p" -r 30 -c:v libx264 -pix_fmt yuv420p $OutFile
Pop-Location

Write-Host "Video saved: $OutFile"
