@echo off
echo Starting Connecta Backend & Frontend...
start "Connecta Backend" cmd /k "cd /d %~dp0server && npm run dev"
start "Connecta Frontend" cmd /k "cd /d %~dp0client && npm run dev"
echo Both servers have been launched in separate windows!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
pause

