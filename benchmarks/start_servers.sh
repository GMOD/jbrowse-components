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
echo "Starting $REPO_COUNT repositories..."
echo ""

# Function to start a server
start_server() {
  local repo_path=$1
  local port=$2
  local label=$3
  local log_file="$LOG_DIR/server_${port}.log"

  if [ ! -d "$repo_path" ]; then
    echo "⚠️  Skipping $label: Directory not found ($repo_path)"
    return
  fi

  echo "Starting $label on port $port..."

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

# Start servers for all configured repositories
for i in "${!REPOS[@]}"; do
  start_server "${REPOS[$i]}" "${PORTS[$i]}" "${LABELS[$i]}"
done

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

# Check all configured servers
for i in "${!REPOS[@]}"; do
  check_server "${PORTS[$i]}" "Port ${PORTS[$i]} (${LABELS[$i]})"
done

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
