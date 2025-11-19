#!/bin/bash

# Shared benchmark runner for hyperfine
# Usage: run_benchmark <benchmark_script> <benchmark_name>

run_benchmark() {
  local benchmark_script=$1
  local benchmark_name=$2
  local result_file="$SCRIPT_DIR/results/$(basename "$benchmark_script" .mjs).json"
  local export_markdown="$SCRIPT_DIR/results/$(basename "$benchmark_script" .mjs).md"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 $benchmark_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

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
