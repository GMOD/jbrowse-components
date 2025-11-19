#!/bin/bash

# Load configuration if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../config.sh"

if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
  # Export for node process
  export PORT1 PORT2 PORT3 LABEL1 LABEL2 LABEL3
fi

# Set default number of runs if not specified
export BENCHMARK_RUNS=${BENCHMARK_RUNS:-5}

echo "🚀 Running comprehensive end-to-end BAM benchmarks..."
echo ""
echo "Testing branches:"
echo "  - ${LABEL1:-Branch 1} (port ${PORT1:-3000})"
echo "  - ${LABEL2:-Branch 2} (port ${PORT2:-3001})"
echo "  - ${LABEL3:-Branch 3} (port ${PORT3:-3002})"
echo ""
echo "Configuration:"
echo "  - Runs per test: ${BENCHMARK_RUNS}"
echo ""

# Test 200x longread BAM
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Testing 200x longread BAM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LONGREAD_OUTPUT=$(node bench_longread_bam.mjs 2>&1)
LONGREAD_RESULT=$?
echo "$LONGREAD_OUTPUT"
echo ""

# Test 200x shortread BAM
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Testing 200x shortread BAM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SHORTREAD_OUTPUT=$(node bench_shortread_bam.mjs 2>&1)
SHORTREAD_RESULT=$?
echo "$SHORTREAD_OUTPUT"
echo ""

# Test 20x longread BAM - large region
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Testing 20x longread BAM - large region"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LONGREAD_LARGE_OUTPUT=$(node bench_large_region_bam.mjs 2>&1)
LONGREAD_LARGE_RESULT=$?
echo "$LONGREAD_LARGE_OUTPUT"
LONGREAD_LARGE_FASTEST=$(echo "$LONGREAD_LARGE_OUTPUT" | grep "FASTEST=" | cut -d'=' -f2)
echo ""

# Test 20x shortread BAM - large region
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Testing 20x shortread BAM - large region"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SHORTREAD_LARGE_OUTPUT=$(node bench_20x_shortread_large_bam.mjs 2>&1)
SHORTREAD_LARGE_RESULT=$?
echo "$SHORTREAD_LARGE_OUTPUT"
SHORTREAD_LARGE_FASTEST=$(echo "$SHORTREAD_LARGE_OUTPUT" | grep "FASTEST=" | cut -d'=' -f2)
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏆 OVERALL SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $LONGREAD_RESULT -eq 0 ]; then
  echo "✅ 200x longread BAM:              Completed"
else
  echo "❌ 200x longread BAM:              Failed"
fi

if [ $SHORTREAD_RESULT -eq 0 ]; then
  echo "✅ 200x shortread BAM:             Completed"
else
  echo "❌ 200x shortread BAM:             Failed"
fi

if [ $LONGREAD_LARGE_RESULT -eq 0 ]; then
  echo "✅ 20x longread BAM large region:  🥇 ${LONGREAD_LARGE_FASTEST}"
else
  echo "❌ 20x longread BAM large region:  Failed"
fi

if [ $SHORTREAD_LARGE_RESULT -eq 0 ]; then
  echo "✅ 20x shortread BAM large region: 🥇 ${SHORTREAD_LARGE_FASTEST}"
else
  echo "❌ 20x shortread BAM large region: Failed"
fi

echo ""
echo "📁 Results saved:"
echo "   - Screenshots: screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
