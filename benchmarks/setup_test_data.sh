#!/bin/bash

# Setup test_data for benchmarking
# Downloads alignment files and creates JBrowse configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DATA_DIR="$BASE_DIR/test_data"

# Load configuration to get repositories
source "$SCRIPT_DIR/config.sh"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Setting up test_data for benchmarking"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Base URL for demo files
BASE_URL="https://jbrowse.org/demos/prof"

# Files to download
FILES=(
  "hg19mod.fa"
  "hg19mod.fa.fai"
  "20x.longread.bam"
  "20x.longread.bam.bai"
  "20x.longread.cram"
  "20x.longread.cram.crai"
  "20x.shortread.bam"
  "20x.shortread.bam.bai"
  "20x.shortread.cram"
  "20x.shortread.cram.crai"
  "200x.longread.bam"
  "200x.longread.bam.bai"
  "200x.longread.cram"
  "200x.longread.cram.crai"
  "200x.shortread.bam"
  "200x.shortread.bam.bai"
  "200x.shortread.cram"
  "200x.shortread.cram.crai"
)

# Function to download files to test_data
download_files() {
  local target_dir=$1

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📥 Downloading test data files"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  mkdir -p "$target_dir"
  cd "$target_dir"

  for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
      echo "  ✓ $file (already exists)"
    else
      echo "  Downloading $file..."
      wget -q "$BASE_URL/$file"
      echo "  ✓ $file"
    fi
  done

  echo ""
  echo "✅ All files downloaded to $target_dir"
  echo ""
}

# Function to setup JBrowse config for a repository
setup_jbrowse_config() {
  local repo_path=$1
  local label=$2

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "⚙️  Setting up JBrowse config for $label"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  local test_data_dir="$repo_path/test_data"
  local temp_dir="$repo_path/temp_jbrowse_setup"

  cd "$repo_path"

  # Create temp directory for JBrowse setup
  rm -rf "$temp_dir"
  mkdir -p "$temp_dir"

  # Add assembly
  echo "  Adding assembly hg19mod..."
  npx --yes @jbrowse/cli add-assembly \
    "$test_data_dir/hg19mod.fa" \
    --out "$temp_dir" \
    --load copy \
    --name hg19mod \
    --force

  # Add all alignment tracks
  for coverage in 20x 200x; do
    for readtype in longread shortread; do
      for format in bam cram; do
        track="${coverage}.${readtype}.${format}"
        echo "  Adding track $track..."

        npx --yes @jbrowse/cli add-track \
          "$test_data_dir/$track" \
          --out "$temp_dir" \
          --load copy \
          --trackId "$track" \
          --assemblyNames hg19mod \
          --force
      done
    done
  done

  # Move config.json to test_data as hg19mod.json
  if [ -f "$temp_dir/config.json" ]; then
    mv "$temp_dir/config.json" "$test_data_dir/hg19mod.json"
    echo "✅ Created $test_data_dir/hg19mod.json"
  fi

  # Clean up temp directory
  rm -rf "$temp_dir"

  echo ""
}

# Step 1: Download files to first repository's test_data
echo "Downloading files to $TEST_DATA_DIR..."
download_files "$TEST_DATA_DIR"

# Step 2: Setup JBrowse config for first repository
setup_jbrowse_config "$BASE_DIR" "Primary repository"

# Step 3: Copy test_data to other repositories
if [ "$REPO_COUNT" -gt 1 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 Copying test_data to other repositories"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  for i in "${!REPOS[@]}"; do
    # Skip first repo (already done)
    if [ $i -eq 0 ]; then
      continue
    fi

    repo="${REPOS[$i]}"
    label="${LABELS[$i]}"

    if [ ! -d "$repo" ]; then
      echo "⚠️  Skipping $label: Directory not found ($repo)"
      continue
    fi

    echo "  Copying to $repo/test_data..."
    rm -rf "$repo/test_data"
    cp -r "$TEST_DATA_DIR" "$repo/test_data"
    echo "  ✓ $label"
  done

  echo ""
  echo "✅ test_data copied to all repositories"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test data setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Each repository now has:"
echo "  - test_data/hg19mod.json (JBrowse config)"
echo "  - test_data/hg19mod.fa (reference genome)"
echo "  - test_data/*.{bam,cram} (alignment files)"
echo ""
