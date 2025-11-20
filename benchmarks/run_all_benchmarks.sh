#!/bin/bash

# Puppeteer end-to-end benchmark runner
# Builds, starts servers, runs benchmarks, and stops servers

set -e

BENCHMARKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
source "$BENCHMARKS_DIR/config.sh"

LOG_DIR="$BENCHMARKS_DIR/logs"
mkdir -p "$LOG_DIR"

# Get actual branch names from git (these become the labels)
get_branch_name() {
  local repo=$1
  if [ -d "$repo/.git" ]; then
    cd "$repo"
    git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
  else
    echo "not-setup"
  fi
}

# Update labels with actual branch names
for i in "${!REPOS[@]}"; do
  idx=$((i + 1))
  actual_branch=$(get_branch_name "${REPOS[$i]}")
  export "LABEL${idx}=$actual_branch"
done

echo "🚀 JBrowse Alignments End-to-End Benchmarks (Hyperfine + Puppeteer)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Comparing $REPO_COUNT repositories:"
for i in "${!REPOS[@]}"; do
  idx=$((i + 1))
  port_var="PORT${idx}"
  label_var="LABEL${idx}"
  echo "   - Port ${!port_var}: ${!label_var}"
done
echo ""
echo "Hyperfine configuration:"
echo "   - Warmup runs: ${HYPERFINE_WARMUP:-1}"
echo "   - Benchmark runs: ${HYPERFINE_RUNS:-5}"
echo ""

# Function to build a repository
build_repo() {
  local repo_path=$1
  local label=$2

  if [ ! -d "$repo_path" ]; then
    echo "⚠️  Skipping $label: Directory not found ($repo_path)"
    return 1
  fi

  echo "Building $label..."
  cd "$repo_path/products/jbrowse-web"
  yarn build
  echo "✅ Build complete for $label"
  echo ""
}

# Function to deploy build to nginx directory
deploy_build() {
  local repo_path=$1
  local port=$2
  local label=$3
  local nginx_dir="/var/www/html/jb2/port${port}"

  if [ ! -d "$repo_path" ]; then
    echo "⚠️  Skipping $label: Directory not found ($repo_path)"
    return 1
  fi

  local build_dir="$repo_path/products/jbrowse-web/build"
  if [ ! -d "$build_dir" ]; then
    echo "⚠️  Skipping $label: Build directory not found ($build_dir)"
    return 1
  fi

  local test_data_config="$repo_path/test_data/hg19mod.json"
  if [ ! -f "$test_data_config" ]; then
    echo "⚠️  Skipping $label: test_data/hg19mod.json not found at $test_data_config"
    return 1
  fi

  echo "Deploying $label to $nginx_dir..."

  # Remove old directory and create fresh one
  sudo rm -rf "$nginx_dir"
  sudo mkdir -p "$nginx_dir"

  # Copy build to nginx directory
  sudo cp -r "$build_dir"/* "$nginx_dir/"

  # Copy test_data
  echo "  Copying test_data..."
  sudo cp -r "$repo_path/test_data" "$nginx_dir/"

  echo "  URL: http://localhost/jb2/port${port}/"
  echo ""
}

# Clear out old jb2 directory
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹 Clearing old benchmark deployments"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sudo rm -rf /var/www/html/jb2
sudo mkdir -p /var/www/html/jb2
echo "✅ Cleanup complete"
echo ""

# Step 1: Setup test data
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Setting up test data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"$BENCHMARKS_DIR/setup_test_data.sh"

# Step 2: Build production bundles
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Building production bundles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
for i in "${!REPOS[@]}"; do
  build_repo "${REPOS[$i]}" "${LABELS[$i]}"
done

# Step 3: Deploy builds to nginx
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying builds to nginx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for i in "${!REPOS[@]}"; do
  deploy_build "${REPOS[$i]}" "${PORTS[$i]}" "${LABELS[$i]}"
done

echo ""

# Step 4: Run end-to-end benchmarks
cd "$BENCHMARKS_DIR/end-to-end"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Running CRAM Benchmarks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./run_all_cram.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Running BAM Benchmarks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./run_all_bam.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All benchmarks completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Results saved:"
echo "   - JSON results: benchmarks/end-to-end/results/*.json"
echo "   - Markdown reports: benchmarks/end-to-end/results/*.md"
echo "   - Screenshots: benchmarks/end-to-end/screenshots/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
