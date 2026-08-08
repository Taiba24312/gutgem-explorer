# GutGEM Explorer v2.0 - PowerShell Launcher
$env:PATH += ";C:\Users\taiba\AppData\Local\Programs\Python\Python311\Scripts;C:\Users\taiba\AppData\Local\Programs\Python\Python311"
$env:PYTHONPATH = $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Green
Write-Host "      GutGEM Explorer v2.0 - Server Launcher" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Starting FastAPI Backend Server on http://127.0.0.1:8000 ..." -ForegroundColor Yellow

Start-Process "http://127.0.0.1:8000/"

& "C:\Users\taiba\AppData\Local\Programs\Python\Python311\python.exe" -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
