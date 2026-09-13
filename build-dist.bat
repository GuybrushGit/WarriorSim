@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-dist.ps1" %*
exit /b %errorlevel%
