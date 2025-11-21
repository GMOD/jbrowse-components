#!/bin/bash
set -e

echo "Building WASM module for clustering..."

# Source emscripten environment
source ~/emsdk/emsdk_env.sh

# Navigate to the wasm directory
cd "$(dirname "$0")/../src/wasm"

# Compile C to WASM
emcc distance.c \
  -O3 \
  -s WASM=1 \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=64MB \
  -s MAXIMUM_MEMORY=2GB \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME='createClusteringModule' \
  -s ENVIRONMENT='web,node' \
  -o distance.js

echo "WASM module built successfully!"
echo "Output files:"
echo "  - src/wasm/distance.js"
echo "  - src/wasm/distance.wasm"
