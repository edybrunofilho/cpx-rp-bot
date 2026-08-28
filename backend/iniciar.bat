@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 22.13 ou superior antes de iniciar.
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Preencha o arquivo privado .env e execute este arquivo novamente.
  notepad .env
  pause
  exit /b 1
)
node --env-file=.env server.mjs
pause
