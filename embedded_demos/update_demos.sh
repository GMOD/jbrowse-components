#!/bin/bash
# Pull each demo repo and bump its deps to the just-published @jbrowse packages.
#
# Refuses to run on a dirty checkout rather than stashing. The previous version
# stashed and never popped, which silently discarded the config.ts that
# copy_files.sh had just written.
set -e
cd "$(dirname "$0")"
source ./demos.sh

update_one() {
  local repo=$1
  echo "UPDATE $repo"
  if [ -n "$(git status --porcelain)" ]; then
    echo "FAIL $repo has uncommitted changes:" >&2
    git status --short >&2
    echo "commit or discard them, then re-run" >&2
    exit 1
  fi
  git pull --ff-only
  yarn
  yarn upgrade
  echo "DONE UPDATE $repo"
}

for_each_demo update_one
