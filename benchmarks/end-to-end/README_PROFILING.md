# JBrowse Performance Profiling Guide

## Quick Start

### Capture Basic Trace (No Interactions)
```bash
node profile_with_tracing.mjs shortread 200x
```

### Capture Trace with Zoom Interactions
```bash
node profile_with_zoom_interactions.mjs shortread 200x
```

### Analyze Traces
```bash
# CPU profile analysis
node analyze_cpu_profile.mjs results/trace_port3000_200x_shortread.json

# Detailed worker analysis
node analyze_trace_detailed.mjs results/trace_port3000_200x_shortread.json

# JBrowse-specific functions
node analyze_jbrowse_functions.mjs results/trace_port3000_200x_shortread.json
```

## Available Scripts

### Profiling Scripts

| Script | Purpose | Output |
|--------|---------|--------|
| `profile_with_tracing.mjs` | Capture initial page load and render | Trace file (~15MB) |
| `profile_with_zoom_interactions.mjs` | Capture with zoom out/in interactions | Trace file (~19MB), screenshots, timings JSON |
| `profile_with_workers.mjs` | Attempt CDP Profiler API (legacy) | CPU profile (main thread only) |

### Analysis Scripts

| Script | Purpose | Focus |
|--------|---------|-------|
| `analyze_trace.mjs` | Basic statistics | Process/thread overview |
| `analyze_trace_detailed.mjs` | Deep dive into worker thread | PostMessage, GC, timeline |
| `analyze_cpu_profile.mjs` | Extract function-level profiling | Function samples, timing |
| `analyze_jbrowse_functions.mjs` | JBrowse-specific functions | Target function analysis |
| `extract_worker_functions.mjs` | Worker event extraction | Event types, durations |

## Test Parameters

### Test Types
- `shortread` - Short-read alignments (default)
- `longread` - Long-read alignments

### Coverage Levels
- `20x` - Low coverage
- `200x` - High coverage (default)

### Build Folders
- `port3000` - Default build location
- `port3001`, `port3002`, etc. - Alternative builds for comparison

### Examples
```bash
# High coverage short reads
node profile_with_zoom_interactions.mjs shortread 200x

# Low coverage long reads
node profile_with_zoom_interactions.mjs longread 20x

# Compare different builds
node profile_with_zoom_interactions.mjs shortread 200x port3001
```

## Output Files

### Trace Files
- `trace_*.json` - Chrome trace format (15-19MB)
- View in: `chrome://tracing` or DevTools Performance tab

### Analysis Results
- `*_analysis.json` - Structured analysis data
- `timings_*_zoom.json` - Performance timing breakdown

### Screenshots
- `screenshot_initial.png` - Initial render
- `screenshot_zoom_out.png` - After zoom out
- `screenshot_zoom_in.png` - After zoom in

## Viewing Traces

### Chrome Tracing Tool (Recommended)
```
1. Open Chrome browser
2. Navigate to: chrome://tracing
3. Click "Load" button
4. Select your trace file
5. Use WASD to navigate:
   - W/S: Zoom in/out
   - A/D: Pan left/right
   - Click events for details
```

### Chrome DevTools Performance
```
1. Open DevTools (F12)
2. Go to "Performance" tab
3. Click upload icon (⬆)
4. Load your trace file
```

## Key Metrics

### From Zoom Interaction Test
```json
{
  "initialLoad": 5248,      // Page load time (ms)
  "initialRender": 8789,    // First render (ms)
  "zoomOut": 123,           // Click time (ms)
  "zoomOutRender": 1212,    // Re-render after zoom out (ms)
  "zoomIn": 92,             // Click time (ms)
  "zoomInRender": 5879      // Re-render after zoom in (ms)
}
```

### Key Findings
- **Zoom out is 7× faster** than initial render (1.2s vs 8.8s)
- **Zoom in is slower** than zoom out (5.9s vs 1.2s)
- **Click handling is fast** (92-123ms)
- **Rendering dominates** performance (74× more time than clicks)

## Target Functions

These JBrowse parsing functions are captured in traces:

| Function | File | Purpose |
|----------|------|---------|
| `processDepth` | 2947.fe63ad2a.chunk.js:129 | Depth/coverage calculation |
| `processMismatches` | 2947.fe63ad2a.chunk.js:206 | SNP/mismatch detection |
| `generateCoverageBins` | 2947.fe63ad2a.chunk.js:424 | Coverage binning |
| `readFeaturesToMismatches` | 9822.b342c627.chunk.js:255 | Mismatch processing |
| `parseItf8` | 4808.a252c9ee.chunk.js:4001 | CRAM ITF8 parsing |
| `cramEncodingSub` | 4808.a252c9ee.chunk.js:4515 | CRAM encoding |
| `getPairOrientation` | 4808.a252c9ee.chunk.js:617 | Pair orientation |

## Worker Thread Analysis

### DedicatedWorker Thread
The main parsing work happens in a worker thread:
- **Thread ID**: 785378 (from recent trace)
- **Events**: ~7,300 events per trace
- **Active time**: ~9-10 seconds
- **GC overhead**: ~5% of worker time

### Worker Activity Pattern
- Bursty processing (not continuous)
- Heavy activity during script loading
- Major processing bursts during data parsing
- Distinct phases for each zoom level

## Documentation

- `PROFILING_RESULTS.md` - Detailed analysis of basic profiling
- `ZOOM_PROFILING_RESULTS.md` - Zoom interaction analysis
- `TRACE_ANALYSIS.md` - How to view traces
- `README_PROFILING.md` - This file

## Troubleshooting

### Trace file is empty or corrupt
- Check that Chrome/Puppeteer finished successfully
- Ensure sufficient disk space (traces are 15-19MB)
- Try with shorter timeout values

### No worker thread found
- Worker threads are automatically captured by Tracing API
- Check trace in chrome://tracing for "DedicatedWorker thread"
- Ensure the page actually loaded and rendered

### Function names are missing
- Function names are NOT minified in your build
- Use `analyze_cpu_profile.mjs` to extract them
- Look for ProfileChunk events in the trace

### Analysis script fails
- Ensure Node.js can read the trace file
- Check that trace file is valid JSON
- Try with a smaller trace file first

## Tips for Optimization

1. **Focus on rendering** - It's 74× slower than UI interaction
2. **Zoom out is well optimized** - Learn from its patterns
3. **Zoom in could be faster** - It's only 1.5× faster than initial render
4. **Check GC pressure** - 5% overhead might be reducible
5. **Profile data caching** - Zoom operations might benefit from caching

## Advanced Usage

### Compare Multiple Builds
```bash
# Profile main branch
node profile_with_zoom_interactions.mjs shortread 200x port3000

# Profile optimization branch
node profile_with_zoom_interactions.mjs shortread 200x port3001

# Compare timings
diff results/timings_port3000_200x_shortread_zoom.json \
     results/timings_port3001_200x_shortread_zoom.json
```

### Automated Testing
```bash
# Run multiple tests
for coverage in 20x 200x; do
  for type in shortread longread; do
    node profile_with_zoom_interactions.mjs $type $coverage
  done
done
```

### Custom Analysis
```javascript
// Load and analyze trace programmatically
import fs from 'fs'
const trace = JSON.parse(fs.readFileSync('results/trace_*.json', 'utf8'))
const events = trace.traceEvents
// Your custom analysis here
```
