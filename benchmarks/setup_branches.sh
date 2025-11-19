#!/bin/bash

# Branch Setup and Server Management Script
# Sets up multiple JBrowse instances for benchmarking different branches

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
source "$SCRIPT_DIR/config.sh"

# Allow command line overrides
BRANCH1="${1:-$BRANCH1}"
BRANCH2="${2:-$BRANCH2}"
BRANCH3="${3:-$BRANCH3}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 JBrowse Benchmark Branch Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Branch 1: $BRANCH1 → Port $PORT1 ($REPO1)"
echo "Branch 2: $BRANCH2 → Port $PORT2 ($REPO2)"
if [ -n "$BRANCH3" ]; then
  echo "Branch 3: $BRANCH3 → Port $PORT3 ($REPO3)"
fi
echo ""

# Function to setup a repository
setup_repo() {
  local repo_path=$1
  local branch=$2
  local repo_num=$3

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Setting up repository $repo_num: $repo_path"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Clone if doesn't exist, otherwise just cd
  if [ ! -d "$repo_path" ]; then
    echo "Cloning repository..."
    git clone "$REPO1" "$repo_path"
  fi

  cd "$repo_path"

  # Fetch latest
  echo "Fetching latest changes..."
  git fetch origin

  # Checkout branch
  echo "Checking out branch: $branch"
  git checkout "$branch"
  git pull origin "$branch" || echo "Note: Could not pull (might be detached or local branch)"

  # Install dependencies
  echo "Installing dependencies..."
  yarn install

  echo "✅ Repository $repo_num setup complete"
  echo ""
}

# Setup repositories
setup_repo "$REPO1" "$BRANCH1" "1"
setup_repo "$REPO2" "$BRANCH2" "2"

if [ -n "$BRANCH3" ]; then
  setup_repo "$REPO3" "$BRANCH3" "3"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All repositories setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Run: ./benchmarks/start_servers.sh"
echo "2. Then run benchmarks: ./benchmarks/run_all_benchmarks.sh"
echo ""
