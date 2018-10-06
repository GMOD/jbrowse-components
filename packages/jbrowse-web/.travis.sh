#!/bin/bash
set -e
set +x

yarn
yarn lint
yarn test
