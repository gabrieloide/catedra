@echo off
title Catedra - WhatsApp Bot
cd /d "%~dp0backend-service"
echo Iniciando servidor y generando codigo QR de WhatsApp...
echo.
call npm start
pause
