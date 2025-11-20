#!/bin/bash

# Benchmark configuration
# Edit this file to change which branches and ports are tested

# Repository paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOME_DIR="$HOME"

# Default repositories - can be overridden via BENCHMARK_REPOS environment variable
# Format: space-separated list of repository paths
# Example: BENCHMARK_REPOS="/path/to/repo1 /path/to/repo2 /path/to/repo3"
DEFAULT_REPOS="$HOME_DIR/src/jbrowse-components $HOME_DIR/src/jbrowse-components2"
BENCHMARK_REPOS="${BENCHMARK_REPOS:-$DEFAULT_REPOS}"

# Convert space-separated repos to array
IFS=' ' read -r -a REPOS <<< "$BENCHMARK_REPOS"

# Nginx base path for deployments
export NGINX_BASE_PATH="/var/www/html/jb2"

# Auto-detect branch names from git
get_branch_name() {
  local repo=$1
  if [ -d "$repo/.git" ]; then
    (cd "$repo" && git rev-parse --abbrev-ref HEAD 2>/dev/null) || echo "unknown"
  else
    echo "not-a-repo"
  fi
}

# Build arrays of branches and labels
BRANCHES=()
LABELS=()

for i in "${!REPOS[@]}"; do
  repo="${REPOS[$i]}"
  branch=$(get_branch_name "$repo")
  label="${branch}"

  BRANCHES+=("$branch")
  LABELS+=("$label")
done

# Export arrays and count
export REPO_COUNT=${#REPOS[@]}

# Export individual values for backwards compatibility and easy access
for i in "${!REPOS[@]}"; do
  idx=$((i + 1))
  export "REPO${idx}=${REPOS[$i]}"
  export "BRANCH${idx}=${BRANCHES[$i]}"
  export "LABEL${idx}=${LABELS[$i]}"
done

# Validate that at least two repositories are configured
if [ "$REPO_COUNT" -lt 2 ]; then
  echo "Error: At least two repositories must be configured for benchmarking"
  echo "Current configuration:"
  for i in "${!REPOS[@]}"; do
    idx=$((i + 1))
    echo "  REPO${idx}: ${REPOS[$i]} -> Branch: ${BRANCHES[$i]}"
  done
  echo ""
  echo "Set BENCHMARK_REPOS environment variable to configure repositories:"
  echo "  export BENCHMARK_REPOS=\"/path/to/repo1 /path/to/repo2\""
  exit 1
fi

# Hyperfine configuration
export HYPERFINE_WARMUP=${HYPERFINE_WARMUP:-1}    # Number of warmup runs
export HYPERFINE_RUNS=${HYPERFINE_RUNS:-5}        # Number of benchmark runs
export HYPERFINE_PREPARE=${HYPERFINE_PREPARE:-}   # Command to run before each timing run
