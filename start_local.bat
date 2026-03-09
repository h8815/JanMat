@echo off
setlocal
echo ===================================================
echo JANMAT LOCAL DEVELOPMENT STARTUP SCRIPT
echo ===================================================
echo.

echo [1/4] Stopping all existing Docker containers...
cd /d "%~dp0"
docker compose down
echo.

echo [2/4] Starting PostgreSQL Database via Docker...
docker compose up -d postgres
echo Waiting 5 seconds for database to initialize...
timeout /t 5 /nobreak >nul
echo.

echo [3/4] Setting up Backend (Django)...
cd backend
echo Activating Virtual Environment and Installing Requirements...
if not exist venv (
    python.exe -m venv venv
)
call venv\Scripts\activate.bat
python.exe -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate

echo Collecting static files...
python manage.py collectstatic --noinput --clear

echo Starting Django Backend in a new window...
start "JanMat Backend (Port 8000)" cmd /k "call venv\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000"
cd ..
echo.

echo [4/4] Setting up Frontend (React Vite)...
cd frontend
if not exist node_modules (
    echo Installing npm dependencies...
    npm install
)
echo Starting React Frontend in a new window...
start "JanMat Frontend (Port 80)" cmd /k "npm run dev -- --port 80"
cd ..

echo.
echo ===================================================
echo All services started!
echo Database runs in Docker (Port 5432).
echo Backend runs locally (Port 8000).
echo Frontend runs locally (Port 80).
echo ===================================================
pause
