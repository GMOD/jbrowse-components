#!/bin/bash

# Puppeteer end-to-end benchmark runner
# Builds, starts servers, runs benchmarks, and stops servers

set -e

BENCHMARKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
source "$BENCHMARKS_DIR/config.sh"

LOG_DIR="$BENCHMARKS_DIR/logs"
mkdir -p "$LOG_DIR"

# Get actual branch names from git (these become the labels)
get_branch_name() {
  local repo=$1
  if [ -d "$repo/.git" ]; then
    cd "$repo"
    git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
  else
    echo "not-setup"
  fi
}

# Update labels with actual branch names
for i in "${!REPOS[@]}"; do
  idx=$((i + 1))
  actual_branch=$(get_branch_name "${REPOS[$i]}")
  export "LABEL${idx}=$actual_branch"
done

echo "🚀 JBrowse Alignments End-to-End Benchmarks (Hyperfine + Puppeteer)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Comparing $REPO_COUNT repositories:"
for i in "${!REPOS[@]}"; do
  idx=$((i + 1))
  port_var="PORT${idx}"
  label_var="LABEL${idx}"
  echo "   - Port ${!port_var}: ${!label_var}"
done
echo ""
echo "Hyperfine configuration:"
echo "   - Warmup runs: ${HYPERFINE_WARMUP:-1}"
echo "   - Benchmark runs: ${HYPERFINE_RUNS:-5}"
echo ""

# Function to build a repository
build_repo() {
  local repo_path=$1
  local label=$2

  if [ ! -d "$repo_path" ]; then
    echo "⚠️  Skipping $label: Directory not found ($repo_path)"
    return 1
  fi

  echo "Building $label..."
  cd "$repo_path/products/jbrowse-web"
  yarn build
  echo "✅ Build complete for $label"
  echo ""
}

# Function to start a production server
start_server() {
  local repo_path=$1
  local port=$2
  local label=$3
  local log_file="$LOG_DIR/server_${port}.log"

  if [ ! -d "$repo_path" ]; then
    echo "⚠️  Skipping $label: Directory not found ($repo_path)"
    return 1
  fi

  local build_dir="$repo_path/products/jbrowse-web/build"
  if [ ! -d "$build_dir" ]; then
    echo "⚠️  Skipping $label: Build directory not found ($build_dir)"
    return 1
  fi

  echo "Starting $label on port $port..."

  # Kill any existing process on this port
  lsof -ti:$port | xargs kill -9 2>/dev/null || true

  cd "$build_dir"

  # Start simple HTTP server in background
  npx --yes http-server -p $port --silent > "$log_file" 2>&1 &
  local pid=$!

  echo "  PID: $pid"
  echo "  Log: $log_file"
  echo "  URL: http://localhost:$port"
  echo ""

  # Store PID for later cleanup
  echo $pid >> "$LOG_DIR/server_pids.txt"
}

# Function to stop all servers
stop_servers() {
  local pid_file="$LOG_DIR/server_pids.txt"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🛑 Stopping servers..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Kill by PID file
  if [ -f "$pid_file" ]; then
    while read pid; do
      if kill -0 $pid 2>/dev/null; then
        echo "  Killing PID $pid"
        kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null
      fi
    done < "$pid_file"
    rm "$pid_file"
  fi

  # Kill by port for all configured repositories
  for i in "${!REPOS[@]}"; do
    port="${PORTS[$i]}"
    if lsof -ti:$port > /dev/null 2>&1; then
      echo "  Killing process on port $port"
      lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
  done

  echo "✅ All servers stopped"
}

# Trap to ensure servers are stopped on exit
trap stop_servers EXIT

# Step 1: Build production bundles
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Building production bundles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
for i in "${!REPOS[@]}"; do
  build_repo "${REPOS[$i]}" "${LABELS[$i]}"
done

# Step 2: Start servers
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting production servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Clean up old PID file
rm -f "$LOG_DIR/server_pids.txt"

for i in "${!REPOS[@]}"; do
  start_server "${REPOS[$i]}" "${PORTS[$i]}" "${LABELS[$i]}"
done

echo "⏳ Waiting 5 seconds for servers to be ready..."
sleep 5

# Check if servers are responding
for i in "${!REPOS[@]}"; do
  port="${PORTS[$i]}"
  label="${LABELS[$i]}"
  if curl -s "http://localhost:$port" > /dev/null 2>&1; then
    echo "✅ Port $port ($label) is responding"
  else
    echo "⚠️  Port $port ($label) may not be ready yet"
  fi
done

echo ""

# Step 3: Run end-to-end benchmarks
cd "$BENCHMARKS_DIR/end-to-end"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Running CRAM Benchmarks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./run_all_cram.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Running BAM Benchmarks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./run_all_bam.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All benchmarks completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Results saved:"
echo "   - JSON results: benchmarks/end-to-end/results/*.json"
echo "   - Markdown reports: benchmarks/end-to-end/results/*.md"
echo "   - Screenshots: benchmarks/end-to-end/screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
