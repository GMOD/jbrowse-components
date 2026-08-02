# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU, with WebGL
and Canvas2D fallbacks). Worker output is **absolute genomic uint32** — no
regionStart-relative arithmetic crosses the worker boundary.

Background lives in `agent-docs/` (start at `ARCHITECTURE.md`, then
`reference/`, `guides/`, and the ADRs).

## MST

- `@jbrowse/mobx-state-tree` is our internal ESM fork; treat it like upstream.
- Keep the main model chain in one file; don't split `.views()`/`.actions()`
  across files.
- A bare getter returns a resolved value, never `undefined`. Where a prop
  encodes a sentinel (`rowHeight === 0` = fit-to-height), expose the resolved
  value under a distinct getter every consumer reads.
- Write config with `setConf`, not `configuration.setSlot`. Promotable slots
  resolve only through `resolveConf`, never `getConf`.
- In React, `autorun` inside `useEffect` to track observables (prefer over
  `reaction`).

## React Compiler × MobX

`babel-plugin-react-compiler` does not compile inline `observer(function(){})` /
`observer(()=>…)` — always write observers that way. The
`function F(){}; observer(F)` form does get compiled and can stale a MobX read.

## Tooling

- Run `pnpm test <directory>`, not the full suite. Lint with `--fix`.
- **`pnpm autogen` rewrites every generated-and-committed artifact** and is the
  one answer to any "X is out of date" CI failure. It owns `*.generated.ts`
  shaders (via `.slang`), `package.json` `exports` maps, and
  `tsconfig.build.esm.json` `references` — never hand-edit those.
- Two TypeScript versions on purpose: `typescript` 6.x for lint, aliased
  `typescript7` for `pnpm typecheck`. Don't unify them.
- `@jbrowse/core/util`'s exports are the ABI external plugins resolve against.
  Changing `publicApi.test.ts`'s snapshot needs a deliberate note on which
  plugins you checked.
- `demos/<name>/config.json` deploys via `scripts/deploy-demo.sh`. Never
  `aws s3 cp` a config from elsewhere — the bucket has no versioning, so an
  overwrite that drops a track is unrecoverable.
