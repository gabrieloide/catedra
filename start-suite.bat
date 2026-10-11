@echo off
title Catedra: Suite Docente y Asistente Personal
echo ====================================================
echo   CATEDRA: Asistente Docente, Notion y Recordatorios
echo ====================================================
echo.

:: 1. Comprobar actualizaciones desde GitHub si existe repositorio remoto
git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel% equ 0 (
    echo Verificando actualizaciones en GitHub...
    git fetch origin main >nul 2>&1
    git diff --quiet HEAD origin/main >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ACTUALIZACION] Se detectaron cambios en GitHub. Descargando...
        git pull origin main
        echo [OK] Codigo actualizado.
    ) else (
        echo [OK] El sistema esta en la version mas reciente.
    )
    echo.
)

if not exist "backend-service\node_modules" (
    echo [AVISO] Dependencias no encontradas. Ejecutando instalador automatico...
    echo.
    call install.bat
    echo.
)

echo Selecciona el servicio a iniciar:
echo 1. Iniciar Servidor Backend (Bot WhatsApp, Scheduler y Notion Agent)
echo 2. Iniciar Grabador y Transcriptor de Clases (App PC)
echo 3. Iniciar Aplicacion Cliente (Android/PC Web Dev Server)
echo 4. Instalar o reparar dependencias del sistema
echo 5. Salir
echo.
set /p opt="Opcion (1-5): "

if "%opt%"=="1" (
    cd backend-service
    call npm start
)
if "%opt%"=="2" (
    cd desktop-transcriber
    python main.py
)
if "%opt%"=="3" (
    cd client-app
    call npm run dev
)
if "%opt%"=="4" (
    call install.bat
)
if "%opt%"=="5" (
    exit
)
pause

