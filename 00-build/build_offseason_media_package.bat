@echo off
setlocal

set "ROOT=%~dp0.."
set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
set "SCRIPT=%~dp0scripts\build_offseason_media_package.py"

if not exist "%PYTHON%" (
  echo Python not found at "%PYTHON%".
  echo Update this batch file if your Python install moved.
  exit /b 1
)

"%PYTHON%" "%SCRIPT%" %*
exit /b %ERRORLEVEL%
