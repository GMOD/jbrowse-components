#!/bin/bash
set -e

JB2TMP=${JB2TMP:-~/jb2tmp}

./update_demos.sh
./deploy_demos.sh
./push_demos.sh
