#!/bin/bash
# Full release pass over the embedded demos. Run after the @jbrowse packages are
# published to npm.
#
# Order matters: pull first (update_demos refuses to run on a dirty tree), then
# stamp the canonical configs in, then build so a breakage surfaces before
# anything ships, then deploy and finally commit what changed.
set -e
cd "$(dirname "$0")"

./clone_demos.sh
./update_demos.sh
./copy_files.sh
./build_demos.sh
./deploy_demos.sh
./push_demos.sh
