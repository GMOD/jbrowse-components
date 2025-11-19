#!/bin/bash

# Stop all benchmark servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration to get port numbers
source "$SCRIPT_DIR/config.sh"

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

# Kill by port for all configured repositories
echo ""
echo "Ensuring ports are free..."
for i in "${!REPOS[@]}"; do
  port="${PORTS[$i]}"
  if lsof -ti:$port > /dev/null 2>&1; then
    echo "  Killing process on port $port"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
  fi
done

echo ""
echo "✅ All servers stopped"
echo ""
