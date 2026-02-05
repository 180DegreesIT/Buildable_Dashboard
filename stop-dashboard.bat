@echo off
echo Stopping Buildable Dashboard...
echo.

:: Kill Node.js processes running on dashboard ports
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":6000 :6001" ^| findstr "LISTENING"') do (
    echo Stopping process %%a ...
    taskkill /PID %%a /F >nul 2>nul
)

echo.
echo Buildable Dashboard stopped.
pause
