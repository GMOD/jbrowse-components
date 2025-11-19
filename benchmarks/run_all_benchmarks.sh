#!/bin/bash

# Puppeteer end-to-end benchmark runner
# Compares master vs optimized branch rendering performance
# Requires: JBrowse running on port 3000 (optimized) and 3001 (master)

BENCHMARKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 JBrowse Alignments End-to-End Benchmarks (Puppeteer)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Prerequisites:"
echo "   - JBrowse running on port 3000 (optimized branch)"
echo "   - JBrowse running on port 3001 (master branch)"
echo ""

# Run end-to-end benchmarks
cd "$BENCHMARKS_DIR/end-to-end"
./run_all.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All benchmarks completed!"
echo "📸 Screenshots saved to: benchmarks/end-to-end/screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
