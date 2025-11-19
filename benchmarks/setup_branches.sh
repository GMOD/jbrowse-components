#!/bin/bash

# Branch Setup and Server Management Script
# Sets up multiple JBrowse instances for benchmarking different branches

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
source "$SCRIPT_DIR/config.sh"

# Allow command line overrides for branch names
# Usage: ./setup_branches.sh [branch1] [branch2] [branch3] ...
if [ $# -gt 0 ]; then
  # Override branches from command line
  for i in "${!REPOS[@]}"; do
    if [ $# -gt $i ]; then
      idx=$((i + 1))
      export "BRANCH${idx}=${!idx}"
    fi
  done
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 JBrowse Benchmark Branch Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Setting up $REPO_COUNT repositories:"
for i in "${!REPOS[@]}"; do
  idx=$((i + 1))
  branch_var="BRANCH${idx}"
  port_var="PORT${idx}"
  echo "  Repository $idx: ${!branch_var} → Port ${!port_var} (${REPOS[$i]})"
done
echo ""

# Function to setup a repository
setup_repo() {
  local repo_path=$1
  local branch=$2
  local repo_num=$3
  local source_repo=$4

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Setting up repository $repo_num: $repo_path"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Clone if doesn't exist, otherwise just cd
  if [ ! -d "$repo_path" ]; then
    echo "Cloning repository from $source_repo..."
    git clone "$source_repo" "$repo_path"
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

# Setup all repositories
for i in "${!REPOS[@]}"; do
  idx=$((i + 1))
  branch_var="BRANCH${idx}"
  # Use first repo as source for cloning
  setup_repo "${REPOS[$i]}" "${!branch_var}" "$idx" "${REPOS[0]}"
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All repositories setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Run: ./benchmarks/start_servers.sh"
echo "2. Then run benchmarks: ./benchmarks/run_all_benchmarks.sh"
echo ""
