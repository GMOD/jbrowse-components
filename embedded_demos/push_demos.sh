#!/bin/bash
# Commit and push whatever update_demos.sh and copy_files.sh changed.
#
# The old version only staged yarn.lock, so config.ts edits copied in from base/
# went live on the deployed demo but never landed in the repo people clone.
set -e
cd "$(dirname "$0")"
source ./demos.sh

push_one() {
  local repo=$1
  echo "PUSH $repo"
  git add -A
  if git diff --cached --quiet; then
    echo "SKIP $repo (nothing changed)"
    return
  fi
  git commit -m "Update deps and config for the latest @jbrowse release"
  git push
  echo "DONE PUSH $repo"
}

for_each_demo push_one
