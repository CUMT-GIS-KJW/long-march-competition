@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "红图绘长征服务" /min cmd /c "npm start"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8096"
