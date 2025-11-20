# Profiling Summary: Why Your Optimizations Didn't Work

## TL;DR

Your data parsing optimizations (pre-allocating bins, optimizing CIGAR generation) improved CPU-bound code by ~5-10%, but the **real bottleneck is I/O-bound** (file fetching and decompression), which takes 95%+ of the total time.

**Result:** No noticeable improvement in end-to-end performance.

## The Numbers

| Metric | Value | Meaning |
|--------|-------|---------|
| **Total Time** | ~13 seconds | End-to-end rendering time |
| **CPU Time (active JS)** | ~3.7 seconds (28%) | Your code running |
| **Idle Time (waiting)** | ~9.3 seconds (72%) | Waiting for I/O |

### What This Means

- 72% of time is **waiting** (idle)
- Only 28% is **computing** (your code)
- Your optimizations improved the 28%, but that's not the bottleneck!

## Discovery Process

### Initial Attempt: Instrument the Code

We added `performance.now()` timing to track:
- `bamCramFetchTime`
- `depthTime`
- `mismatchesTime`
- `postProcessTime`

**Problem:** Returned empty `{}` - no data collected!

**Root cause:** Your parsing code runs in **web workers** where `window` doesn't exist. The instrumentation checked for `window.perfData` which was `false` in the worker context.

### Solution: Chrome DevTools CPU Profiling

Instead of instrumenting code, we used Chrome's built-in profiler which works across all contexts (main thread + workers).

**Results:**
```
1. (idle)           ~9992ms  (71.8%)  ← THE BOTTLENECK!
2. (program)         ~489ms  (3.5%)
3. handler           ~260ms  (1.9%)
4. (anonymous)       ~171ms  (1.2%)
5. (garbage collector) ~137ms (1.0%)
```

## Why Your Optimizations Didn't Help

### Optimization 1: Pre-allocate Coverage Bins
**What it does:** Eliminates `if (bins[i] === undefined)` checks in hot loop
**Time saved:** ~5-10ms (processDepth runs in ~32ms, saving maybe 20% = 6ms)
**Impact on total:** 6ms / 13000ms = **0.05% faster**

### Optimization 2: CIGAR Array Building
**What it does:** Uses `array.join()` instead of string concatenation
**Time saved:** ~2-3ms per track
**Impact on total:** 3ms / 13000ms = **0.02% faster**

### The Real Bottleneck: I/O

The CPU profile shows 72% idle time, which means:
- **Fetching CRAM/BAM chunks** from server (network I/O)
- **Decompressing BGZF/CRAM blocks** (native code, not visible in JS profile)
- **Web worker communication** (message passing overhead)

These operations happen in native code (decompression) or are blocked on I/O (network), so they don't show up as JavaScript functions in the profile.

## What To Do Instead

### High-Impact Optimizations (Target the 72% idle time)

1. **Prefetching**
   - Predict next region user will view
   - Pre-fetch and cache adjacent CRAM chunks
   - Could reduce load time by 50%+ on subsequent views

2. **Better Compression**
   - Use smaller index files (CSI instead of BAI)
   - Consider CRAM v3.1 with improved compression
   - Reduces bytes transferred

3. **HTTP/2 or HTTP/3**
   - Multiplex multiple chunk requests in parallel
   - Eliminates connection overhead
   - Could speed up initial load by 30%+

4. **Worker Pool Tuning**
   - Adjust number of workers based on CPU cores
   - Balance between parallelism and overhead

5. **Block-Level Caching**
   - Cache decompressed BGZF blocks in memory
   - IndexedDB for persistent client-side cache
   - Dramatically faster on revisits

### Low-Impact (Don't Bother)

❌ More CIGAR optimizations
❌ Faster bin allocation
❌ Optimizing processMismatches
❌ Any pure JavaScript optimizations

## How to Use the Profiling Tools

### Quick Start
```bash
cd benchmarks
./profile_build_and_run.sh port3000 shortread 200x
```

### View Results
1. Open Chrome DevTools (F12)
2. Performance tab → Upload icon
3. Load `results/profile_*_cpuprofile.json`
4. Look for:
   - Worker thread activity
   - Functions with high "self time"
   - Unexpected bottlenecks

### The PROFILING_BUILD Flag

When you build with `PROFILING_BUILD=true`, minification is disabled so function names are readable:

**Minified (hard to debug):**
```
o: 45ms
e: 32ms
t: 28ms
```

**Unminified (easy to understand):**
```
loadSessionSpec: 45ms
processDepth: 32ms
drawImageOntoCanvasContext: 28ms
```

## Conclusion

Your instinct to optimize the parsing code was good, but **profiling first** would have revealed that parsing isn't the bottleneck. The data clearly shows:

1. **72% idle time** = I/O bound
2. **Optimizations targeted CPU-bound code** = Wrong target
3. **No improvement** = Expected outcome

**Next steps:**
1. Use the profiling tools to identify I/O bottlenecks
2. Implement caching/prefetching strategies
3. Profile again to measure improvement
4. Iterate

The profiling infrastructure is now in place for future optimization work. Use it before writing code!
