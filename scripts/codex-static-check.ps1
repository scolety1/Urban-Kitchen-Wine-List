[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

$requiredFiles = @(
    "index.html",
    "wine.html",
    "whiskey.html",
    "css/base.css",
    "css/table.css",
    "css/drawer.css",
    "css/language.css",
    "js/app.js",
    "js/render.js",
    "js/recommend.js",
    "data/wines.csv",
    "data/wines.json"
)

$missing = @($requiredFiles | Where-Object { !(Test-Path $_) })
if ($missing.Count -gt 0) {
    Write-Host "Missing required files:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

$jsFiles = Get-ChildItem -Path "js" -Filter "*.js" -File
foreach ($file in $jsFiles) {
    node --check $file.FullName
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

node --check "scripts/enrich-wines.mjs"
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$wineJson = Get-Content "data/wines.json" -Raw | ConvertFrom-Json
if (!$wineJson -or $wineJson.Count -eq 0) {
    Write-Host "data/wines.json appears empty or invalid." -ForegroundColor Red
    exit 1
}

Write-Host "Static wine list check passed." -ForegroundColor Green
exit 0
