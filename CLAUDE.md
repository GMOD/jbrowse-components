# CLAUDE.md

## Display rendering and RPC

All displays fetch via RPC workers, render on main thread. Worker output is
**absolute genomic uint32** — no regionStart-relative arithmetic crosses the
worker boundary (see `agent-docs/ARCHITECTURE.md` "Coordinate convention").

- **Canvas**: worker does glyph selection, subfeature breakdown, color, label
  measurement; config sent as plain snapshot. Main thread: Y-row packing
  (`computeLaidOutData`). Within-feature Y stacking is worker-side. Only
  `bpPerPx`-dependent worker decision: amino-acid overlay
  (`shouldRenderPeptideBackground`).
- **Wiggle**: worker fetches BigWig bins, returns absolute uint32 positions;
  `bpPerPx` only selects zoom level. Main thread: autoscale.
- **Alignments**: worker fetches reads only. Y-row packing, chain lines, and
  Flatbush indices are main-thread.
- **HiC / LD / variants**: worker returns genomic data; GPU shader handles zoom
  transform.

`isCacheValid` overrides on wiggle and canvas only — see
`agent-docs/ARCHITECTURE.md` "Per-region zoom-staleness".

## GPU rendering (plugins/canvas, packages/core/src/gpu)

`canvas_width`/`canvas_height` uniforms are CSS pixels. HAL sets backing store
to `css * dpr`, so `N / canvas_width` = `N` CSS pixels. Do NOT scale by
devicePixelRatio.

WebGPU uses 4x MSAA; WebGL2 uses `antialias: true`. Picking passes skip MSAA.

Uniforms struct/UBO layout must match byte offsets in
`GpuCanvasFeatureRenderer.ts`.

**Never hand-edit `*.generated.ts` shader files.** Edit `.slang` source and run
`pnpm gen:shaders` — Slang generates both WGSL and GLSL.

**hp-math (hi/lo bp splits) is shader-only.** `splitPositionWithFrac`,
`hpSplitUint`, and `bpHi`/`bpLo` pairs preserve float32 precision in shaders. JS
is float64 — use plain `bp - bpStart`. Hi/lo recombination in `.ts` outside
shader-uniform writes is a bug.

## MST model files

**Do not split large model files (e.g. `LinearGenomeView/model.ts`) across
multiple files.** MST's `.views()`/`.actions()` chaining makes type inference
harder to get right across file boundaries. Small self-contained pieces of logic
(mixins, pure utility functions) can be extracted, but the main model chain
should stay in one file.
