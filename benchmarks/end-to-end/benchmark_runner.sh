#!/bin/bash

# Shared benchmark runner for hyperfine
# Usage: run_benchmark <benchmark_script> <benchmark_name>

run_benchmark() {
  local benchmark_script=$1
  local benchmark_name=$2
  local result_file="$BENCH_DIR/results/$(basename "$benchmark_script" .mjs).json"
  local export_markdown="$BENCH_DIR/results/$(basename "$benchmark_script" .mjs).md"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 $benchmark_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Build hyperfine command arguments dynamically
  local hyperfine_args=(
    --warmup "$HYPERFINE_WARMUP"
    --runs "$HYPERFINE_RUNS"
    --export-json "$result_file"
    --export-markdown "$export_markdown"
  )

  # Add a command for each configured repository
  for i in "${!REPOS[@]}"; do
    idx=$((i + 1))
    port_var="PORT${idx}"
    label_var="LABEL${idx}"
    hyperfine_args+=(
      --command-name "${!label_var} (port ${!port_var})"
      "BENCHMARK_PORT=${!port_var} BENCHMARK_LABEL=${!label_var} node $benchmark_script"
    )
  done

  hyperfine "${hyperfine_args[@]}"

  echo ""
}
