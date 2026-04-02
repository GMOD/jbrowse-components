# Coverage Downsampling Plan

## Problem

At wide zoom levels (e.g., viewing a 250Mbp chromosome), `computeCoverage`
produces a per-bp Float32Array with millions of entries. Each nonzero entry
becomes a GPU instance (6 vertices). At 2M+ instances the GPU draw call becomes
a bottleneck, and the buffer upload alone takes significant time.

## Requirements

- Faithfully preserve **peaks** (local maxima must not be clipped — a single
  1bp spike should still appear at full height)
- Faithfully preserve **valleys** (drops to zero or low coverage must remain
  visible, not averaged away)
- Smooth appearance when zoomed out — no aliasing artifacts from sampling
- Exact per-bp rendering when zoomed in enough that bins are < 1px wide

## Approach: Min/Max band rendering

For each output bin that aggregates N input bp, store **two values** rather
than one:

- `minDepth`: minimum depth in the bin
- `maxDepth`: maximum depth in the bin

The shader renders each bin as a filled rectangle from `minDepth` to
`maxDepth`. This naturally shows:

- **Peaks**: maxDepth preserves the true peak height
- **Valleys**: minDepth preserves the true valley depth
- **Uniform regions**: min ≈ max → thin bar at the correct level
- **High-variance regions**: wide band showing the range

This is the same technique used by audio waveform renderers and the IGV
browser.

## Bin format

```
// 12 bytes per bin
struct CovBin {
  position: f32,    // bp offset from region start
  minDepth: f32,    // normalized min depth in this bin (0-1)
  maxDepth: f32,    // normalized max depth in this bin (0-1)
}
```

## Bin count selection

- Target: `min(viewWidthPx, depths.length)` — never upsample, only downsample
- At 1920px viewport this means at most ~2000 bins per refName regardless of
  chromosome size
- When `depths.length <= viewWidthPx`, emit per-bp bins (no downsampling) —
  this naturally transitions to exact rendering when zoomed in

## Where to compute

- In `computeSyntenyCoverageGpuData`, after `computeCoverage` returns the
  per-bp depths array
- Pass `bpPerPx` or `viewWidthPx` as a parameter to control bin resolution
- The coverage upload autorun already has access to the view

## Shader changes

- The vertex shader draws a quad from `(position, minDepth)` to
  `(position + binWidth, maxDepth)` instead of `(position, 0)` to
  `(position + 1, depth)`
- When min=0 the bar extends to the baseline (same as current behavior)

## Interaction with LinearAlignmentsDisplay

The alignments plugin currently uses per-bp coverage without downsampling (the
GPU handles it efficiently because the coverage area is small relative to the
pileup). If we implement min/max band rendering here, it could later be
extracted to `@jbrowse/alignments-core` for both displays to share.
