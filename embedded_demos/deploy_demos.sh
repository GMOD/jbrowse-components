#!/bin/bash
set -e
cd "$(dirname "$0")"
source ./demos.sh

deploy_one() {
  echo "DEPLOY $1"
  yarn deploy
  echo "DONE DEPLOY $1"
}

for_each_demo deploy_one
