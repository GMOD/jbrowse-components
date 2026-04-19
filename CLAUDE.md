# CLAUDE.md

## Display rendering and RPC

All display types fetch data via RPC workers and render on the main thread.
**All worker output X positions are BP offsets from `regionStart`** — no plugin
ships pixel coordinates across the worker boundary. What differs per plugin is
where various layout decisions happen:

- **Canvas plugin**: worker does per-feature glyph selection, subfeature
  breakdown, color computation, and label measurement. Y-row packing is
  main-thread (`computeLaidOutData` derived view). Output is fully
  genomic-coord — `rectPositions` are BP offsets, child positions are
  looked up from `feature.get('start')`, heights are
  `config.featureHeight` (not zoom-dependent), `floatingLabelsData.minX/maxX`
  are BP offsets. Several `widthPx`-derived fields on `FeatureLayout`
  (`x`, `width`, `totalLayoutWidth`, `leftPadding`) are computed but
  never read — dead-code holdover from earlier pixel-baked iterations.
  The actual `bpPerPx`-dependent worker decisions are: amino-acid
  overlay threshold (`shouldRenderPeptideBackground`) and the
  `maxFeatureDensity` density gate. Worker needs config sent as a plain
  snapshot (`getConfSnapshot` + `readConfigValue`).
- **Wiggle**: worker fetches binned data from BigWig at the appropriate
  zoom level and returns genomic-coord bins (`featurePositions` are BP
  offsets, scores per-bin). The `bpPerPx` parameter to the worker only
  picks which BigWig zoom level to read — output positions are always
  genomic. Main thread does autoscale (aggregating across all visible
  regions to compute global Y-axis domain) and renders.
- **Alignments**: worker fetches reads only — no layout. All Y-row
  packing, chain-connecting lines, and Flatbush spatial indices are
  main-thread. Worker output is fully genomic.
- **HiC / LD / variants**: worker returns genomic data; GPU shader
  handles the zoom transform per frame.

`isCacheValid` overrides exist on wiggle and canvas only — see
`agent-docs/ARCHITECTURE.md` "Per-region zoom-staleness" for why each one
is necessary (BigWig discrete zoom levels for wiggle; label-fit drift
for canvas).

## GPU rendering (plugins/canvas, packages/core/src/gpu)

Shader uniforms `canvas_width`/`canvas_height` are CSS pixels. The HAL sets the
canvas backing store to `css * dpr`, so `N / canvas_width` in clip space = `N`
CSS pixels at any DPR. Do NOT manually scale by devicePixelRatio.

WebGPU uses 4x MSAA; WebGL2 uses `antialias: true`. Picking passes skip MSAA.

WGSL (`canvasShaders.ts`) and GLSL (`canvasGlslShaders.ts`) must stay in sync.
The Uniforms struct/UBO layout must match the byte offsets in
`GpuCanvasFeatureRenderer.ts`.
