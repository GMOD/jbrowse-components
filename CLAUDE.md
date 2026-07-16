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
  devicePixelRatio.

## MST

- `@jbrowse/mobx-state-tree` is our internal ESM fork; treat it like upstream
  MST.
- Keep the main model chain in one file (e.g. `LinearGenomeView/model.ts`);
  don't split `.views()`/`.actions()` across files. Small mixins/utilities can
  be extracted.
- To override a config-slot default, write the slot directly
  (`self.configuration.setSlot(name, value)`) and read it back via `getConf`
  (there is no `<name>Override` shadow-property system). For a default that must
  resolve across tiers (config default → display-type/session default → instance
  pin) at read time, use promotable slots / `getConfResolved`.
- A bare getter must return a resolved value, never `undefined`. When a bespoke
  MST prop encodes a sentinel (`rowHeight === 0` = fit-to-height), expose the
  resolved value under a distinct getter (`effectiveRowHeight`) that every
  consumer reads — render, SVG export, overlays — never the raw prop.
- In React, use `autorun` inside `useEffect` to track observables (prefer over
  `reaction`); `untracked` for untracked code.

## React Compiler × MobX

`babel-plugin-react-compiler` does NOT compile inline `observer(function(){})` /
`observer(()=>…)` — always write observers that way, so MobX drives their
reactivity. The `function F(){}; observer(F)` form DOES get compiled and can
stale a MobX read (it memoizes on stable identity); avoid it, or add
`'use no memo'`. See `agent-docs/COMPILER_TERNARY_FINDING.md`.

## Tooling

- Run `pnpm test <directory>`, not the full suite.
- Don't bump the ambient `typescript` devDependency past 6.x — it breaks `pnpm
  lint`. See `agent-docs/reference/TYPESCRIPT_TOOLCHAIN.md`.
