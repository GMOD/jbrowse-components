#!/bin/bash

OPTIMIZED_URL='http://localhost:3000/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=400x.longread.cram'
MASTER_URL='http://localhost:3001/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=400x.longread.cram'

RUNS=3

echo "🚀 Starting performance comparison..."
echo "Running $RUNS tests for each branch"
echo ""

master_times=()
optimized_times=()

for i in $(seq 1 $RUNS); do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 Run $i/$RUNS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  echo ""
  echo "Testing MASTER branch (port 3001)..."
  master_start=$(date +%s%3N)
  node bench_render.mjs "$MASTER_URL" "master_run_$i" 2>&1 | grep -v "Downloading"
  master_end=$(date +%s%3N)
  master_time=$((master_end - master_start))
  master_times+=($master_time)
  echo "  ✓ Completed in ${master_time}ms"

  echo ""
  echo "Testing OPTIMIZED branch (port 3000)..."
  optimized_start=$(date +%s%3N)
  node bench_render.mjs "$OPTIMIZED_URL" "optimized_run_$i" 2>&1 | grep -v "Downloading"
  optimized_end=$(date +%s%3N)
  optimized_time=$((optimized_end - optimized_start))
  optimized_times+=($optimized_time)
  echo "  ✓ Completed in ${optimized_time}ms"

  improvement=$(awk "BEGIN {printf \"%.2f\", (($master_time - $optimized_time) / $master_time) * 100}")
  echo ""
  echo "  💡 Improvement: ${improvement}%"
  echo ""
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 FINAL RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Calculate averages
master_sum=0
optimized_sum=0
for time in "${master_times[@]}"; do
  master_sum=$((master_sum + time))
done
for time in "${optimized_times[@]}"; do
  optimized_sum=$((optimized_sum + time))
done

master_avg=$((master_sum / RUNS))
optimized_avg=$((optimized_sum / RUNS))

echo "MASTER branch average:     ${master_avg}ms"
echo "OPTIMIZED branch average:  ${optimized_avg}ms"
echo ""

total_improvement=$(awk "BEGIN {printf \"%.2f\", (($master_avg - $optimized_avg) / $master_avg) * 100}")
echo "🎯 Overall Improvement: ${total_improvement}%"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cleanup
rm -f master_run_*.timeout optimized_run_*.timeout
