@echo off
setlocal

echo ============================================================
echo  GADmin — First-Time Setup
echo ============================================================
echo.

REM --- Python dependencies ---
echo [1/3] Installing Python dependencies...
pip install -e . || (echo ERROR: pip install failed. Is Python 3.11+ on PATH? & pause & exit /b 1)
echo.

REM --- Frontend ---
echo [2/3] Building frontend...
cd frontend
call npm install || (echo ERROR: npm install failed. Is Node.js installed? & pause & exit /b 1)
call npm run build || (echo ERROR: npm run build failed. & pause & exit /b 1)
cd ..
echo.

REM --- .env ---
echo [3/3] Creating .env from template...
if not exist .env (
    copy .env.example .env
    echo   Created .env — edit it if you need to change the GAM path or DB location.
) else (
    echo   .env already exists — skipped.
)
echo.

REM --- Check for GAM ---
echo ============================================================
if exist "C:\GAM7\gam.exe" (
    echo  GAM found at C:\GAM7\gam.exe
    echo  Run: C:\GAM7\gam.exe oauth create   (if not yet authenticated)
) else (
    echo  GAM is NOT installed at C:\GAM7
    echo  Download GAMADV-XTD3 from:
    echo    https://github.com/taers232c/GAMADV-XTD3/releases/latest
    echo  Extract the zip to C:\GAM7 then run:
    echo    C:\GAM7\gam.exe config drive_dir C:\GAM7\gamcache verify
    echo    C:\GAM7\gam.exe oauth create
)
echo ============================================================
echo.
echo Setup complete. Double-click launch_app.bat to start the app.
echo.
pause
