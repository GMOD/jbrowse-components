# MultiLGVSyntenyDisplay

## Mirror plugins/alignments

This display should use **the exact same concepts and code as
`plugins/alignments/src/LinearAlignmentsDisplay`** wherever possible. Any
deviation from the alignments pattern is a red flag — before introducing one,
assume the difference is a mistake and verify it's genuinely required by synteny
semantics.

The alignments-aligned patterns to follow:

- **Backend interface**: `Backend.sync(sources)` for whole-map upload,
  `renderBlocks(blocks: RenderBlock[], state)` for per-frame draw. Don't put
  block geometry inside `state`.
- **Pure draw entry point**: a top-level
  `drawSyntenyBlocks(ctx, regions, blocks, state)` that takes any `Ctx2D` (real
  `CanvasRenderingContext2D` or `SvgCanvas`). The on-screen
  `Canvas2DMultiSyntenyRenderer.renderBlocks` wraps it with `prepareCanvas`; SVG
  export wraps it with `paintLayer`. Single source of truth — no parallel
  SVG-only draw path.
- **Headless construction**: `new Canvas2DMultiSyntenyRenderer(null)` for SVG
  export — same lifecycle (sync → drawSyntenyBlocks) as on-screen.
- **rpcProps / gpuProps split**: `rpcProps` getter for fields that gate refetch
  via `SettingsInvalidate`, `gpuProps()` method for fields that drive
  main-thread encoding without RPC roundtrip.
- **renderSvg recipe**:
  `await when(rpcDataMap.size > 0 || error || regionTooLarge)` → `<SVGErrorBox>`
  if error → `paintLayer(width, height, opts, ctx => drawSyntenyBlocks(...))`.
- **uint32 genomic positions**: GPU buffers store positions as `uint32`
  attributes; shaders use `hpSplitUint` + `hpScaleLinear` (or `hpClipX`) for
  exact float math at 3 Gbp. Matches `agent-docs/ARCHITECTURE.md` "BP precision"
  and `plugins/alignments/src/shaders/slang/coverage.slang`. Never store genomic
  positions as `float32` — silently lossy past 16 Mbp.

## Genuine differences from alignments

- **Coverage layout**: synteny renders min/max bands (multi-genome comparison),
  alignments renders single-depth bars. Different shaders, but both follow the
  same uint32-position convention.
- **No per-feature Y layout**: synteny rows are keyed by genome index
  (deterministic), so there's no `laidOutPileupMap` equivalent — features go
  directly into `prepareBlockGeometry` packed buffers.
- **`prefersOffset = true`**: synteny is the anchor view in pairwise
  comparisons; alignments doesn't need this.

Anything else that diverges from alignments should be questioned before
shipping. When in doubt, copy from alignments.
