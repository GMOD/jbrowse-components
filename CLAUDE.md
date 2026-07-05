# CLAUDE.md

## Architecture

We fetch data in RPC workers and render on the main thread (WebGPU, with WebGL
and Canvas2D fallbacks). Worker output is **absolute genomic uint32** — no
regionStart-relative arithmetic crosses the worker boundary. See
`agent-docs/ARCHITECTURE.md`.

## GPU rendering (`plugins/canvas`, `packages/render-core`)

- **Never hand-edit `*.generated.ts` shader files.** Edit `.slang` source and
  run `pnpm gen:shaders`.
- `canvas_width`/`canvas_height` uniforms are CSS pixels — don't scale by
  devicePixelRatio. Uniforms struct/UBO layout must match byte offsets in
  `GpuCanvasFeatureRenderer.ts`.

## MST

- `@jbrowse/mobx-state-tree` is our internal ESM fork; treat it like upstream
  MST.
- Keep the main model chain in one file (e.g. `LinearGenomeView/model.ts`);
  don't split `.views()`/`.actions()` across files. Small mixins/utilities can
  be extracted.
- To override a config-slot default, write the slot directly
  (`self.configuration.setSlot(name, value)`) and read it back via `getConf`; the
  old `<name>Override` shadow-property system was removed. For a default that must
  resolve across tiers (config default → display-type/session default → instance
  pin) at read time, use the promotable-slot mechanism / `getConfResolved`.
- A bare getter must return a resolved value, never `undefined`. When a bespoke
  (non-config) MST prop encodes a sentinel (e.g. `rowHeight === 0` = fit-to-height),
  expose the resolved value under a distinct getter (`effectiveRowHeight`) and make
  every consumer — render, SVG export, overlays — read that, never the raw prop.
- In React, use `autorun` inside `useEffect` to track observables (prefer over
  `reaction`); `untracked` for untracked code.

## Tooling

- Use `npx tsgo` instead of `npx tsc` for type checking.
- Run `pnpm test <directory>`, not the full suite.
