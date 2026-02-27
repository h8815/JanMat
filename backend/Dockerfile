# JanMat Backend Dockerfile with tenant isolation support
FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    netcat-traditional \
    curl \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app user for security
RUN groupadd -r janmat && useradd -r -g janmat janmat

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY ./backend/requirements.txt .
RUN pip install --default-timeout=1000 -i https://pypi.org/simple --no-cache-dir -r requirements.txt

# Development stage
FROM base AS development
ENV DEBUG=True

# Copy application code
COPY ./backend .

# Create logs directory and set permissions
RUN mkdir -p /app/logs /app/staticfiles && \
    chown -R janmat:janmat /app

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Switch to non-root user
USER janmat

EXPOSE 8000
CMD ["/app/entrypoint.sh"]

# Production stage
FROM base AS production
ENV DEBUG=False

# Copy application code
COPY ./backend .

# Copy frontend images to static directory
COPY ./frontend/public/assets /app/staticfiles/images

# Create necessary directories and set permissions
RUN mkdir -p /app/logs /app/staticfiles && \
    chown -R janmat:janmat /app

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Switch to non-root user
USER janmat

EXPOSE 8000

# Health check for production
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

CMD ["/app/entrypoint.sh"]