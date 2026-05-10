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

WebGPU uses 4x MSAA; WebGL2 uses `antialias: true`.

Uniforms struct/UBO layout must match byte offsets in
`GpuCanvasFeatureRenderer.ts`.

**Never hand-edit `*.generated.ts` shader files.** Edit `.slang` source and run
`pnpm gen:shaders` — Slang generates both WGSL and GLSL.

**hp-math (hi/lo bp splits) is shader-only.** `splitPositionWithFrac`,
`hpSplitUint`, and `bpHi`/`bpLo` pairs preserve float32 precision in shaders. JS
is float64 — use plain `bp - bpStart`. Hi/lo recombination in `.ts` outside
shader-uniform writes is a bug.

## Large file generation (tools/gfa-to-tabix)

The `/tmp` partition is small (16 GB, often >50% full). Set `TMPDIR=~/tmpdir`
before any `gfa-to-tabix` run. Clean stale `/tmp/hprc-*`, `/tmp/volvox*`, etc.
before long runs.

## rpcProps vs gpuProps — what stays in the worker

`installGpuDisplay` fires for **every** `rpcDataMap` change and re-runs
`buildSourceRenderData` / `buildMultiSourceRenderData` for all cached regions.
Moving expensive per-feature computation into that path multiplies cost by the
number of cached regions.

Only move worker computation into `gpuProps` when the setting changes frequently
(e.g., color, scale type) **and** the per-feature work is cheap or expressible
as a shader uniform. For settings that rarely change but feed expensive loops
(e.g., `bicolorPivot`), keep in `rpcProps`. See
`agent-docs/architecture-decision-records/adr-016-bicolorpivot-stays-in-worker.md`.

## MST model files

**Do not split large model files (e.g. `LinearGenomeView/model.ts`) across
multiple files.** Type inference across `.views()`/`.actions()` chains is harder
to get right across file boundaries. Small self-contained logic (mixins, pure
utilities) can be extracted, but the main model chain should stay in one file.

## Other notes

- `@jbrowse/mobx-state-tree` is our internal ESM fork of MST with near-identical
  API; treat it like upstream MST.

- In React components, use `autorun` inside `useEffect` to track MST observables
  rather than listing them in the dependency array.

- Use `npx tsgo` instead of `npx tsc` for type checking.

- Use `autorun` instead of `reaction`: autorun implicitly tracks all
  dependencies. For truly untracked code, use the mobx `untracked` function.
