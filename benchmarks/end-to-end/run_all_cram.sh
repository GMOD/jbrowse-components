#!/bin/bash

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../config.sh"

if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
fi

# Validate that required branches are configured
if [ -z "$LABEL1" ] || [ -z "$LABEL2" ] || [ -z "$LABEL3" ]; then
  echo "Error: All three branches must be configured in config.sh"
  echo "Current configuration:"
  echo "  BRANCH1=${BRANCH1:-<empty>} -> LABEL1=${LABEL1:-<empty>}"
  echo "  BRANCH2=${BRANCH2:-<empty>} -> LABEL2=${LABEL2:-<empty>}"
  echo "  BRANCH3=${BRANCH3:-<empty>} -> LABEL3=${LABEL3:-<empty>}"
  echo ""
  echo "Please edit benchmarks/config.sh and set all three branches."
  exit 1
fi

# Create results directory
mkdir -p "$SCRIPT_DIR/results"
mkdir -p "$SCRIPT_DIR/screenshots"

echo "🚀 Running CRAM benchmarks with hyperfine"
echo ""
echo "Testing branches:"
echo "  - ${LABEL1} (port ${PORT1})"
echo "  - ${LABEL2} (port ${PORT2})"
echo "  - ${LABEL3} (port ${PORT3})"
echo ""
echo "Configuration:"
echo "  - Warmup runs: ${HYPERFINE_WARMUP}"
echo "  - Benchmark runs: ${HYPERFINE_RUNS}"
echo ""

# Helper function to run hyperfine for a benchmark
run_benchmark() {
  local benchmark_script=$1
  local benchmark_name=$2
  local result_file="$SCRIPT_DIR/results/$(basename "$benchmark_script" .mjs).json"
  local export_markdown="$SCRIPT_DIR/results/$(basename "$benchmark_script" .mjs).md"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 $benchmark_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Run hyperfine with all three branches
  hyperfine \
    --warmup "$HYPERFINE_WARMUP" \
    --runs "$HYPERFINE_RUNS" \
    --export-json "$result_file" \
    --export-markdown "$export_markdown" \
    --command-name "${LABEL1}" "BENCHMARK_PORT=${PORT1} BENCHMARK_LABEL=${LABEL1} node $benchmark_script" \
    --command-name "${LABEL2}" "BENCHMARK_PORT=${PORT2} BENCHMARK_LABEL=${LABEL2} node $benchmark_script" \
    --command-name "${LABEL3}" "BENCHMARK_PORT=${PORT3} BENCHMARK_LABEL=${LABEL3} node $benchmark_script"

  echo ""
}

# Run benchmarks
run_benchmark "bench_longread.mjs" "200x longread CRAM"
run_benchmark "bench_shortread.mjs" "200x shortread CRAM"
run_benchmark "bench_large_region.mjs" "20x longread CRAM - large region"
run_benchmark "bench_20x_shortread_large.mjs" "20x shortread CRAM - large region"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All benchmarks completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Results saved:"
echo "   - JSON results: results/*.json"
echo "   - Markdown reports: results/*.md"
echo "   - Screenshots: screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
