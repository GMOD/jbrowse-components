#!/bin/bash
# Push the canonical configs from base/ into every demo checkout. Must run
# AFTER update_demos.sh (which pulls) and BEFORE build/deploy/push, so the
# deployed demos and the committed config actually match what's in base/.
set -e
cd "$(dirname "$0")"
source ./demos.sh

for entry in "${DEMOS[@]}"; do
  read -r repo src dest <<<"$entry"
  if [ ! -d "$JB2TMP/$repo" ]; then
    echo "SKIP $repo (not cloned, run ./clone_demos.sh)"
    continue
  fi
  if [ ! -d "$JB2TMP/$repo/$dest" ]; then
    echo "FAIL $repo: no $dest/ directory, did the repo layout change?" >&2
    exit 1
  fi
  echo "COPY $src -> $repo/$dest/"
  cp "$src" "$JB2TMP/$repo/$dest/"
done
