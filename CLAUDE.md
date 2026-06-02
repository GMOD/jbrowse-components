# CLAUDE.md

## Display rendering and RPC

All displays fetch via RPC workers, render on main thread. Worker output is
**absolute genomic uint32** — no regionStart-relative arithmetic crosses the
worker boundary (see `agent-docs/ARCHITECTURE.md`).

## GPU rendering (`plugins/canvas`, `packages/core/src/gpu`)

- `canvas_width`/`canvas_height` uniforms are CSS pixels — do **not** scale by
  devicePixelRatio.
- Uniforms struct/UBO layout must match byte offsets in
  `GpuCanvasFeatureRenderer.ts`.
- **Never hand-edit `*.generated.ts` shader files.** Edit `.slang` source and
  run `pnpm gen:shaders`.
- **hp-math is shader-only.** `bpHi`/`bpLo` preserve float32 precision in
  shaders; in JS use plain `bp - bpStart`. Hi/lo recombination in `.ts` outside
  shader-uniform writes is a bug.

## rpcProps vs gpuProps

`installGpuDisplay` re-runs `buildSourceRenderData` for all cached regions on
every change. Only move computation into `gpuProps` when a setting changes
frequently **and** the per-feature work is cheap or expressible as a uniform.
See `adr-016-bicolorpivot-stays-in-worker.md`.

## MST model files

Keep the main model chain in one file (e.g. `LinearGenomeView/model.ts`). Don't
split `.views()`/`.actions()` chains across files; small mixins/utilities can be
extracted.

## Alignment modification parsing (`packages/modifications-utils`, `plugins/alignments`)

This code runs per-read in the RPC worker — with thousands of reads and potentially
thousands of modifications per read in a typical view. Avoid intermediate array
allocations in hot paths (no `.filter().map()` chains, no extra copies). The
pre-allocate-and-fill-backwards pattern in `getModPositions` is intentional to
avoid an O(n) `reverse()` call.

## Other notes

- `@jbrowse/mobx-state-tree` is our internal ESM fork of MST; treat it like
  upstream MST.
- In React components, use `autorun` inside `useEffect` to track MST
  observables; prefer `autorun` over `reaction`. For truly untracked code use
  `untracked`.
- Use `npx tsgo` instead of `npx tsc` for type checking.
- Run `pnpm test <directory>`, not the full suite.
