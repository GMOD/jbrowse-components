#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration and helper functions
source "$SCRIPT_DIR/../config.sh"
source "$SCRIPT_DIR/benchmark_runner.sh"

# Create results directory
mkdir -p "$SCRIPT_DIR/results" "$SCRIPT_DIR/screenshots"

echo "🚀 Running CRAM benchmarks with hyperfine"
echo ""
echo "Testing branches:"
echo "  - ${LABEL1} (port ${PORT1})"
echo "  - ${LABEL2} (port ${PORT2})"
echo "  - ${LABEL3} (port ${PORT3})"
echo ""
echo "Configuration: ${HYPERFINE_WARMUP} warmup runs, ${HYPERFINE_RUNS} benchmark runs"
echo ""

# Run benchmarks
run_benchmark "bench_longread.mjs" "200x longread CRAM"
run_benchmark "bench_shortread.mjs" "200x shortread CRAM"
run_benchmark "bench_large_region.mjs" "20x longread CRAM - large region"
run_benchmark "bench_20x_shortread_large.mjs" "20x shortread CRAM - large region"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All benchmarks completed!"
echo "📁 Results: results/*.json | results/*.md | screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
