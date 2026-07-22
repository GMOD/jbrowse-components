#!/bin/bash
# Clone every demo repo into $JB2TMP. Idempotent: already-cloned repos are left
# alone, so this is safe to re-run before a release.
set -e
cd "$(dirname "$0")"
source ./demos.sh

mkdir -p "$JB2TMP"
for entry in "${DEMOS[@]}"; do
  read -r repo _ _ <<<"$entry"
  if [ -d "$JB2TMP/$repo" ]; then
    echo "HAVE $repo"
  else
    echo "CLONE $repo"
    git clone "git@github.com:GMOD/$repo" "$JB2TMP/$repo"
  fi
done
