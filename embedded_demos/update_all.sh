#!/bin/bash
set -e
./update_demos.sh
./deploy_demos.sh
./push_demos.sh

