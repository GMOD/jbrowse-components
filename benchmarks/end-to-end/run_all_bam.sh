#!/bin/bash

set -e

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration and helper functions
source "$BENCH_DIR/../config.sh"
source "$BENCH_DIR/benchmark_runner.sh"

# Create results directory
mkdir -p "$BENCH_DIR/results" "$BENCH_DIR/screenshots"

echo "🚀 Running BAM benchmarks with hyperfine"
echo ""
echo "Testing branches:"
echo "  - ${LABEL1} (port ${PORT1})"
echo "  - ${LABEL2} (port ${PORT2})"
echo "  - ${LABEL3} (port ${PORT3})"
echo ""
echo "Configuration: ${HYPERFINE_WARMUP} warmup runs, ${HYPERFINE_RUNS} benchmark runs"
echo ""

# Run benchmarks
run_benchmark "bench_longread_bam.mjs" "200x longread BAM"
run_benchmark "bench_shortread_bam.mjs" "200x shortread BAM"
run_benchmark "bench_large_region_bam.mjs" "20x longread BAM - large region"
run_benchmark "bench_20x_shortread_large_bam.mjs" "20x shortread BAM - large region"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All benchmarks completed!"
echo "📁 Results: results/*.json | results/*.md | screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
