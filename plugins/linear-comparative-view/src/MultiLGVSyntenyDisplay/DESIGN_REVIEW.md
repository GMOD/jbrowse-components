# Design Review: Areas Needing Revisiting

## What was built this session

- **Tube map view plugin** (`@jbrowse/plugin-tube-map-view`) — SVG-based tube map
  layout ported from sequenceTubeMap (MIT), with adapter integration via
  GetSubgraph RPC, track legend, viewport culling, sequence display on zoom
- **Coverage downsampling** — min/max band rendering in
  `@jbrowse/alignments-core/coverageDownsampling.ts`, used by all 3 backends
  (WebGL, WebGPU, Canvas2D)
- **Code sharing** — extracted `downsampleMinMax`, `computeCoverageTicks`,
  `niceNum`, `YSCALEBAR_LABEL_OFFSET` to `@jbrowse/alignments-core`
- **Coverage theme color** — passed through shader uniforms instead of hardcoded
- **Coverage tooltip** — shows depth at hovered position, data stored on MST
  model volatile

## Items needing design review

### Downsampling skepticism
The user expressed wariness about downsampling affecting rendering accuracy. The
min/max band approach preserves peaks and valleys faithfully, but it changes the
visual character at wide zoom (bands instead of individual bars). Need to
consider:
- Is the visual change acceptable? Should there be a toggle?
- Should the threshold be configurable (currently `viewWidthPx`)?
- Does the per-bp path (no downsampling) still render correctly when zoomed in?
- The user values subpixel detail — should we just let the GPU handle millions
  of instances and skip downsampling entirely? GPU instancing might be fast
  enough.

### React state management patterns
The user flagged:
- **Refs for mutable data** are invisible to React's rendering cycle
- **Maps in useState** are mutable without triggering re-renders
- **MST volatiles** are the idiomatic JBrowse pattern for observable mutable
  data — we moved `coverageMaxDepth` and `coveragePerRefName` to model volatiles

Still needs review:
- The coverage upload autorun lives in a React `useEffect`. Should this be an
  MST `afterAttach` autorun on the model instead? Would simplify the component
  and eliminate the `rendererRef` pattern.
- The `rendererRef` itself — the GPU renderer is stored in a ref, which means
  React can't observe when it's ready. The `[ready]` state tries to bridge this
  but it's fragile.

### Code sharing between LinearAlignmentsDisplay and MultiLGVSyntenyDisplay
Current state:
- `computeCoverage()` is shared via `@jbrowse/plugin-alignments`
- `downsampleMinMax`, `computeCoverageTicks`, etc. are shared via
  `@jbrowse/alignments-core`
- `CoverageYScaleBar` component is shared via `@jbrowse/plugin-alignments`

Remaining gaps:
- LinearAlignmentsDisplay computes `coverageTicks` via d3 `scaleLinear().nice()`
  while the shared `computeCoverageTicks` uses manual `niceNum()`. These produce
  slightly different results. Should LinearAlignmentsDisplay migrate to the
  shared function?
- LinearAlignmentsDisplay GPU coverage shaders are completely separate from the
  synteny coverage shaders. Both render bars; the synteny version now has
  min/max band support. Should the alignments display adopt the same shader?
- The synteny coverage data pipeline (`computeSyntenyCoverageGpuData`) is custom
  to synteny. Alignments uses `RenderPileupDataRPC`. These are fundamentally
  different data paths but produce similar output.

### Tube map plugin architecture
- SVG rendering won't scale past ~500 nodes. WebGL deferred for now.
- The tube map copies the GFA parser from the graph plugin since graph is going
  GPL/external. If graph moves out, we should ensure both parsers stay in sync
  or share via a non-GPL package.
- The layout algorithm is a simplified port of sequenceTubeMap's tubemap.js.
  Missing features vs the original: reversals, read tracks, vertical adjustment
  optimization pass. Worth comparing visual output against sequenceTubeMap for
  the same GFA.
- Auto zoom-to-fit uses a constant `CANVAS_HEIGHT = 500`. Should respect the
  actual container height.

### Remaining planned work (from NEXT_STEPS.md)
- VgServerAdapter for comparing GfaTabix extraction against vg chunk
- SVG export including CoverageYScaleBar
- Graph plugin extraction to external GPL repo
