# =============================================================================
# Foxina 發佈腳本
# 用途：在 localDev 打包完成後，自動將 CRX 複製到 main 分支並推送至 GitHub
#
# 使用方式：直接雙擊 publish.bat 即可執行此腳本
# =============================================================================

$ErrorActionPreference = "Stop"

# --- 路徑設定 ---
$MAIN_DIR      = $PSScriptRoot                              # main 分支目錄 (本腳本所在位置)
$LOCALDEV_DIR  = "$PSScriptRoot\..\Foxina-localDev"        # localDev 分支目錄
$LOCALDEV_CRX  = "$LOCALDEV_DIR\dist\bex.crx"             # localDev 打包後的 CRX 來源
$MAIN_CRX      = "$MAIN_DIR\dist\bex.crx"                 # main 分支的 CRX 目標位置

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Foxina 發佈流程開始" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# --- 步驟 1：讀取 localDev 的版本號 ---
Write-Host "`n[1/5] 讀取版本號..." -ForegroundColor Yellow
$packageJson = Get-Content "$LOCALDEV_DIR\package.json" | ConvertFrom-Json
$version = $packageJson.version
Write-Host "      目前版本：v$version" -ForegroundColor Green

# --- 步驟 2：確認 CRX 檔案存在 ---
Write-Host "`n[2/5] 確認 CRX 檔案..." -ForegroundColor Yellow
if (-not (Test-Path $LOCALDEV_CRX)) {
    Write-Host "      ❌ 找不到 CRX 檔案: $LOCALDEV_CRX" -ForegroundColor Red
    Write-Host "      請先在 Foxina-localDev 執行: quasar build -m bex" -ForegroundColor Red
    Read-Host "按 Enter 鍵結束"
    exit 1
}
$crxInfo = Get-Item $LOCALDEV_CRX
Write-Host "      ✅ 找到 CRX (大小: $([Math]::Round($crxInfo.Length / 1KB, 1)) KB, 修改時間: $($crxInfo.LastWriteTime))" -ForegroundColor Green

# --- 步驟 3：複製 CRX 到 main 分支 ---
Write-Host "`n[3/5] 複製 CRX 到 main 分支..." -ForegroundColor Yellow
Copy-Item -Path $LOCALDEV_CRX -Destination $MAIN_CRX -Force
Write-Host "      ✅ 複製完成 → $MAIN_CRX" -ForegroundColor Green

# --- 步驟 4：同步更新 main 的 package.json 與 updates.xml ---
Write-Host "`n[4/5] 同步版本號到 main 分支..." -ForegroundColor Yellow

# 更新 package.json
$mainPackageJson = Get-Content "$MAIN_DIR\package.json" | ConvertFrom-Json
$mainPackageJson.version = $version
$mainPackageJson | ConvertTo-Json -Depth 10 | Set-Content "$MAIN_DIR\package.json" -Encoding UTF8
Write-Host "      ✅ package.json → v$version" -ForegroundColor Green

# 更新 updates.xml (直接用字串取代，保留格式)
$updatesXml = Get-Content "$MAIN_DIR\updates.xml" -Raw
$updatesXml = $updatesXml -replace "version='[^']*'", "version='$version'"
[System.IO.File]::WriteAllText("$MAIN_DIR\updates.xml", $updatesXml)
Write-Host "      ✅ updates.xml → v$version" -ForegroundColor Green

# --- 步驟 5：Git commit 並推送至 GitHub ---
Write-Host "`n[5/5] 推送至 GitHub..." -ForegroundColor Yellow
Set-Location $MAIN_DIR

git add dist/bex.crx package.json updates.xml
git status --short

# 詢問是否確認發佈
Write-Host ""
$confirm = Read-Host "確認推送 v$version 到 GitHub？ (y/n)"
if ($confirm -ne 'y') {
    Write-Host "      ⚠️  使用者取消，已中止發佈。" -ForegroundColor Yellow
    Read-Host "按 Enter 鍵結束"
    exit 0
}

git commit -m "Release v$version"
git push origin main

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " ✅ Foxina v$version 發佈完成！" -ForegroundColor Green
Write-Host "    CRX 下載連結:" -ForegroundColor Cyan
Write-Host "    https://github.com/AngeloEyez/Foxina/raw/main/dist/bex.crx" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Cyan
Read-Host "按 Enter 鍵結束"
