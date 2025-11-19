#!/bin/bash

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../config.sh"

if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
fi

# Create results directory
mkdir -p "$SCRIPT_DIR/results"
mkdir -p "$SCRIPT_DIR/screenshots"

echo "🚀 Running BAM benchmarks with hyperfine"
echo ""
echo "Testing branches:"
[ -n "$BRANCH1" ] && echo "  - ${LABEL1} (port ${PORT1})"
[ -n "$BRANCH2" ] && echo "  - ${LABEL2} (port ${PORT2})"
[ -n "$BRANCH3" ] && echo "  - ${LABEL3} (port ${PORT3})"
echo ""
echo "Configuration:"
echo "  - Warmup runs: ${HYPERFINE_WARMUP}"
echo "  - Benchmark runs: ${HYPERFINE_RUNS}"
echo ""

# Build branch list for hyperfine
BRANCHES=()
PORTS=()
LABELS=()
[ -n "$BRANCH1" ] && BRANCHES+=("$BRANCH1") && PORTS+=("$PORT1") && LABELS+=("$LABEL1")
[ -n "$BRANCH2" ] && BRANCHES+=("$BRANCH2") && PORTS+=("$PORT2") && LABELS+=("$LABEL2")
[ -n "$BRANCH3" ] && BRANCHES+=("$BRANCH3") && PORTS+=("$PORT3") && LABELS+=("$LABEL3")

# Helper function to run hyperfine for a benchmark
run_benchmark() {
  local benchmark_script=$1
  local benchmark_name=$2
  local result_file="$SCRIPT_DIR/results/$(basename "$benchmark_script" .mjs).json"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 $benchmark_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Build hyperfine commands for each branch
  local commands=()
  for i in "${!BRANCHES[@]}"; do
    commands+=("BENCHMARK_PORT=${PORTS[$i]} BENCHMARK_LABEL=${LABELS[$i]} node $benchmark_script")
  done

  # Build hyperfine parameter lists
  local export_markdown="$SCRIPT_DIR/results/$(basename "$benchmark_script" .mjs).md"

  # Run hyperfine with all branches
  hyperfine \
    --warmup "$HYPERFINE_WARMUP" \
    --runs "$HYPERFINE_RUNS" \
    --export-json "$result_file" \
    --export-markdown "$export_markdown" \
    --command-name "${LABELS[0]}" "${commands[0]}" \
    $([ ${#commands[@]} -gt 1 ] && echo "--command-name \"${LABELS[1]}\" \"${commands[1]}\"") \
    $([ ${#commands[@]} -gt 2 ] && echo "--command-name \"${LABELS[2]}\" \"${commands[2]}\"")

  echo ""
}

# Run benchmarks
run_benchmark "bench_longread_bam.mjs" "200x longread BAM"
run_benchmark "bench_shortread_bam.mjs" "200x shortread BAM"
run_benchmark "bench_large_region_bam.mjs" "20x longread BAM - large region"
run_benchmark "bench_20x_shortread_large_bam.mjs" "20x shortread BAM - large region"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All benchmarks completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Results saved:"
echo "   - JSON results: results/*.json"
echo "   - Markdown reports: results/*.md"
echo "   - Screenshots: screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
