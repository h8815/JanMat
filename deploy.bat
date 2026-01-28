@echo off
REM JanMat - Complete Deployment Script
REM Handles deployment, user creation, and system management

echo 🚀 JanMat - Secure Biometric E-Voting Booth System
echo ==================================================

if "%1"=="down" goto :stop_system
if "%1"=="logs" goto :show_logs
if "%1"=="clean" goto :clean_system

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker not installed. Install Docker Desktop first.
    pause & exit /b 1
)

REM Check .env
if not exist .env (
    echo ⚠️ Creating .env from template...
    if exist .env.example (
        copy .env.example .env
        echo ✅ Created .env file
        echo ⚠️ Edit .env file with your settings before continuing
        pause
    ) else (
        echo ❌ .env.example not found
        pause & exit /b 1
    )
)

REM Create directories
echo 📁 Creating directories...
if not exist logs mkdir logs

REM Deploy system
echo 🐳 Deploying containers...
docker compose down --remove-orphans 2>nul
docker compose up -d --build

REM Wait for services
echo ⏳ Waiting for services...
timeout /t 15 /nobreak >nul

REM Health checks
echo 🔍 Checking backend...
for /l %%i in (1,1,30) do (
    curl -f http://localhost:8000/api/health/ >nul 2>&1
    if not errorlevel 1 goto :backend_ready
    timeout /t 2 /nobreak >nul
)
echo ❌ Backend failed
docker compose logs backend
pause & exit /b 1

:backend_ready
echo ✅ Backend healthy

echo 🔍 Checking frontend...
for /l %%i in (1,1,10) do (
    curl -f http://localhost/ >nul 2>&1
    if not errorlevel 1 goto :frontend_ready
    timeout /t 2 /nobreak >nul
)
echo ❌ Frontend failed
pause & exit /b 1

:frontend_ready
echo ✅ Frontend ready

REM Create superuser
echo.
echo 👤 Creating superuser...
echo Enter superuser credentials (this user can create admins and operators):
docker exec -it janmat_backend python manage.py createsuperuser

echo.
echo 🎉 JanMat deployed successfully!
echo.
echo 📋 Access URLs:
echo    Frontend:     http://localhost
echo    Django Admin: http://localhost:8000/admin
echo    Admin Login:  http://localhost/admin-login.html
echo    Operator:     http://localhost/operator-login.html
echo.
echo 👥 User Management:
echo    1. Login to Django Admin with superuser credentials
echo    2. Go to Users → Add User
echo    3. FIRST: Create ADMIN users (Election Commission)
echo    4. THEN: Create OPERATOR users (assign to ADMIN, not superuser)
echo    5. Operators auto-get profiles created
echo.
echo 🔧 Commands:
echo    Stop:    deploy.bat down
echo    Logs:    deploy.bat logs
echo    Clean:   deploy.bat clean
echo.
pause
goto :eof

:stop_system
echo 🛑 Stopping JanMat system...
docker compose down
echo ✅ System stopped
goto :eof

:show_logs
echo 📋 Showing logs...
docker compose logs -f
goto :eof

:clean_system
echo 🧹 Cleaning system...
docker compose down -v --remove-orphans
docker system prune -f
echo ✅ System cleaned
goto :eof