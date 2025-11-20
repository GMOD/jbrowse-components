# Chrome Trace Profiling Results

## Test Configuration
- **Test**: 200x coverage shortread CRAM file
- **Region**: chr22_mask:80,630..83,605
- **Total Time**: 22.7 seconds
- **Render Time**: ~14 seconds

## Trace File
`results/trace_port3000_200x_shortread.json` (15MB)

## Key Findings

### Worker Thread Activity
Successfully captured DedicatedWorker thread (Thread 785378) with 7,339 events:

#### Worker Performance Summary
- **Total active duration**: 9,214ms (~9.2 seconds)
- **PostMessage handlers**: 13 calls, 898ms total
  - Longest message: 567.64ms
  - Average: 69.07ms per message
- **Script evaluation**: 10 scripts, 1,500ms total
  - Main worker script (880.00cbbb27.chunk.js): 1,160ms
- **Garbage Collection**: 488ms total
  - Minor GC: 22 events (327ms)
  - Major GC: 3 events (161ms)

### JBrowse Parsing Functions Detected

From the CPU profiler data (3,415 ProfileChunk events), the following key functions were identified:

| Function | File | Samples | Location |
|----------|------|---------|----------|
| `processDepth` | 2947.fe63ad2a.chunk.js | 60 | Line 129 |
| `processMismatches` | 2947.fe63ad2a.chunk.js | 1 | Line 206 |
| `generateCoverageBins` | 2947.fe63ad2a.chunk.js | 6 | Line 424 |
| `readFeaturesToMismatches` | 9822.b342c627.chunk.js | 13 | Line 255 |
| `get mismatches` | 9822.b342c627.chunk.js | 6 | Line 452 |
| `renderMismatches` | 7258.227cc31a.chunk.js | 8 | Line 38125 |
| `getPairOrientation` | 4808.a252c9ee.chunk.js | 7 | Line 617 |
| `parseItf8` | 4808.a252c9ee.chunk.js | 4 | Line 4001 |
| `cramEncodingSub` | 4808.a252c9ee.chunk.js | 6 | Line 4515 |
| `getSectionParsers` | 4808.a252c9ee.chunk.js | 14 | Line 4804 |

### Worker Timeline

The worker showed activity in distinct bursts over ~9.2 seconds:

**High activity periods** (>100ms per 100ms bucket):
- 0ms: 1,425ms (initial script loading)
- 100-600ms: Heavy activity (286ms, 156ms, 178ms, 532ms)
- 1,200ms: 1,144ms (major processing burst)
- 1,700-1,900ms: Sustained activity (281ms, 328ms)
- 2,500-3,200ms: Final processing (142ms, 214ms, 177ms, 107ms, 120ms, 139ms, 1,161ms)
- 4,300-4,600ms: Late processing (191ms, 194ms, 243ms, 1,040ms)

### File-Level Analysis

**Top files by CPU profiler samples:**

1. `main.074565d3.js` - 408 functions profiled (main app bundle)
2. `9648.cacda171.chunk.js` - 595 functions profiled
3. `7258.227cc31a.chunk.js` - 454 functions profiled (rendering code)
4. `4311.1de7865d.chunk.js` - 308 functions profiled
5. `9691.f759775c.chunk.js` - 133 functions profiled
6. `4808.a252c9ee.chunk.js` - 122 functions profiled (CRAM parsing)

### Key Insights

1. **Worker is Active**: The DedicatedWorker thread is successfully captured and shows substantial work (9.2s out of 14s total render time)

2. **CRAM Parsing Functions Identified**: Core parsing functions like `processDepth`, `readFeaturesToMismatches`, and CRAM encoding functions are present in the trace

3. **Bursty Processing Pattern**: Work happens in distinct bursts rather than continuously, suggesting batch processing of data

4. **GC Overhead**: ~488ms (5.3% of worker time) spent in garbage collection

5. **Message Passing Latency**: Some PostMessage handlers take significant time (up to 568ms), suggesting large data transfers or heavy processing in message handlers

## How to View Detailed Analysis

### Option 1: Chrome Tracing (Recommended)
```bash
# Open Chrome
chrome://tracing

# Load file
results/trace_port3000_200x_shortread.json

# Navigate to Thread 785378 (DedicatedWorker thread)
# Use W/S to zoom, A/D to pan
# Click events to see call stacks
```

### Option 2: Programmatic Analysis
```bash
# Run analysis scripts
node analyze_trace.mjs
node analyze_trace_detailed.mjs
node analyze_cpu_profile.mjs

# View JSON export
cat results/trace_port3000_200x_shortread_analysis.json
```

## Scripts Available

1. **profile_with_tracing.mjs** - Capture new traces with worker data
2. **analyze_trace.mjs** - Basic trace analysis
3. **analyze_trace_detailed.mjs** - Detailed worker thread analysis
4. **analyze_cpu_profile.mjs** - CPU profiler data extraction
5. **analyze_jbrowse_functions.mjs** - JBrowse-specific function analysis

## Next Steps for Optimization

Based on this profiling data, potential optimization targets:

1. **Investigate processDepth** (60 samples) - Most frequently sampled parsing function
2. **Message passing optimization** - 568ms max message handler suggests room for improvement
3. **GC pressure reduction** - 488ms in GC could be reduced with better memory management
4. **Batch processing tuning** - The bursty pattern suggests batch sizes could be optimized

## Limitations

The Chrome Tracing API samples at intervals, so:
- Short function calls may not appear
- Sample counts indicate relative time, not absolute execution time
- TimeDeltas in ProfileChunks may not sum to wall-clock time due to sampling
- Functions with few samples may still be significant if they run infrequently but take a long time

To get more precise timing, consider:
- Adding manual performance marks in the code
- Using Performance.measure() API
- Increasing profiling sample rate (requires custom build)
