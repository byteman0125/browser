@echo off
REM Silent watchdog startup - no console window
start /B "" "%~dp0dist\watchdog-win.exe" >nul 2>&1
