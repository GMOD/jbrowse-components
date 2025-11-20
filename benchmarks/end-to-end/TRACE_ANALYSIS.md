# Chrome Tracing for Performance Analysis

## Overview

This directory contains scripts to capture comprehensive performance traces including worker thread activity for JBrowse benchmarking.

## Captured Trace

**File**: `results/trace_port3000_200x_shortread.json` (15MB)

This trace contains:
- Main thread activity and call stacks
- **All worker threads** with complete execution traces
- Function-level timing for parsing and rendering code
- Memory usage patterns
- Network request waterfall
- V8 JavaScript execution details

## How to View the Trace

### Option 1: Chrome Tracing Tool (Recommended for Worker Analysis)

1. Open Chrome browser
2. Navigate to: `chrome://tracing`
3. Click "Load" button
4. Select: `results/trace_port3000_200x_shortread.json`
5. Use navigation:
   - **W/S** - Zoom in/out
   - **A/D** - Pan left/right
   - **Click** events to see details
6. Look for worker threads in the thread list on the left

### Option 2: Chrome DevTools Performance Tab

1. Open Chrome DevTools (F12)
2. Go to "Performance" tab
3. Click upload icon (⬆)
4. Load: `results/trace_port3000_200x_shortread.json`

## What to Look For

### Main Thread
- React rendering overhead
- State management updates
- Canvas drawing operations
- Event handling

### Worker Threads
The worker threads contain the critical parsing code:
- `processDepth` - Depth/coverage calculation
- `processMismatches` - SNP/mismatch detection
- `generateCoverageBins` - Coverage binning
- BAM/CRAM parsing operations
- Data structure transformations

### Performance Metrics
From the test run:
- **Total Time**: 22,721ms
- **Render Time**: ~14,043ms
- **Test**: 200x coverage shortread CRAM file
- **Region**: chr22_mask:80,630..83,605

## Scripts

### profile_with_tracing.mjs
Uses Puppeteer with Chrome's Tracing API to capture comprehensive traces including worker data.

**Usage**:
```bash
node profile_with_tracing.mjs <testType> <coverage> [buildFolder]
```

**Examples**:
```bash
node profile_with_tracing.mjs shortread 200x
node profile_with_tracing.mjs longread 20x
node profile_with_tracing.mjs shortread 200x port3001
```

### profile_with_workers.mjs
Attempts to use CDP Profiler API to capture worker profiles. Currently only captures main thread due to worker detection issues.

## Analysis Tips

1. **Find Hot Functions**: Look for functions with high self-time in workers
2. **Identify Bottlenecks**: Find long-running synchronous operations
3. **Check Worker Communication**: Look at postMessage timing between main and worker threads
4. **Memory Patterns**: Check for allocation spikes that might cause GC pauses
5. **Concurrency**: See if workers are running in parallel or serially

## Trace File Format

The trace file is in Chrome's JSON trace format, which includes:
- Event types: X (complete), B/E (begin/end), I (instant)
- Timestamps in microseconds
- Process and thread IDs
- Category tags for filtering
- Arguments with additional context

## Next Steps

1. Load the trace in chrome://tracing
2. Identify the worker threads (typically labeled "DedicatedWorker")
3. Find expensive functions in the workers
4. Look for optimization opportunities:
   - Unnecessary computations
   - Repeated work
   - Large data copies
   - Synchronous operations that could be async
