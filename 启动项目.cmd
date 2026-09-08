@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 18 or later is required.
  pause
  exit /b 1
)

start "Long March WebGIS Server" /min cmd /c "npm start"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8096"
