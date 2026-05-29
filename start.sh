#!/bin/bash
# Tyla Shop MIS - Start both servers

echo "🚀 Starting Tyla Shop MIS..."

# Start backend
echo "📦 Starting backend on port 5000..."
cd backend && npm install --silent && npm run dev &
BACKEND_PID=$!

# Start frontend
echo "🎨 Starting frontend on port 3000..."
cd ../frontend && npm install --silent && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers started!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo ""
echo "   Login: admin@electroshop.com / Admin@123  (existing admin credentials)"
echo ""
echo "Press Ctrl+C to stop all servers."

wait $BACKEND_PID $FRONTEND_PID
