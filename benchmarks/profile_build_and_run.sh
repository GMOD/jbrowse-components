#!/bin/bash

# Profile Build and Run Script
# Builds JBrowse with profiling flags (unminified) and runs Chrome DevTools profiler

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_FOLDER="${1:-port3000}"
TEST_TYPE="${2:-shortread}"
COVERAGE="${3:-200x}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔬 JBrowse Performance Profiling Pipeline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  Build folder: /var/www/html/jb2/$BUILD_FOLDER"
echo "  Test type:    $TEST_TYPE"
echo "  Coverage:     $COVERAGE"
echo ""

echo "📦 Step 1: Building with PROFILING_BUILD=true (no minification)..."
cd "$SCRIPT_DIR/../products/jbrowse-web"
export PROFILING_BUILD=true
yarn build

echo ""
echo "📁 Step 2: Deploying to /var/www/html/jb2/$BUILD_FOLDER..."
mkdir -p /var/www/html/jb2/$BUILD_FOLDER
cp -r build/* /var/www/html/jb2/$BUILD_FOLDER/

echo ""
echo "🔍 Step 3: Running Chrome DevTools profiler..."
cd "$SCRIPT_DIR/end-to-end"
node profile_chrome_devtools.mjs $TEST_TYPE $COVERAGE $BUILD_FOLDER

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Profiling complete!"
echo ""
echo "Next steps:"
echo "  1. Load the CPU profile in Chrome DevTools"
echo "  2. Look for worker thread activity and BAM/CRAM operations"
echo "  3. Identify the real bottlenecks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
