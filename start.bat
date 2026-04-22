@echo off
cd /d "%~dp0"
title ECC Apps Launcher [Port 5500]
set PORT=5500

echo ============================================
echo   ECC Web App Launcher  (Port %PORT%)
echo   Dir: %cd%
echo ============================================
echo.

echo Starting server on port %PORT%...
start /B python -m http.server %PORT%

timeout /t 2 /nobreak >nul

echo Opening browser...
start http://localhost:%PORT%/index.html

echo.
echo Press any key to stop the server...
pause >nul

echo Stopping server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Server stopped.
