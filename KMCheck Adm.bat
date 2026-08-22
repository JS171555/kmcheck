@echo off
title Admin KMCheck Server
cd /d "%~dp0"

echo ========================================
echo          Admin KMCheck - Servidor
echo ========================================
echo.

if not exist node_modules (
    echo [1/3] Instalando dependencias...
    call npm install
    echo.
)

echo [2/3] Iniciando servidor...
start "" /min cmd /c "npm start"

timeout /t 3 /nobreak >nul

echo [3/3] Abrindo Admin KMCheck...
start "" http://localhost:6969/admin.html

echo.
echo ========================================
echo Admin KMCheck iniciado com sucesso!
echo Servidor: http://localhost:6969/admin.html
echo ========================================
echo.
exit