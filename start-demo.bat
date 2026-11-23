@echo off
cd /d "%~dp0"
py -3 -c "import PIL" 2>nul || py -3 -m pip install Pillow
if errorlevel 1 goto end
py -3 server.py --open-browser --demo
:end
pause
