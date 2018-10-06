#!/bin/bash
set -e
set +x

npm install -g yarn
yarn
yarn lint
yarn test
