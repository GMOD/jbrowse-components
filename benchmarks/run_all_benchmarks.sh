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

# Run end-to-end benchmarks
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
