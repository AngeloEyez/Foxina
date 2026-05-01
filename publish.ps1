$ErrorActionPreference = "Stop"

$MAIN_DIR      = $PSScriptRoot
$LOCALDEV_DIR  = "$PSScriptRoot\..\Foxina-localDev"
$LOCALDEV_CRX  = "$LOCALDEV_DIR\dist\bex.crx"
$MAIN_CRX      = "$MAIN_DIR\dist\bex.crx"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Foxina Publish Process Started" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host "`n[1/5] Reading version..." -ForegroundColor Yellow
$packageJson = Get-Content "$LOCALDEV_DIR\package.json" | ConvertFrom-Json
$version = $packageJson.version
Write-Host "      Current version: v$version" -ForegroundColor Green

Write-Host "`n[2/5] Checking CRX file..." -ForegroundColor Yellow
if (-not (Test-Path $LOCALDEV_CRX)) {
    Write-Host "      [ERROR] CRX file not found: $LOCALDEV_CRX" -ForegroundColor Red
    Write-Host "      Please run 'quasar build -m bex' in Foxina-localDev first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
$crxInfo = Get-Item $LOCALDEV_CRX
Write-Host "      [OK] CRX found ($([Math]::Round($crxInfo.Length / 1KB, 1)) KB)" -ForegroundColor Green

Write-Host "`n[3/5] Copying CRX to main branch..." -ForegroundColor Yellow
Copy-Item -Path $LOCALDEV_CRX -Destination $MAIN_CRX -Force
Write-Host "      [OK] Copied to $MAIN_CRX" -ForegroundColor Green

Write-Host "`n[4/5] Updating package.json and updates.xml..." -ForegroundColor Yellow
$mainPackageJson = Get-Content "$MAIN_DIR\package.json" | ConvertFrom-Json
$mainPackageJson.version = $version
$mainPackageJson | ConvertTo-Json -Depth 10 | Set-Content "$MAIN_DIR\package.json" -Encoding UTF8
Write-Host "      [OK] package.json -> v$version" -ForegroundColor Green

$updatesXml = Get-Content "$MAIN_DIR\updates.xml" -Raw
$updatesXml = $updatesXml -replace "version='[^']*'", "version='$version'"
[System.IO.File]::WriteAllText("$MAIN_DIR\updates.xml", $updatesXml)
Write-Host "      [OK] updates.xml -> v$version" -ForegroundColor Green

Write-Host "`n[5/5] Pushing to GitHub..." -ForegroundColor Yellow
Set-Location $MAIN_DIR

git add dist/bex.crx package.json updates.xml
git status --short

Write-Host ""
$confirm = Read-Host "Push v$version to GitHub? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "      Canceled by user." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 0
}

git commit -m "Release v$version"
git push origin main

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " [OK] Foxina v$version Published!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"
