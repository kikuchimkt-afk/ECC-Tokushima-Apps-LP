@echo off
title ECC Launcher
if not "%~1"=="" (set PORT=%~1) else (set PORT=8765)
echo Starting on port %PORT%...
echo.
start http://localhost:%PORT%
python -m http.server %PORT%
pause
