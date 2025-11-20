# Performance Profiling Guide

This guide explains how to use Chrome DevTools profiling to identify bottlenecks in BAM/CRAM data parsing.

## Quick Start

**Recommended:** Use the automated profiling pipeline:

```bash
cd benchmarks
chmod +x profile_build_and_run.sh
./profile_build_and_run.sh port3000 shortread 200x
```

This will:
1. Build JBrowse with `PROFILING_BUILD=true` (disables minification for readable function names)
2. Deploy to `/var/www/html/jb2/port3000/`
3. Run Chrome DevTools profiler
4. Save CPU profile to `end-to-end/results/`

**Manual approach:**

```bash
# Build with profiling flag
cd products/jbrowse-web
PROFILING_BUILD=true yarn build

# Deploy
cp -r build/* /var/www/html/jb2/port3000/

# Run profiler
cd ../../benchmarks/end-to-end
node profile_chrome_devtools.mjs shortread 200x port3000
```

## What Gets Measured

The profiling system instruments the entire data pipeline with detailed timing breakdowns:

### High-Level Metrics
- **Total Time**: End-to-end time from navigation to render complete
- **Render Time**: Time spent in rendering phase
- **Memory**: JavaScript heap usage
- **FPS**: Frame rate statistics

### Detailed Timing Breakdown

The instrumentation tracks these specific stages:

1. **BAM/CRAM Fetch Time** (`bamCramFetchTime`)
   - Time spent fetching and decompressing BAM/CRAM records
   - Includes network I/O, index lookups, and BGZF/CRAM decompression
   - **This is often the biggest bottleneck** (10-15 seconds typically)

2. **Process Depth** (`depthTime`)
   - Time spent counting read depth per genomic position
   - Hot loop that iterates over every base in every read
   - Allocation of coverage bins

3. **Process Mismatches** (`mismatchesTime`)
   - Time spent parsing and storing SNPs, insertions, deletions
   - Processes the mismatch array for each feature

4. **Modifications** (`modificationsTime`)
   - Time spent processing base modifications (e.g., 5mC methylation)
   - Only applies when `colorBy.type === 'modifications'`

5. **Methylation** (`methylationTime`)
   - Time spent processing CpG methylation data
   - Only applies when `colorBy.type === 'methylation'`

6. **Fetch Sequence** (`fetchSequenceTime`)
   - Time spent fetching reference sequence for the region
   - Required for modifications/methylation processing

7. **Post-process** (`postProcessTime`)
   - Time spent calculating average modification probabilities
   - Sparse array cleanup

8. **Emit Features** (`emitTime`)
   - Time spent creating feature objects and emitting to observers
   - Usually negligible

9. **Feature Count** (`featureCount`)
   - Total number of alignment features processed

## Interpreting Results

### Example Output

```
🥇 bench_branch:
   Total time:   13318.00ms (±243.00ms)
   Render time:  152.34ms (±12.45ms)
   Memory:       245.67 MB
   Avg FPS:      58.23
   📊 Timing Breakdown:
      BAM/CRAM Fetch:   12850.45ms
      Process Depth:    32.12ms
      Mismatches:       15.23ms
      Post-process:     2.34ms
      Emit Features:    1.12ms
      Feature Count:    15234
```

### What This Tells Us

In this example:
- **96% of time** is spent in BAM/CRAM fetching (12.85s out of 13.3s)
- Only **4%** is spent in actual parsing and processing
- **Conclusion**: Optimizing the parsing code won't help much; need to optimize:
  - File I/O and decompression
  - Index usage
  - Caching strategies
  - Parallel fetching

### Common Patterns

**Network/I/O Bound** (most common):
```
BAM/CRAM Fetch:   12000ms  ← 95% of time
Process Depth:       50ms
Mismatches:          30ms
Post-process:        10ms
```
→ Focus on: file format optimization, compression, caching, prefetching

**CPU Bound** (rare):
```
BAM/CRAM Fetch:    500ms
Process Depth:    8000ms  ← 90% of time
Mismatches:       1200ms
Post-process:      300ms
```
→ Focus on: algorithm optimization, typed arrays, SIMD, WebWorkers

**Balanced**:
```
BAM/CRAM Fetch:   6000ms
Process Depth:    4000ms
Mismatches:       2000ms
Post-process:     1000ms
```
→ Both I/O and CPU need optimization

## Running Specific Tests

### Test a specific coverage/type
```bash
export BENCHMARK_RUNS=5
node benchmarks/end-to-end/bench_with_profiling.mjs shortread 200x
```

### Compare three branches
```bash
# Set up three servers on different ports (see benchmarks/README.md)
export PORT1=3000 PORT2=3001 PORT3=3002
export LABEL1="main" LABEL2="optimize-v1" LABEL3="optimize-v2"
./benchmarks/end-to-end/run_profiling.sh
```

## Implementation Details

### Code Instrumentation

The profiling adds minimal overhead with `performance.now()` calls:

**In `generateCoverageBins.ts`:**
```typescript
const depthStart = performance.now()
processDepth({ feature, bins, region })
depthTime += performance.now() - depthStart
```

**In `SNPCoverageAdapter.ts`:**
```typescript
const fetchStart = performance.now()
const features = await firstValueFrom(
  subadapter.getFeatures(region, opts).pipe(toArray())
)
const fetchTime = performance.now() - fetchStart
```

**Global timing data:**
```typescript
window.perfData = {
  fps: [],
  timings: {
    bamCramFetchTime: 0,
    depthTime: 0,
    // ... etc
  }
}
```

### Performance Markers

The code also creates performance markers for Chrome DevTools:
```typescript
performance.mark('generateCoverageBins-start')
// ... work ...
performance.mark('generateCoverageBins-end')
performance.measure('generateCoverageBins-total',
  'generateCoverageBins-start',
  'generateCoverageBins-end')
```

You can view these in Chrome DevTools → Performance tab.

## Next Steps Based on Profiling Results

### If BAM/CRAM Fetch dominates (>80% of time):

1. **Use Chrome DevTools Network tab** to see:
   - How many HTTP requests are made
   - Total bytes transferred
   - Request waterfall

2. **Profile @gmod/bam or @gmod/cram libraries**:
   - Add instrumentation to decompression
   - Check BGZF block cache hit rates
   - Measure index seek performance

3. **Optimization strategies**:
   - Implement HTTP/2 server push for index files
   - Pre-warm cache by prefetching adjacent regions
   - Use compressed indexes (CSI instead of BAI for CRAM)
   - Consider CRAM v3.1 with better compression

### If Process Depth dominates (>30% of time):

1. **Profile the hot loop**:
   ```typescript
   // This loop runs millions of times
   for (let j = fstart; j < fend + 1; j++) {
     const i = j - region.start
     if (i >= 0 && i < regionLength) {
       // Optimize this path
     }
   }
   ```

2. **Optimization strategies**:
   - Use typed arrays (Int32Array) instead of objects
   - Pre-allocate all bins upfront (already tried?)
   - Batch bin updates
   - Use SIMD operations (if available)

### If Mismatches dominates (>20% of time):

1. **Profile mismatch extraction**:
   - Check if `feature.get('mismatches')` triggers lazy computation
   - Measure CIGAR parsing time

2. **Optimization strategies**:
   - Cache parsed CIGAR strings
   - Use more efficient mismatch data structure
   - Avoid string operations in hot paths

## Troubleshooting

### Timings show as 0 or undefined

- Check that you're testing with the instrumented build
- Verify `window.perfData.timings` is initialized
- Ensure the code paths are actually executed (e.g., modifications only run with correct colorBy)

### Inconsistent results

- Increase `BENCHMARK_RUNS` for better statistical significance
- Close other applications to reduce noise
- Use `nice` to set process priority
- Run benchmarks on a quiet system

## Understanding Chrome DevTools CPU Profiles

The profiler captures detailed execution data including:

### Key Metrics

**Idle Time** - Browser waiting for I/O, network, or async operations
- High idle time (>60%) = I/O bound
- Low idle time (<30%) = CPU bound

**Program Time** - Overhead from browser and runtime
**Garbage Collection** - Memory management overhead

### How to Analyze

1. **Load the profile in Chrome:**
   - Open Chrome DevTools (F12)
   - Go to "Performance" tab
   - Click upload icon (⬆)
   - Select `results/profile_*_cpuprofile.json`

2. **Look for:**
   - **Worker threads** - Data parsing happens here
   - **High self-time functions** - Actual bottlenecks
   - **CRAM/BAM operations** - Look for decompress, fetch, parse functions
   - **Unexpected hot paths** - Functions taking more time than expected

3. **Common Patterns:**
   - **71% idle** → Bottleneck is file I/O (what we found!)
   - **High in processDepth** → CPU-bound parsing issue
   - **High in decompress** → Compression is the bottleneck
   - **High in fetch** → Network is the bottleneck

## PROFILING_BUILD Flag

The `PROFILING_BUILD=true` environment variable disables JavaScript minification, making function names readable in profiles.

**Without profiling build:**
```
o
e
t
```

**With profiling build:**
```
loadSessionSpec
drawImageOntoCanvasContext
processDepth
```

This is controlled in `products/jbrowse-web/scripts/config.js`:
```javascript
if (process.env.PROFILING_BUILD === 'true') {
  config.optimization.minimize = false
}
```
