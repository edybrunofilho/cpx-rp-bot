@echo off
cd /d "%~dp0"
if not exist .env (
  echo Primeiro preencha o arquivo privado .env.
  pause
  exit /b 1
)
node --env-file=.env register-commands.mjs
pause
