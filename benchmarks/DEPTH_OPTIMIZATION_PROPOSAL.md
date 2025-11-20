# ProcessDepth Optimization Using Mosdepth Algorithm

## Current Implementation Issues

The current `processDepth` implementation has O(N*M) complexity where:
- N = number of reads/features
- M = average read length

For 200× coverage with 100bp reads over a 3kb region:
- ~600 reads × ~100 positions each = ~60,000 loop iterations
- Each iteration creates bins, increments counters, checks bounds

**Profiling shows**: `processDepth` is the main performance bottleneck (60+ samples in CPU profile).

## Mosdepth Algorithm Overview

Mosdepth uses a **difference array (delta encoding)** approach:
1. Allocate array for the region
2. For each read: **increment** at start position, **decrement** at end position
3. Compute cumulative sum once to get depth at all positions

**Complexity**: O(N + R) where R = region length (single pass!)

## Proposed Implementation

### Step 1: Two-Pass Algorithm

**Pass 1: Event Recording** (mosdepth-style)
```typescript
// Initialize difference array and strand tracking
const depthDelta = new Int32Array(regionLength)
const strandDelta = {
  '-1': new Int32Array(regionLength),
  '0': new Int32Array(regionLength),
  '1': new Int32Array(regionLength),
}

// Record start/end events for each read
for (const feature of features) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1

  const startIdx = fstart - region.start
  const endIdx = fend - region.start

  // Bounds checking
  if (startIdx >= 0 && startIdx < regionLength) {
    depthDelta[startIdx]++
    strandDelta[fstrand][startIdx]++
  }

  // Note: endIdx is exclusive (read ends at fend-1)
  if (endIdx >= 0 && endIdx < regionLength) {
    depthDelta[endIdx]--
    strandDelta[fstrand][endIdx]--
  }
}
```

**Pass 2: Cumulative Sum** (compute actual depths)
```typescript
let currentDepth = 0
let currentStrand = { '-1': 0, '0': 0, '1': 0 }

for (let i = 0; i < regionLength; i++) {
  // Update running totals
  currentDepth += depthDelta[i]
  currentStrand['-1'] += strandDelta['-1'][i]
  currentStrand['0'] += strandDelta['0'][i]
  currentStrand['1'] += strandDelta['1'][i]

  // Initialize bin structure only if there's coverage
  if (currentDepth > 0) {
    bins[i] = {
      depth: currentDepth,
      readsCounted: currentDepth,
      ref: {
        probabilities: [],
        entryDepth: currentDepth,
        '-1': currentStrand['-1'],
        '0': currentStrand['0'],
        '1': currentStrand['1'],
      },
      snps: {},
      mods: {},
      nonmods: {},
      delskips: {},
      noncov: {},
    }
  }
}
```

### Step 2: Integration Points

**In `generateCoverageBins.ts`**, replace the current loop:

```typescript
// OLD (slow)
for (const feature of features) {
  processDepth({ feature, bins, region })
  processMismatches({ feature, skipmap, bins, region })
}

// NEW (fast)
processDepthOptimized({ features, bins, region })
for (const feature of features) {
  processMismatches({ feature, skipmap, bins, region })
}
```

## Performance Benefits

### Complexity Comparison

| Metric | Current (Naive) | Optimized (Mosdepth) |
|--------|-----------------|----------------------|
| **Time Complexity** | O(N × M) | O(N + R) |
| **For 200× coverage, 3kb region** | ~60,000 iterations | ~600 + 3,000 = 3,600 |
| **Speedup** | 1× | ~17× faster |
| **Memory** | Sparse array | Dense arrays (4× Int32Array) |

### Real-World Impact

From profiling data:
- Current: `processDepth` with 60 samples (most frequent function)
- Estimated: Reduce to ~3-4 samples (17× fewer iterations)
- Total render improvement: ~20-30% faster (depth is major bottleneck)

## Implementation Considerations

### 1. Strand Handling
Current code tracks strand counts. The optimized version maintains separate delta arrays for each strand.

### 2. End Position
Current code: `for (let j = fstart; j < fend + 1; j++)` with `if (j !== fend)` check
- This excludes the end position from depth counting
- Mosdepth approach: decrement at `fend` (exclusive), naturally excludes end

### 3. Bin Initialization
Current: Bins initialized on-demand during iteration
Optimized: Initialize bins only where depth > 0 in cumulative pass

### 4. Read Overlap (Paired-End)
User stated: "we do not have to avoid double counting paired end read overlap"
- Current code doesn't handle this anyway
- Mosdepth algorithm naturally counts each read independently

### 5. Memory Usage
- Current: Sparse array (only populated positions)
- Optimized: 4 dense Int32Array (depthDelta + 3 strandDelta)
- For 3kb region: ~12KB additional memory (negligible)
- Bins still sparse (only created where depth > 0)

## Recommended Implementation Strategy

### Phase 1: Create Optimized Version
```typescript
// New file: processDepthOptimized.ts
export function processDepthOptimized({
  features,
  bins,
  region,
}: {
  features: Feature[]
  bins: PreBaseCoverageBin[]
  region: AugmentedRegion
}) {
  const regionLength = region.end - region.start

  // Allocate difference arrays
  const depthDelta = new Int32Array(regionLength)
  const strandDelta = {
    '-1': new Int32Array(regionLength),
    '0': new Int32Array(regionLength),
    '1': new Int32Array(regionLength),
  }

  // Pass 1: Record events
  for (const feature of features) {
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const fstrand = feature.get('strand') as -1 | 0 | 1

    const startIdx = fstart - region.start
    const endIdx = fend - region.start

    if (startIdx >= 0 && startIdx < regionLength) {
      depthDelta[startIdx]++
      strandDelta[fstrand][startIdx]++
    }

    if (endIdx >= 0 && endIdx < regionLength) {
      depthDelta[endIdx]--
      strandDelta[fstrand][endIdx]--
    }
  }

  // Pass 2: Cumulative sum
  let depth = 0
  const strand = { '-1': 0, '0': 0, '1': 0 }

  for (let i = 0; i < regionLength; i++) {
    depth += depthDelta[i]
    strand['-1'] += strandDelta['-1'][i]
    strand['0'] += strandDelta['0'][i]
    strand['1'] += strandDelta['1'][i]

    if (depth > 0) {
      bins[i] = {
        depth,
        readsCounted: depth,
        ref: {
          probabilities: [],
          entryDepth: depth,
          '-1': strand['-1'],
          '0': strand['0'],
          '1': strand['1'],
        },
        snps: {},
        mods: {},
        nonmods: {},
        delskips: {},
        noncov: {},
      }
    }
  }
}
```

### Phase 2: Update generateCoverageBins
```typescript
// Replace processDepth loop
processDepthOptimized({ features, bins, region })

// Keep processMismatches loop (still needs per-feature iteration)
for (const feature of features) {
  // ... mods/methylation processing ...
  processMismatches({ feature, skipmap, bins, region })
}
```

### Phase 3: Testing
1. Run existing tests to ensure correctness
2. Run profiling script to measure improvement
3. Compare output with current implementation
4. Benchmark with different coverage levels (20×, 200×, 500×)

## Expected Results

Based on profiling:
- **processDepth CPU samples**: 60 → ~3-4 (17× reduction)
- **Total render time**: ~10s → ~7-8s (~25% faster)
- **Zoom operations**: Proportionally faster
- **Memory**: Negligible increase (~12KB per 3kb region)

## Alternative: Hybrid Approach

For very sparse regions (low coverage), the naive approach might be faster due to less array allocation. Consider:

```typescript
const SPARSE_THRESHOLD = 10 // coverage level

if (estimatedCoverage < SPARSE_THRESHOLD) {
  // Use current naive approach for sparse data
  for (const feature of features) {
    processDepth({ feature, bins, region })
  }
} else {
  // Use mosdepth for dense data
  processDepthOptimized({ features, bins, region })
}
```

## References

- Mosdepth paper: https://academic.oup.com/bioinformatics/article/34/5/867/4583630
- Mosdepth GitHub: https://github.com/brentp/mosdepth
- Difference array technique: Classic algorithmic pattern for range updates

## Next Steps

1. Implement `processDepthOptimized.ts`
2. Update `generateCoverageBins.ts` to use new function
3. Run test suite
4. Profile with `profile_with_zoom_interactions.mjs`
5. Compare performance metrics
6. If successful, remove old `processDepth.ts`
