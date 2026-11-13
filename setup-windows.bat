@echo off
cd /d "%~dp0server"
if not exist .env copy .env.example .env
echo Installing packages...
call npm install
echo Seeding demo data (MongoDB must be running)...
call npm run seed
echo Starting backend on http://localhost:5000
call npm run dev
