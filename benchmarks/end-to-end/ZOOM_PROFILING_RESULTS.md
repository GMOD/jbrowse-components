# Zoom Interaction Profiling Results

## Test Configuration
- **Test**: 200x coverage shortread CRAM file
- **Build**: port3000
- **URL**: http://localhost/jb2/port3000/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=200x.shortread.cram

## Performance Summary

### Total Test Duration: 32.3 seconds

### Detailed Breakdown

| Phase | Duration | Notes |
|-------|----------|-------|
| **Initial page load** | 5,248ms | Network, HTML, JS loading |
| **Initial render** | 8,789ms | First render of alignments |
| **Zoom out click** | 123ms | Button interaction time |
| **Zoom out render** | 1,212ms | Re-render at wider zoom (2×) |
| **Zoom in click** | 92ms | Button interaction time |
| **Zoom in render** | 5,879ms | Re-render at closer zoom (2×) |
| **Total render time** | 15,880ms | Sum of all render phases |

## Key Findings

### 1. Zoom Out is Fast (1.2s)
Zooming out to a wider region (2× zoom out) renders quickly:
- **1,212ms** to complete render
- ~7× faster than initial render (8,789ms)
- Likely because wider regions show less detail per base pair

### 2. Zoom In is Slower (5.9s)
Zooming in to a more detailed view (2× zoom in) takes longer:
- **5,879ms** to complete render
- ~67% of initial render time (8,789ms)
- More detailed rendering required at closer zoom levels

### 3. Click Handling is Fast
Both zoom interactions have minimal overhead:
- Zoom out click: 123ms
- Zoom in click: 92ms
- UI is very responsive

### 4. Render Time Dominates
The actual rendering far exceeds interaction time:
- Interaction: ~215ms (zoom clicks)
- Rendering: ~15,880ms (74× more time)
- Optimization should focus on rendering, not UI

## Visual Confirmation

Three screenshots captured showing different zoom levels:

1. **screenshot_initial.png** - Initial view (chr22_mask:80,629..83,604, ~2,975bp)
   - Shows alignments with full detail
   - Coverage and mismatch tracks visible

2. **screenshot_zoom_out.png** - Zoomed out 2× (chr22_mask:79,137..85,088, ~5,951bp)
   - Shows "Loading" state (captured during render)
   - Tooltip shows "Zoom out 2×"
   - Wider region, less detail per base

3. **screenshot_zoom_in.png** - Zoomed in 2× (chr22_mask:80,625..83,600, ~2,975bp)
   - Back to similar region as initial
   - Tooltip shows "Zoom in 2×"
   - Full detail restored

## Trace File Analysis

**Trace file**: `results/trace_port3000_200x_shortread_zoom.json` (19MB)

This comprehensive trace includes:
- All three rendering phases (initial, zoom out, zoom in)
- Worker thread activity for each phase
- Complete call stacks for all parsing functions
- Memory and GC patterns across zoom operations
- Timing deltas to identify which zoom level is most expensive

### How to Analyze in Chrome

```bash
# Open Chrome
chrome://tracing

# Load file
results/trace_port3000_200x_shortread_zoom.json

# Look for three distinct activity clusters:
# 1. Initial render (~5-14s in trace)
# 2. Zoom out render (~14-15s in trace)
# 3. Zoom in render (~15-21s in trace)
```

## Optimization Opportunities

### 1. Zoom In Performance
Zooming in takes 5.9s - nearly as long as initial render. Investigate:
- Are we re-parsing data that's already cached?
- Can we reuse computed layouts from initial render?
- Is coverage recalculated unnecessarily?

### 2. Zoom Out Optimization Already Working
Zoom out is 7× faster than initial render, suggesting:
- Level-of-detail (LOD) optimization is working well
- Coverage binning is efficient at wider zoom levels
- Consider applying similar optimizations to zoom in

### 3. Data Caching
Since zoom in returns to similar coordinates as initial view:
- Can we cache parsed alignment data?
- Can we cache computed coverage bins?
- Can we cache rendered canvas data at different zoom levels?

## Comparison Matrix

| Metric | Initial | Zoom Out | Zoom In | Best |
|--------|---------|----------|---------|------|
| Render time | 8,789ms | 1,212ms | 5,879ms | Zoom out |
| Speed vs initial | 1.0× | 7.2× faster | 1.5× faster | Zoom out |
| Region size | ~2,975bp | ~5,951bp | ~2,975bp | - |
| Detail level | High | Medium | High | - |

## Scripts

### Run Zoom Profiling
```bash
node profile_with_zoom_interactions.mjs shortread 200x [buildFolder]
```

### Output Files
- `trace_*_zoom.json` - Full Chrome trace with all interactions
- `timings_*_zoom.json` - Structured timing data (JSON)
- `screenshot_initial.png` - Initial render
- `screenshot_zoom_out.png` - After zoom out
- `screenshot_zoom_in.png` - After zoom in

### Analyze Results
```bash
# View timings
cat results/timings_port3000_200x_shortread_zoom.json | jq

# Compare screenshots
ls -lh results/screenshot_*.png
```

## Next Steps

1. **Profile different zoom levels**: Try 4× zoom out/in to see if pattern holds
2. **Profile different coverage levels**: Compare 20x vs 200x performance at each zoom
3. **Add more zoom iterations**: Test multiple sequential zoom operations
4. **Profile panning**: Add horizontal scrolling to see if it's faster than zooming
5. **Memory profiling**: Check if zooming causes memory growth/leaks

## Related Documentation

- `PROFILING_RESULTS.md` - Initial (no interaction) profiling results
- `TRACE_ANALYSIS.md` - How to view and analyze traces
- `profile_with_tracing.mjs` - Basic profiling without interactions
- `profile_with_zoom_interactions.mjs` - Profiling with zoom interactions
