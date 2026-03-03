@echo off
title ECCベストワン Webアプリ ランチャー - ローカルサーバー
echo.
echo ========================================
echo   ECCベストワン Webアプリ ランチャー
echo   ローカルサーバーを起動します
echo   http://localhost:8000
echo ========================================
echo.
echo ブラウザで http://localhost:8000 を開いてください
echo 終了するには Ctrl+C を押してください
echo.

start http://localhost:8000

python -m http.server 8000
pause
