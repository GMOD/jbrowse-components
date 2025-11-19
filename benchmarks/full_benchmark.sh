#!/bin/bash

# Complete benchmark automation script
# Sets up branches, starts servers, runs benchmarks, and stops servers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
source "$SCRIPT_DIR/config.sh"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Complete JBrowse Benchmark Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  Branch 1: $BRANCH1 ($LABEL1) → Port $PORT1"
echo "  Branch 2: $BRANCH2 ($LABEL2) → Port $PORT2"
if [ -n "$BRANCH3" ]; then
  echo "  Branch 3: $BRANCH3 ($LABEL3) → Port $PORT3"
fi
echo ""
echo "This will:"
echo "  1. Setup/update repositories"
echo "  2. Install dependencies"
echo "  3. Start dev servers"
echo "  4. Run benchmarks"
echo "  5. Stop servers"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Step 1: Setup branches
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Setting up branches"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -n "$BRANCH3" ]; then
  "$SCRIPT_DIR/setup_branches.sh" "$BRANCH1" "$BRANCH2" "$BRANCH3"
else
  "$SCRIPT_DIR/setup_branches.sh" "$BRANCH1" "$BRANCH2"
fi

# Step 2: Start servers
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Starting dev servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"$SCRIPT_DIR/start_servers.sh"

# Step 3: Run benchmarks
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Running benchmarks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"$SCRIPT_DIR/run_all_benchmarks.sh"

# Step 4: Stop servers
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Stopping servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"$SCRIPT_DIR/stop_servers.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Complete benchmark suite finished!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Results:"
echo "  - Detailed metrics: benchmarks/end-to-end/results_*.json"
echo "  - Screenshots: benchmarks/end-to-end/screenshots/"
echo "  - Server logs: benchmarks/logs/"
echo ""
