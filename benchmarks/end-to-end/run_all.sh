#!/bin/bash

# Load configuration if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../config.sh"

if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
  # Export for node process
  export PORT1 PORT2 PORT3 LABEL1 LABEL2 LABEL3
fi

echo "🚀 Running comprehensive end-to-end benchmarks..."
echo ""
echo "Testing branches:"
echo "  - ${LABEL1:-Branch 1} (port ${PORT1:-3000})"
echo "  - ${LABEL2:-Branch 2} (port ${PORT2:-3001})"
echo "  - ${LABEL3:-Branch 3} (port ${PORT3:-3002})"
echo ""

# Test 200x longread
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Testing 200x longread"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LONGREAD_OUTPUT=$(node bench_with_profiling.mjs longread 200x 2>&1)
LONGREAD_RESULT=$?
echo "$LONGREAD_OUTPUT"
LONGREAD_FASTEST=$(echo "$LONGREAD_OUTPUT" | grep "FASTEST=" | cut -d'=' -f2)
echo ""

# Test 200x shortread
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Testing 200x shortread"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SHORTREAD_OUTPUT=$(node bench_with_profiling.mjs shortread 200x 2>&1)
SHORTREAD_RESULT=$?
echo "$SHORTREAD_OUTPUT"
SHORTREAD_FASTEST=$(echo "$SHORTREAD_OUTPUT" | grep "FASTEST=" | cut -d'=' -f2)
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏆 OVERALL SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $LONGREAD_RESULT -eq 0 ]; then
  echo "✅ 200x longread:  🥇 ${LONGREAD_FASTEST}"
else
  echo "❌ 200x longread:  Failed"
fi

if [ $SHORTREAD_RESULT -eq 0 ]; then
  echo "✅ 200x shortread: 🥇 ${SHORTREAD_FASTEST}"
else
  echo "❌ 200x shortread: Failed"
fi

echo ""
echo "📁 Results saved:"
echo "   - Detailed metrics: results_*.json"
echo "   - Screenshots: screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
