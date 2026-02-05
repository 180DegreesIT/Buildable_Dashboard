@echo off
echo Starting Buildable Dashboard...
echo.

:: Check if node is available
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

:: Start the server
echo Starting server on http://localhost:6000 ...
cd /d "%~dp0"
start "Buildable Dashboard - Server" cmd /c "npm run start -w server"

:: Wait for server to be ready
timeout /t 3 /nobreak >nul

:: Open the dashboard in the default browser
echo Opening dashboard in browser...
start http://localhost:6000

echo.
echo Buildable Dashboard is running.
echo Close the server window or run stop-dashboard.bat to stop.
pause
