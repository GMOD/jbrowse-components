# CLAUDE.md

## Display rendering and RPC

All display types fetch data via RPC workers and render on the main thread. No
plugin ships pixel coordinates across the worker boundary. Worker output
positions are **absolute genomic uint32**; no regionStart-relative arithmetic
crosses the worker boundary — see `agent-docs/ARCHITECTURE.md` "Coordinate
convention" for the rationale. What differs per plugin is where various layout
decisions happen:

- **Canvas plugin**: worker does per-feature glyph selection, subfeature
  breakdown, color computation, and label measurement. Y-row packing is
  main-thread (`computeLaidOutData` derived view); within-feature Y stacking
  (transcript rows inside a gene, mature-protein rows) is worker-side and
  config-driven. Output is fully genomic-coord — `rectPositions` are BP offsets,
  child positions come from `feature.get('start')` in `collectRenderData`,
  heights are `config.featureHeight * heightMultiplier`,
  `floatingLabelsData.minX/maxX` are BP offsets. `FeatureLayout` is minimal:
  `feature`, `glyphType`, `y`, `height`, `totalLayoutHeight`, `children`. The
  only `bpPerPx`-dependent worker decision is whether to compute the amino-acid
  overlay (gated by `shouldRenderPeptideBackground`), and `isCacheValid` is a
  discrete threshold check on that. Worker needs config sent as a plain snapshot
  (`getConfSnapshot` + `readConfigValue`).
- **Wiggle**: worker fetches binned data from BigWig at the appropriate zoom
  level and returns genomic-coord bins (`featurePositions` are **absolute
  uint32** genomic positions, same convention as alignments). The `bpPerPx`
  parameter to the worker only picks which BigWig zoom level to read — output
  positions are always genomic. Main thread does autoscale (aggregating across
  all visible regions to compute global Y-axis domain) and renders.
- **Alignments**: worker fetches reads only — no layout. All Y-row packing,
  chain-connecting lines, and Flatbush spatial indices are main-thread. Worker
  output positions are fully absolute genomic uint32 (no regionStart-relative
  offsets anywhere in the data stream).
- **HiC / LD / variants**: worker returns genomic data; GPU shader handles the
  zoom transform per frame.

`isCacheValid` overrides exist on wiggle and canvas only — see
`agent-docs/ARCHITECTURE.md` "Per-region zoom-staleness" for why each one is
necessary (BigWig discrete zoom levels for wiggle; label-fit drift for canvas).

## GPU rendering (plugins/canvas, packages/core/src/gpu)

Shader uniforms `canvas_width`/`canvas_height` are CSS pixels. The HAL sets the
canvas backing store to `css * dpr`, so `N / canvas_width` in clip space = `N`
CSS pixels at any DPR. Do NOT manually scale by devicePixelRatio.

WebGPU uses 4x MSAA; WebGL2 uses `antialias: true`. Picking passes skip MSAA.

WGSL (`canvasShaders.ts`) and GLSL (`canvasGlslShaders.ts`) must stay in sync.
The Uniforms struct/UBO layout must match the byte offsets in
`GpuCanvasFeatureRenderer.ts`.

**Never hand-edit `*.generated.ts` shader files.** They are auto-generated from
the corresponding `.slang` source via `pnpm gen:shaders`. Edit the `.slang`
source and re-run the command to regenerate.

**hp-math (hi/lo bp splits) is shader-only.** `splitPositionWithFrac`,
`hpSplitUint`, and the `bpHi`/`bpLo` (or `bpStartHi`/`bpStartLo`,
`bpRangeHi`/`bpRangeLo`) pairs exist solely to preserve precision in
shader-side **float32** (23-bit mantissa) when subtracting genomic-scale
positions. JS numbers are **float64** (52-bit mantissa) and represent every
genomic position up to 2^53 exactly — so JS code computing clip-space or
pixel coordinates must use the regular `bp - bpStart` form, not a hi/lo
split. If you see hi/lo halves being recombined in a `.ts` file outside of
shader-uniform writes, that's a bug — pass the unsplit `bpStart`/`clippedBpStart`
through and do plain float64 arithmetic.
