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

# Branch labels (used in benchmark output)
export LABEL1="Optimized"
export LABEL2="Master"
export LABEL3="Experimental"

# Repository paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$(dirname "$BASE_DIR")"

export REPO1="$SRC_DIR/jbrowse-components"
export REPO2="$SRC_DIR/jbrowse-components2"
export REPO3="$SRC_DIR/jbrowse-components3"
