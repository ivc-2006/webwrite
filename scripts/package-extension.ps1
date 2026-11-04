$root = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $root "dist"
$zipPath = Join-Path $outDir "webwrite-chrome.zip"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$staging = Join-Path $env:TEMP ("webwrite-pack-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $staging | Out-Null

$include = @(
  "manifest.json",
  "LICENSE",
  "background",
  "content",
  "popup",
  "icons"
)

foreach ($item in $include) {
  Copy-Item -Path (Join-Path $root $item) -Destination (Join-Path $staging $item) -Recurse -Force
}

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
Remove-Item $staging -Recurse -Force

Write-Host "Chrome Web Store zip: $zipPath"
Write-Host "Upload this zip at https://developer.chrome.com/docs/webstore/publish/"
