#!/bin/bash

# Lunora Player - Start Dashboard with Backend
# This script starts both the backend API and dashboard frontend

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

echo "=========================================="
echo "  Lunora Player - Dashboard Startup"
echo "=========================================="
echo ""

# Check if AWS credentials are configured
if ! aws sts get-caller-identity --profile lunora-media >/dev/null 2>&1; then
    print_warning "AWS credentials not found for profile 'lunora-media'"
    print_info "Please run: aws configure --profile lunora-media"
    exit 1
fi

print_success "AWS credentials verified"

# Check if ports are available
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 3000 is already in use (Backend API)"
    print_info "Stopping existing process..."
    pkill -f "node backend/server.js" || true
    sleep 2
fi

if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 8081 is already in use (Dashboard)"
    print_info "Stopping existing process..."
    pkill -f "http-server.*8081" || true
    sleep 2
fi

print_info "Starting Lunora Player Dashboard..."

# Set AWS environment variables
export AWS_PROFILE=lunora-media
export AWS_SDK_LOAD_CONFIG=1

# Start backend and dashboard concurrently
if command -v concurrently >/dev/null 2>&1; then
    print_info "Using concurrently to start services..."
    npm run start
else
    print_info "Starting services manually..."
    
    # Start backend in background
    print_info "Starting backend API on port 3000..."
    npm run backend &
    BACKEND_PID=$!
    
    # Wait a moment for backend to start
    sleep 3
    
    # Start dashboard
    print_info "Starting dashboard on port 8081..."
    npm run dashboard &
    DASHBOARD_PID=$!
    
    # Function to cleanup on exit
    cleanup() {
        print_info "Shutting down services..."
        kill $BACKEND_PID 2>/dev/null || true
        kill $DASHBOARD_PID 2>/dev/null || true
        exit 0
    }
    
    # Set trap to cleanup on script exit
    trap cleanup SIGINT SIGTERM
    
    print_success "Services started successfully!"
    print_info "Backend API: http://localhost:3000"
    print_info "Dashboard: http://localhost:8081/dashboard.html"
    print_info "Player: http://localhost:8080"
    print_info ""
    print_info "Press Ctrl+C to stop all services"
    
    # Wait for processes
    wait
fi
