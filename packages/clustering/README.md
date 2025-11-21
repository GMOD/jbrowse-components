# @jbrowse/clustering

High-performance hierarchical clustering using WebAssembly.

This package provides fast hierarchical clustering algorithms compiled from C to WebAssembly, with JavaScript/TypeScript wrappers for easy integration.

## Features

- **Fast distance matrix computation** using WASM (40-72% faster than pure JavaScript)
- **Float32 precision** for memory efficiency
- **Hierarchical clustering** with average linkage
- **Multiple output formats** including Newick, JSON, and tree visualization

## Performance

Based on benchmarks, WASM implementation provides:
- 40-72% speedup for distance matrix computation
- Efficient memory usage with Float32Array
- No JIT warmup needed

## Usage

```typescript
import { clusterData, printTree, toNewick } from '@jbrowse/clustering'

const data = [
  [1.0, 2.0, 3.0],
  [1.5, 2.5, 3.5],
  [10.0, 11.0, 12.0],
]

const result = await clusterData(data)

// Print tree structure
printTree(result.tree, ['Sample A', 'Sample B', 'Sample C'])

// Get Newick format
const newick = toNewick(result.tree)
```
