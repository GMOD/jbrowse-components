#!/bin/bash

# Benchmark configuration
# Edit this file to change which branches and ports are tested

# Branch names (use git branch names or commit SHAs)
export BRANCH1="newopts"
export BRANCH2="main"
export BRANCH3=""  # Leave empty to disable third branch

# Port assignments
export PORT1=3000
export PORT2=3001
export PORT3=3002

# Labels default to branch names but can be overridden
export LABEL1="${LABEL1:-$BRANCH1}"
export LABEL2="${LABEL2:-$BRANCH2}"
export LABEL3="${LABEL3:-$BRANCH3}"

# Repository paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$(dirname "$BASE_DIR")"

export REPO1="$SRC_DIR/jbrowse-components"
export REPO2="$SRC_DIR/jbrowse-components2"
export REPO3="$SRC_DIR/jbrowse-components3"
