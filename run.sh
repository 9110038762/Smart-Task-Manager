#!/bin/bash

# Smart Task Manager Orchestrator

# Ensure we operate in the script's root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Clean up any previously stuck processes on ports 5005 or 5173
lsof -ti :5005 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

# Function to shut down both servers when script is closed
cleanup() {
    echo ""
    echo "Stopping all services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    lsof -ti :5005 | xargs kill -9 2>/dev/null
    lsof -ti :5173 | xargs kill -9 2>/dev/null
    exit 0
}

# Intercept Ctrl+C (SIGINT) and terminal kill (SIGTERM)
trap cleanup SIGINT SIGTERM

echo "=================================================="
echo "    Launching Smart Task Manager Application      "
echo "=================================================="

# 1. Launch backend
echo "👉 Booting Backend Server (Port 5005)..."
cd "$SCRIPT_DIR/backend"
npm start &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Delay to allow backend connection to database
sleep 2.5

# 2. Launch frontend
echo "👉 Booting Vite React Frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=================================================="
echo " ✅ Application is up and running!"
echo " 🌐 Backend API:  http://localhost:5005"
echo " 🌐 Frontend UI:  http://localhost:5173"
echo " 🚨 Press [Ctrl + C] at any time to stop services."
echo "=================================================="

# Wait for background jobs to finish
wait
