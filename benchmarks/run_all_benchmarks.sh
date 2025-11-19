#!/bin/bash

# Puppeteer end-to-end benchmark runner
# Compares configured branches rendering performance

BENCHMARKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
source "$BENCHMARKS_DIR/config.sh"

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

ACTUAL_BRANCH1=$(get_branch_name "$REPO1")
ACTUAL_BRANCH2=$(get_branch_name "$REPO2")
ACTUAL_BRANCH3=$(get_branch_name "$REPO3")

# Override labels with actual branch names
export LABEL1="$ACTUAL_BRANCH1"
export LABEL2="$ACTUAL_BRANCH2"
export LABEL3="$ACTUAL_BRANCH3"

echo "🚀 JBrowse Alignments End-to-End Benchmarks (Puppeteer)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Comparing branches:"
echo "   - Port $PORT1: $LABEL1"
echo "   - Port $PORT2: $LABEL2"
echo "   - Port $PORT3: $LABEL3"
echo ""

# Run end-to-end benchmarks
cd "$BENCHMARKS_DIR/end-to-end"
./run_all.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All benchmarks completed!"
echo "📸 Screenshots saved to: benchmarks/end-to-end/screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
