#!/bin/bash

echo "🚀 Running comprehensive end-to-end benchmarks..."
echo ""

# Test 200x longread
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Testing 200x longread"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node bench_with_profiling.mjs longread 200x
LONGREAD_RESULT=$?
echo ""

# Test 200x shortread
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Testing 200x shortread"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node bench_with_profiling.mjs shortread 200x
SHORTREAD_RESULT=$?
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $LONGREAD_RESULT -eq 0 ]; then
  echo "✅ 200x longread: FASTER"
else
  echo "❌ 200x longread: SLOWER"
fi

if [ $SHORTREAD_RESULT -eq 0 ]; then
  echo "✅ 200x shortread: FASTER"
else
  echo "❌ 200x shortread: SLOWER"
fi

echo ""
echo "Detailed results saved to results_*.json files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
