#!/bin/bash

# Stop all benchmark servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
PID_FILE="$LOG_DIR/server_pids.txt"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 Stopping JBrowse Dev Servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Kill by PID file
if [ -f "$PID_FILE" ]; then
  echo "Stopping servers from PID file..."
  while read pid; do
    if kill -0 $pid 2>/dev/null; then
      echo "  Killing PID $pid"
      kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null
    fi
  done < "$PID_FILE"
  rm "$PID_FILE"
fi

# Kill by port
echo ""
echo "Ensuring ports are free..."
for port in 3000 3001 3002; do
  if lsof -ti:$port > /dev/null 2>&1; then
    echo "  Killing process on port $port"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
  fi
done

echo ""
echo "✅ All servers stopped"
echo ""
