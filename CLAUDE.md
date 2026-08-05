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
- **An `autorun` must do its own reads. MST actions run untracked**, so
  factoring the body of one into an action — the obvious way to share it with a
  menu item or a flush-on-teardown path — leaves the autorun with no
  dependencies: it fires exactly once and then never again, silently. Same trap
  for the argument order `self.someAction(getSnapshot(self))`, which works only
  because the snapshot is taken before the action is entered. Duplicate the
  reads instead and say why.
- **Export a model's instance type as `interface X extends Instance<…> {}`**,
  not `type X = Instance<…>`. A view naming its displays and a display naming
  its view is an ordinary pair of getters and a mutual type reference; only the
  interface form defers it. As aliases the pair collapses — TS7023 on the
  factory, TS2456 on the type, then ~20 implicit-any errors in unrelated files,
  which is what you'll actually see first. Don't route around it by duck-typing
  the view. ADR-055.
- A duck-typed `interface XSelf` extends **`IStateTreeNode`**, never
  `IAnyStateTreeNode` — the latter resolves through `STNValue<any, …>` to `any`,
  so extending it silently turns off checking for every member you just
  declared. `IStateTreeNode` carries the same node-ness (still assignable to
  every `getSession`/`addDisposer`-style helper) and keeps the shape checked.

## React Compiler × MobX

`babel-plugin-react-compiler` does not compile inline `observer(function(){})` /
`observer(()=>…)` — always write observers that way. The
`function F(){}; observer(F)` form does get compiled and can stale a MobX read.

## Tooling

- Run `pnpm test <directory>`, not the full suite. Lint with `--fix`.
- **`pnpm autogen` rewrites every generated-and-committed artifact** and is the
  answer to almost any "X is out of date" CI failure. It owns `package.json`
  `exports` maps, `tsconfig.build.esm.json` `references`, and the doc tables
  built from JSDoc tags — never hand-edit those.
- **Shaders are the one exception: `pnpm gen:shaders`, not `autogen`.**
  `*.generated.ts` is compiled from `.slang` by its own script, checked by its
  own CI job (Shaders), and `scripts/autogen.ts` has no shader generator — so
  `pnpm autogen` on a stale-shader failure rewrites nothing and looks like the
  check is wrong. Edit the `.slang`, never the generated module.
- Two TypeScript versions on purpose: `typescript` 6.x for lint, aliased
  `typescript7` for `pnpm typecheck`. Don't unify them.
- The `@jbrowse/core/*` modules in `ReExports/modules.ts` are the ABI external
  plugins resolve against, guarded by `ReExports/abi.test.ts` against
  `abiBaseline.json`. Removals fail there; additions don't. To drop a name,
  delete it from the baseline in the same commit and say in the message which
  published plugins you checked. (Replaced `util/publicApi.test.ts`, which
  guarded the util barrel alone.)
- `demos/<name>/config.json` deploys via `scripts/deploy-demo.sh`. Never
  `aws s3 cp` a config from elsewhere — the bucket has no versioning, so an
  overwrite that drops a track is unrecoverable.
