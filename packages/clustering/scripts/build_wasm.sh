#!/bin/bash
set -e

echo "Building WASM module for clustering..."

# Source emscripten environment
source ~/emsdk/emsdk_env.sh

# Navigate to the wasm directory
cd "$(dirname "$0")/../src/wasm"

# Compile C to WASM with inline base64
emcc distance.c \
  -O3 \
  -s WASM=1 \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","getValue","setValue","HEAPF32","HEAP32","HEAPF64","addFunction","removeFunction"]' \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_hierarchicalCluster","_setProgressCallback"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=64MB \
  -s MAXIMUM_MEMORY=2GB \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME='createClusteringModule' \
  -s ENVIRONMENT='web,worker' \
  -s SINGLE_FILE=1 \
  -s ALLOW_TABLE_GROWTH=1 \
  -o distance.js

echo "WASM module built successfully!"
echo "Output file (with inlined WASM):"
echo "  - src/wasm/distance.js"
