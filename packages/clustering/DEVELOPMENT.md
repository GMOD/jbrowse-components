# Development Guide for @jbrowse/clustering

## Architecture

This package uses a hybrid approach:
- **WASM (C)**: Distance matrix computation (40-72% faster than JS)
- **TypeScript**: Tree building, cluster merging, output formatting

### Why This Split?

**WASM handles:**
- ✅ `euclideanDistance()` - Tight numeric loops
- ✅ `computeDistanceMatrix()` - O(n²) computation bottleneck
- ✅ `averageDistance()` - Called many times during clustering

**JavaScript/TypeScript handles:**
- ✅ Tree structure manipulation (dynamic objects/arrays)
- ✅ Cluster merging logic
- ✅ Output formatting (Newick, JSON, text)
- ✅ Progress tracking and cancellation

## Performance Benchmarks

From testing (see `/benchmark_wasm.js` in project root):

| Samples | JS Baseline | WASM f32 | Improvement |
|---------|------------|----------|-------------|
| 50      | 31.64ms    | 17.30ms  | 45.33%      |
| 100     | 30.23ms    | 16.74ms  | 44.61%      |
| 200     | 14.87ms    | 4.13ms   | **72.24%**  |
| 500     | 14.11ms    | 6.29ms   | 55.46%      |
| 1000    | 18.21ms    | 10.91ms  | 40.11%      |

## Building

### Prerequisites

Emscripten SDK must be installed and activated:

```bash
cd ~/emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

Or use the provided script:

```bash
bash ../setup_emscripten.sh
```

### Build Commands

```bash
# Build WASM module only
yarn build:wasm

# Build entire package (WASM + TypeScript)
yarn build

# Clean build artifacts
yarn clean
```

## File Structure

```
packages/clustering/
├── src/
│   ├── wasm/
│   │   ├── distance.c          # C source for WASM
│   │   ├── distance.js         # Emscripten-generated JS glue
│   │   └── distance.wasm       # Compiled WASM binary
│   ├── wasm-wrapper.ts         # TypeScript wrapper for WASM
│   ├── cluster.ts              # Main clustering algorithm
│   ├── tree-utils.ts           # Tree output formatting
│   ├── types.ts                # TypeScript type definitions
│   └── index.ts                # Package exports
├── scripts/
│   └── build_wasm.sh           # WASM build script
├── example.js                  # Usage example
└── package.json
```

## C Code Optimizations

The C code includes several optimizations:

1. **Loop unrolling** - `euclideanDistance()` unrolls by 4
2. **Float32** - Uses `float` instead of `double` for better cache usage
3. **Const pointers** - Allows compiler optimizations
4. **Inlined operations** - No function call overhead in tight loops

## Emscripten Compiler Flags

```bash
emcc distance.c \
  -O3                              # Maximum optimization
  -s WASM=1                        # Output WASM
  -s ALLOW_MEMORY_GROWTH=1         # Dynamic memory
  -s INITIAL_MEMORY=64MB           # Start with 64MB
  -s MAXIMUM_MEMORY=2GB            # Allow up to 2GB
  -s MODULARIZE=1                  # ES6 module
  -s EXPORT_ES6=1                  # ES6 exports
```

## Future Optimizations

Potential improvements:
- [ ] SIMD vectorization for distance calculations
- [ ] Parallel distance matrix computation
- [ ] Incremental clustering for very large datasets
- [ ] Additional linkage methods (single, complete, ward)
- [ ] Different distance metrics (Manhattan, cosine, etc.)

## Testing

```bash
# Run tests
yarn test

# Run with coverage
yarn coverage

# Try the example
node example.js
```
