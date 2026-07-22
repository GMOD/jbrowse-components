#!/bin/bash
# Build every demo. Run before deploy so a broken build fails here rather than
# after half the demos are already live.
set -e
cd "$(dirname "$0")"
source ./demos.sh

build_one() {
  echo "BUILD $1"
  yarn
  yarn build
  echo "DONE BUILD $1"
}

for_each_demo build_one
