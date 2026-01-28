#!/bin/bash

# JanMat Backend Entrypoint Script
set -e

echo "Starting JanMat Backend..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 0.1
done
echo "PostgreSQL is ready!"

# Run database migrations
echo "Running database migrations..."
python manage.py makemigrations accounts
python manage.py makemigrations verification
python manage.py makemigrations fraud
python manage.py migrate

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create logs directory
mkdir -p /app/logs

echo "JanMat Backend is ready!"

# Start the application
if [ "$DEBUG" = "True" ]; then
    echo "Starting in DEBUG mode..."
    python manage.py runserver 0.0.0.0:8000
else
    echo "Starting in PRODUCTION mode..."
    gunicorn janmat_backend.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers 3 \
        --worker-class sync \
        --worker-connections 1000 \
        --max-requests 1000 \
        --max-requests-jitter 100 \
        --timeout 30 \
        --keep-alive 2 \
        --log-level info \
        --access-logfile /app/logs/access.log \
        --error-logfile /app/logs/error.log
fi