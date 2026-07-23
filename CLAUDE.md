# CLAUDE.md

## Architecture

We fetch data in RPC workers and render on the main thread (WebGPU, with WebGL
and Canvas2D fallbacks). Worker output is **absolute genomic uint32** — no
regionStart-relative arithmetic crosses the worker boundary. See
`agent-docs/ARCHITECTURE.md`.

**Agent front door: [`agent-docs/README.md`](agent-docs/README.md)** —
invariants, definition of done, and pointers to the ADRs, reference notes, and
guides under `agent-docs/`. Start there before non-trivial work on the rendering
pipeline.

## Example plugins

Worked examples backing the developer guides live in `example-plugins/*`, not
`plugins/*` (which is for shipping plugins and publishes to npm). They are
`private: true` but still packed, because `component_tests/plugin-vite` installs
`example-plugins/score-example` from a packed tarball and renders it in
puppeteer on every push. That is the only CI job resolving `@jbrowse/*` through
the `publishConfig` exports map and built `esm/` instead of workspace-linked
source, so it's what catches a packaging break before it reaches external plugin
authors. Don't turn it into a workspace dependency.

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
- To override a config-slot default, write the slot directly (`setSlot`) and
  read it back via `getConf`; the old `<name>Override` shadow-property system
  was removed. For a default that must resolve across tiers at read time (config
  → display-type/session default → instance pin), use promotable slots /
  `getConfResolved` (`agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md`).
- A bare getter must return a resolved value, never `undefined`. When a bespoke
  (non-config) MST prop encodes a sentinel (e.g. `rowHeight === 0` =
  fit-to-height), expose the resolved value under a distinct getter
  (`effectiveRowHeight`) and make every consumer — render, SVG export, overlays
  — read that, never the raw prop.
- In React, use `autorun` inside `useEffect` to track observables (prefer over
  `reaction`); `untracked` for untracked code.

## React Compiler × MobX

`babel-plugin-react-compiler` does NOT compile inline `observer(function(){})` /
`observer(()=>…)` — always write observers that way, so MobX drives their
reactivity. The `function F(){}; observer(F)` form DOES get compiled and can
stale a MobX read (memoizes on stable identity); avoid it, or add
`'use no memo'`. See `agent-docs/reference/COMPILER_TERNARY_FINDING.md`.

## Tooling

- Run `pnpm test <directory>`, not the full suite.
- Two TypeScript versions on purpose: `typescript` stays on 6.x (lint needs it),
  `pnpm typecheck` uses the aliased `typescript7`. Don't unify them —
  `agent-docs/guides/TOOLCHAIN.md`.
- `tsconfig.build.esm.json` `references` arrays are generated — run
  `pnpm gen-tsconfig-refs`, don't hand-edit. A cross-package `declare module`
  (`ExtensionPointRegistry`, `RpcRegistry`) only applies if its file is
  reachable from the package entry, so put it in a feature `index.ts`/`model.ts`
  the entry re-exports — `agent-docs/guides/TOOLCHAIN.md`.
