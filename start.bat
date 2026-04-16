@echo off
cd /d "%~dp0"
title ECC Tokushima Apps LP
set PORT=8765

echo Starting server on port %PORT%...
start /B python -m http.server %PORT%

timeout /t 2 /nobreak >nul
echo Opening browser...
start http://localhost:%PORT%/index.html

echo.
echo Press any key to stop the server...
pause >nul
taskkill /F /IM python.exe >nul 2>&1
echo Server stopped.
