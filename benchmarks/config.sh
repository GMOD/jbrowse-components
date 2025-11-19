#!/bin/bash

# Benchmark configuration
# Edit this file to change which branches and ports are tested

# Repository paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$(dirname "$BASE_DIR")"

export REPO1="$SRC_DIR/jbrowse-components"
export REPO2="$SRC_DIR/jbrowse-components2"
export REPO3="$SRC_DIR/jbrowse-components3"

# Port assignments
export PORT1=3000
export PORT2=3001
export PORT3=3002

# Auto-detect branch names from git
get_branch_name() {
  local repo=$1
  if [ -d "$repo/.git" ]; then
    (cd "$repo" && git rev-parse --abbrev-ref HEAD 2>/dev/null) || echo "unknown"
  else
    echo "not-a-repo"
  fi
}

export BRANCH1=$(get_branch_name "$REPO1")
export BRANCH2=$(get_branch_name "$REPO2")
export BRANCH3=$(get_branch_name "$REPO3")

# Labels use the detected branch names (can be overridden)
export LABEL1="${LABEL1:-$BRANCH1}"
export LABEL2="${LABEL2:-$BRANCH2}"
export LABEL3="${LABEL3:-$BRANCH3}"

# Hyperfine configuration
export HYPERFINE_WARMUP=${HYPERFINE_WARMUP:-1}    # Number of warmup runs
export HYPERFINE_RUNS=${HYPERFINE_RUNS:-5}        # Number of benchmark runs
export HYPERFINE_PREPARE=${HYPERFINE_PREPARE:-}   # Command to run before each timing run
