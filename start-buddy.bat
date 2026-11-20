@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing for the first time...
  call npm install
)
if not exist .env (
  copy .env.example .env >nul
  echo Created .env - fill in your Mind's key and id, then run this again.
  notepad .env
  exit /b
)
start "" npx electron .
