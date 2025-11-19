#!/bin/bash

# Start JBrowse servers for benchmarking
# Starts dev servers in the background for each configured repository

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
source "$SCRIPT_DIR/config.sh"

LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting JBrowse Dev Servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to start a server
start_server() {
  local repo_path=$1
  local port=$2
  local name=$3
  local log_file="$LOG_DIR/server_${port}.log"

  if [ ! -d "$repo_path" ]; then
    echo "⚠️  Skipping $name: Directory not found ($repo_path)"
    return
  fi

  echo "Starting $name on port $port..."

  # Kill any existing process on this port
  lsof -ti:$port | xargs kill -9 2>/dev/null || true

  cd "$repo_path/products/jbrowse-web"

  # Start server in background
  PORT=$port yarn start > "$log_file" 2>&1 &
  local pid=$!

  echo "  PID: $pid"
  echo "  Log: $log_file"
  echo "  URL: http://localhost:$port"
  echo ""

  # Store PID for later cleanup
  echo $pid >> "$LOG_DIR/server_pids.txt"
}

# Clean up old PID file
rm -f "$LOG_DIR/server_pids.txt"

# Start servers
start_server "$REPO1" $PORT1 "Repository 1 (Port $PORT1)"
start_server "$REPO2" $PORT2 "Repository 2 (Port $PORT2)"

if [ -d "$REPO3" ]; then
  start_server "$REPO3" $PORT3 "Repository 3 (Port $PORT3)"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ Waiting for servers to start..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Waiting 30 seconds for webpack compilation..."
sleep 30

# Check if servers are responding
check_server() {
  local port=$1
  local name=$2

  if curl -s "http://localhost:$port" > /dev/null 2>&1; then
    echo "✅ $name is responding"
  else
    echo "⚠️  $name may not be ready yet (check logs)"
  fi
}

check_server $PORT1 "Port $PORT1"
check_server $PORT2 "Port $PORT2"
if [ -d "$REPO3" ]; then
  check_server $PORT3 "Port $PORT3"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Servers started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "PIDs stored in: $LOG_DIR/server_pids.txt"
echo "Logs in: $LOG_DIR/"
echo ""
echo "To stop servers: ./benchmarks/stop_servers.sh"
echo "To run benchmarks: ./benchmarks/run_all_benchmarks.sh"
echo ""
