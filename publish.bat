@echo off
:: =============================================================================
:: Foxina 發佈腳本 (publish.bat)
:: 用途：在 Foxina-localDev 打包完成後，自動將 CRX 複製到 main 並推送至 GitHub
:: 使用方式：直接雙擊本檔案執行
:: =============================================================================

:: 設定編碼為 UTF-8，確保中文顯示正常
chcp 65001 > nul

:: 啟用延遲變數展開（for 迴圈內使用 !VAR! 必須開啟）
setlocal enabledelayedexpansion

:: --- 路徑設定 ---
:: %~dp0 = 本腳本所在目錄（含結尾反斜線），截去最後一個字元以去除反斜線
set "MAIN_DIR=%~dp0"
set "MAIN_DIR=%MAIN_DIR:~0,-1%"
set "LOCALDEV_DIR=%MAIN_DIR%\..\Foxina-localDev"
set "LOCALDEV_CRX=%LOCALDEV_DIR%\dist\bex.crx"
set "MAIN_CRX=%MAIN_DIR%\dist\bex.crx"

echo.
echo ==========================================
echo   Foxina 發佈流程開始
echo ==========================================

:: -----------------------------------------------------------------------
:: 步驟 1：從 localDev 的 package.json 讀取版本號
::         使用 PowerShell 進行 JSON 解析，避免 batch 字串處理的複雜性
:: -----------------------------------------------------------------------
echo.
echo [1/5] 讀取版本號...
for /f "delims=" %%v in ('powershell -NoProfile -Command "(Get-Content '%LOCALDEV_DIR%\package.json' | ConvertFrom-Json).version"') do set "VERSION=%%v"

if "%VERSION%"=="" (
    echo       [錯誤] 無法讀取版本號，請確認 Foxina-localDev\package.json 格式正確。
    goto :ERROR
)
echo       目前版本：v%VERSION%

:: -----------------------------------------------------------------------
:: 步驟 2：確認 localDev 的 dist\bex.crx 已存在
::         若不存在，表示尚未打包，中止並提示使用者
:: -----------------------------------------------------------------------
echo.
echo [2/5] 確認 CRX 檔案...
if not exist "%LOCALDEV_CRX%" (
    echo       [錯誤] 找不到 CRX 檔案：%LOCALDEV_CRX%
    echo       請先在 Foxina-localDev 目錄執行：quasar build -m bex
    goto :ERROR
)

:: 顯示 CRX 檔案資訊
for %%f in ("%LOCALDEV_CRX%") do (
    echo       找到 CRX ^(大小: %%~zf bytes，修改時間: %%~tf^)
)

:: -----------------------------------------------------------------------
:: 步驟 3：將 CRX 複製到 main 分支的 dist\ 目錄
:: -----------------------------------------------------------------------
echo.
echo [3/5] 複製 CRX 到 main 分支...
copy /y "%LOCALDEV_CRX%" "%MAIN_CRX%" > nul
if errorlevel 1 (
    echo       [錯誤] 複製 CRX 失敗！
    goto :ERROR
)
echo       複製完成：%MAIN_CRX%

:: -----------------------------------------------------------------------
:: 步驟 4：同步版本號到 main 分支的 package.json 與 updates.xml
::         使用 PowerShell 處理 JSON 與正規表達式取代
:: -----------------------------------------------------------------------
echo.
echo [4/5] 同步版本號到 main 分支...

:: 更新 main 的 package.json
powershell -NoProfile -Command "$p = Get-Content '%MAIN_DIR%\package.json' | ConvertFrom-Json; $p.version = '%VERSION%'; $p | ConvertTo-Json -Depth 10 | Set-Content '%MAIN_DIR%\package.json' -Encoding UTF8"
if errorlevel 1 (
    echo       [錯誤] 更新 package.json 失敗！
    goto :ERROR
)
echo       package.json ^→ v%VERSION%

:: 更新 main 的 updates.xml（使用正規表達式取代 version 屬性值）
powershell -NoProfile -Command "(Get-Content '%MAIN_DIR%\updates.xml' -Raw) -replace \"version='[^']*'\", \"version='%VERSION%'\" | Set-Content '%MAIN_DIR%\updates.xml' -Encoding UTF8"
if errorlevel 1 (
    echo       [錯誤] 更新 updates.xml 失敗！
    goto :ERROR
)
echo       updates.xml ^→ v%VERSION%

:: -----------------------------------------------------------------------
:: 步驟 5：Git add、確認、commit、push 至 GitHub
:: -----------------------------------------------------------------------
echo.
echo [5/5] 準備推送至 GitHub...
cd /d "%MAIN_DIR%"

git add dist\bex.crx package.json updates.xml
echo.
echo --- 即將提交的變更 ---
git status --short
echo ----------------------

echo.
set /p CONFIRM="確認推送 v%VERSION% 到 GitHub？ (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo.
    echo       使用者取消，已中止發佈。
    goto :CANCEL
)

git commit -m "Release v%VERSION%"
if errorlevel 1 (
    echo       [錯誤] git commit 失敗！
    goto :ERROR
)

git push origin main
if errorlevel 1 (
    echo       [錯誤] git push 失敗，請確認網路連線與 remote 設定。
    goto :ERROR
)

:: -----------------------------------------------------------------------
:: 完成
:: -----------------------------------------------------------------------
echo.
echo ==========================================
echo   Foxina v%VERSION% 發佈完成！
echo   CRX 下載連結：
echo   https://github.com/AngeloEyez/Foxina/raw/main/dist/bex.crx
echo ==========================================
echo.
pause
exit /b 0

:: -----------------------------------------------------------------------
:: 錯誤處理
:: -----------------------------------------------------------------------
:ERROR
echo.
echo ==========================================
echo   [錯誤] 發佈流程中止，請檢查上方錯誤訊息。
echo ==========================================
echo.
pause
exit /b 1

:CANCEL
echo.
pause
exit /b 0
