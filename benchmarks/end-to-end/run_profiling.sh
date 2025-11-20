#!/bin/bash

set -e

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
source "$BENCH_DIR/../config.sh"

# Create results directory
mkdir -p "$BENCH_DIR/results" "$BENCH_DIR/screenshots"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔬 Running profiled benchmarks with detailed timing breakdowns"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Testing branches:"
for i in "${!REPOS[@]}"; do
  idx=$((i + 1))
  port_var="PORT${idx}"
  label_var="LABEL${idx}"
  echo "  - ${!label_var} (port ${!port_var})"
done
echo ""

# Default to 3 runs for profiling (can override with BENCHMARK_RUNS env var)
export BENCHMARK_RUNS="${BENCHMARK_RUNS:-3}"
echo "Running ${BENCHMARK_RUNS} iterations per branch"
echo ""

# Function to run a profiling benchmark
run_profiling_benchmark() {
  local test_type=$1
  local coverage=$2
  local title=$3

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 $title"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Export ports and labels for the script
  export PORT1="${PORT1}" PORT2="${PORT2}" PORT3="${PORT3}"
  export LABEL1="${LABEL1}" LABEL2="${LABEL2}" LABEL3="${LABEL3}"

  node "$BENCH_DIR/bench_with_profiling.mjs" "$test_type" "$coverage"

  echo ""
}

# Run profiling benchmarks
run_profiling_benchmark "longread" "200x" "200x Longread CRAM (with detailed profiling)"
run_profiling_benchmark "shortread" "200x" "200x Shortread CRAM (with detailed profiling)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Profiling benchmarks completed!"
echo "📁 Detailed results saved to: results_*.json"
echo "📊 Check the timing breakdowns above to identify bottlenecks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
