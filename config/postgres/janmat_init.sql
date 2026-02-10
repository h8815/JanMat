-- JanMat Database Initialization Script
-- This script sets up the PostgreSQL database with proper security

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE janmat_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'janmat_db')\gexec

-- Connect to the database
\c janmat_db;

-- Create extensions for better performance and security
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Set timezone
SET timezone = 'Asia/Kolkata';

-- Create indexes for better performance (will be created by Django migrations)
-- These are just placeholders for future optimization

-- Security settings
ALTER DATABASE janmat_db SET log_statement = 'all';
ALTER DATABASE janmat_db SET log_min_duration_statement = 1000;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE janmat_db TO janmat_user;