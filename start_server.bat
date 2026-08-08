@echo off
title GutGEM Explorer v2.0 Server Launcher
echo ========================================================
echo       GutGEM Explorer v2.0 - Server Launcher
echo ========================================================
echo.
echo Starting FastAPI Backend Server on http://127.0.0.1:8000 ...
echo.

set PATH=%PATH%;C:\Users\taiba\AppData\Local\Programs\Python\Python311\Scripts;C:\Users\taiba\AppData\Local\Programs\Python\Python311
set PYTHONPATH=%~dp0

start "" "http://127.0.0.1:8000/"

"C:\Users\taiba\AppData\Local\Programs\Python\Python311\python.exe" -m uvicorn backend.app:app --host 127.0.0.1 --port 8000

pause
