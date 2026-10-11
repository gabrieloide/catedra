@echo off
title Instalador Catedra
echo ====================================================
echo   INSTALADOR AUTOMATICO: CATEDRA
echo ====================================================
echo.

:: Verificar permisos y herramientas basicas
echo [1/5] Verificando herramientas del sistema...

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Git no esta instalado. Intentando instalar via winget...
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar Git automaticamente. Instala Git manualmente y reinicia el instalador.
        pause
        exit /b 1
    )
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Node.js no esta instalado. Intentando instalar via winget...
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar Node.js automaticamente. Instala Node.js LTS manualmente y reinicia el instalador.
        pause
        exit /b 1
    )
)

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Python no esta instalado. Intentando instalar via winget...
    winget install --id Python.Python.3.11 -e --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar Python automaticamente. Instala Python manualmente y reinicia el instalador.
        pause
        exit /b 1
    )
)

echo [OK] Herramientas del sistema verificadas.
echo.

:: Instalar dependencias backend
echo [2/5] Instalando dependencias del Backend...
cd backend-service
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la instalacion de dependencias del backend.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Backend instalado correctamente.
echo.

:: Instalar dependencias transcriptor python
echo [3/5] Instalando dependencias del Transcriptor de escritorio...
cd desktop-transcriber
python -m pip install --upgrade pip >nul 2>&1
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la instalacion de dependencias de Python.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Transcriptor instalado correctamente.
echo.

:: Instalar dependencias client app
echo [4/5] Instalando dependencias del Cliente Web...
cd client-app
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la instalacion de dependencias del cliente web.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Cliente web instalado correctamente.
echo.

:: Preparar archivos de configuracion .env
echo [5/5] Configurando archivos de entorno...

if not exist "backend-service\.env" (
    copy "backend-service\.env.example" "backend-service\.env" >nul
    echo [CREADO] backend-service\.env creado desde plantilla.
    set ABRIR_NOTEPAD=1
) else (
    echo [EXISTE] backend-service\.env ya estaba configurado.
)

if not exist "desktop-transcriber\.env" (
    copy "desktop-transcriber\.env.example" "desktop-transcriber\.env" >nul
    echo [CREADO] desktop-transcriber\.env creado desde plantilla.
    set ABRIR_NOTEPAD=1
) else (
    echo [EXISTE] desktop-transcriber\.env ya estaba configurado.
)

echo.
echo ====================================================
echo   INSTALACION COMPLETADA CON EXITO
echo ====================================================
echo.

if defined ABRIR_NOTEPAD (
    echo Se abriran los archivos .env para que ingreses tus claves de API.
    echo Guarda los cambios al terminar de rellenar tus datos.
    echo.
    start notepad "backend-service\.env"
    start notepad "desktop-transcriber\.env"
)

echo Ahora puedes iniciar la aplicacion ejecutando start-suite.bat
echo.
pause
