@echo off
cd /d "%~dp0.."

set "PYTHON_CMD="

where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_CMD=py -3"
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_CMD=python"
  )
)

if "%PYTHON_CMD%"=="" (
  echo Python was not found on this computer.
  echo Install Python 3, then run this file again.
  pause
  exit /b 1
)

%PYTHON_CMD% 00-build\scripts\build_future_players_json.py
pause
