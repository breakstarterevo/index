@echo off
cd /d "%~dp0..\.."
echo Serving from: %CD%
python -m http.server 8000
pause
