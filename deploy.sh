#!/bin/bash

# JanMat - Complete Deployment Script
# Handles deployment, user creation, and system management

echo "🚀 JanMat - Secure Biometric E-Voting Booth System"
echo "=================================================="

case "$1" in
    "down")
        echo "🛑 Stopping JanMat system..."
        docker compose down
        echo "✅ System stopped"
        exit 0
        ;;
    "logs")
        echo "📋 Showing logs..."
        docker compose logs -f
        exit 0
        ;;
    "clean")
        echo "🧹 Cleaning system..."
        docker compose down -v --remove-orphans
        docker system prune -f
        echo "✅ System cleaned"
        exit 0
        ;;
esac

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not installed. Install Docker first."
    exit 1
fi

# Check .env
if [ ! -f .env ]; then
    echo "⚠️ Creating .env from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file"
        echo "⚠️ Edit .env file with your settings before continuing"
        read -p "Press Enter to continue..."
    else
        echo "❌ .env.example not found"
        exit 1
    fi
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p logs

# Deploy system
echo "🐳 Deploying containers..."
docker compose down --remove-orphans 2>/dev/null
docker compose up -d --build

# Wait for services
echo "⏳ Waiting for services..."
sleep 15

# Health checks
echo "🔍 Checking backend..."
for i in {1..30}; do
    if curl -f http://localhost:8000/api/health/ >/dev/null 2>&1; then
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend failed"
        docker compose logs backend
        exit 1
    fi
    sleep 2
done
echo "✅ Backend healthy"

echo "🔍 Checking frontend..."
for i in {1..10}; do
    if curl -f http://localhost/ >/dev/null 2>&1; then
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Frontend failed"
        exit 1
    fi
    sleep 2
done
echo "✅ Frontend ready"

# Create superuser
echo ""
echo "👤 Creating superuser..."
echo "Enter superuser credentials (this user can create admins and operators):"
docker exec -it janmat_backend python manage.py createsuperuser

echo ""
echo "🎉 JanMat deployed successfully!"
echo ""
echo "📋 Access URLs:"
echo "   Frontend:     http://localhost"
echo "   Django Admin: http://localhost:8000/admin"
echo "   Admin Login:  http://localhost/admin-login.html"
echo "   Operator:     http://localhost/operator-login.html"
echo ""
echo "👥 User Management:"
echo "   1. Login to Django Admin with superuser credentials"
echo "   2. Go to Users → Add User"
echo "   3. FIRST: Create ADMIN users (Election Commission)"
echo "   4. THEN: Create OPERATOR users (assign to ADMIN, not superuser)"
echo "   5. Operators auto-get profiles created"
echo ""
echo "🔧 Commands:"
echo "   Stop:    ./deploy.sh down"
echo "   Logs:    ./deploy.sh logs"
echo "   Clean:   ./deploy.sh clean"
echo ""