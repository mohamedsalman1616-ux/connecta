@echo off
cd /d "%~dp0client"
if not exist .env copy .env.example .env
echo Installing packages...
call npm install
echo Starting frontend on http://localhost:5173
call npm run dev
