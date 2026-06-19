# Handoff: web-worker example fails under Vite/Rollup (circular deps)

## TL;DR

The `WithWebWorker` example is the only one of the 41 LGV examples that does not
render in the Astro site. It is **disabled** (commented out in
`src/examples.ts`; page renamed to `src/pages/with-web-worker.astro.disabled`).

The RPC worker bundles fine with **webpack** (how the published package ships)
but throws at worker startup under **Vite/Rollup**:

```
Uncaught ReferenceError: Cannot access 'TextSearchManager' before initialization
  at .../_astro/rpcWorker-*.js
```

This is **truly a circular-dependency problem — and there is more than one
cycle.** It is not a config typo or a minification artifact.

## Why webpack copes and Vite/Rollup does not

Same source, different module-runtime contract:

- **webpack** wraps every module in a function and resolves imports lazily via
  `__webpack_require__`. When two modules import each other, the one evaluated
  first receives a *partially-populated* exports object; as long as it only
  *reads* the binding later (at call time, not during top-level evaluation), it
  works. Cycles are tolerated by construction.
- **Rollup** (what Vite uses for the production build) concatenates modules into
  a single scope and preserves ES module **live-binding + temporal-dead-zone**
  semantics. If any **top-level** code in a cycle touches a binding whose
  `class`/`const`/`let` declaration is ordered later in the concatenated output,
  you get a hard `ReferenceError: Cannot access X before initialization`. Rollup
  cannot reorder across the cycle without changing semantics, so it surfaces the
  error instead of hiding it.

MST model factories run a lot of code at module top level (`types.model(...)`,
`.volatile`, default-value construction), which is exactly the kind of top-level
evaluation that turns a "harmless" cycle into a TDZ crash.

This is the core reason the project has stayed on webpack: webpack silently
absorbs cycles that Rollup refuses.

## Proof it's circular deps (plural)

Experiment performed (and reverted) on `webgl-poc`:

1. `packages/core/src/util/types/index.ts:622` is a **value re-export of the
   `TextSearchManager` class** from the `util/types` barrel:

   ```ts
   export { default as TextSearchManager } from '../../TextSearch/TextSearchManager.ts'
   ```

   The `util/types` barrel is imported pervasively across core/plugins. Nothing
   outside that file imports `TextSearchManager` *from the barrel* — every real
   consumer imports the direct path
   `@jbrowse/core/TextSearch/TextSearchManager` (see
   `product-core/src/RootModel/BaseRootModel.ts`,
   `products/*/src/createModel/createModel.ts`). So this line gratuitously pulls
   `TextSearchManager` + its dependency subtree (`configuration`, `QuickLRU`,
   `ufuzzy`) into the heavily-shared barrel, forming a cycle:
   `util/types barrel → TextSearchManager → configuration → … → util/types`.

2. **Commenting out line 622 made the `TextSearchManager` error disappear** —
   but a *different* init-order error then appeared:

   ```
   ReferenceError: displayMigrations is not defined
   ```

   (`displayMigrations` is not a source identifier; it's a bundle-internal name,
   i.e. a *second* cycle in a different part of the graph.)

Conclusion: fixing one cycle uncovers the next. There is a **class** of circular
dependencies in the worker's reachable graph, not a single offending import.

## How to decode the cycles (recommended next steps)

1. **Enumerate them.** Run a circular-dependency scan over the worker entry
   (`products/jbrowse-react-linear-genome-view/src/rpcWorker.ts`) and core:

   ```sh
   npx madge --circular --extensions ts,tsx \
     packages/core/src/index.ts \
     products/jbrowse-react-linear-genome-view/src/rpcWorker.ts
   ```

   Or add a Rollup `onwarn` that logs `CIRCULAR_DEPENDENCY` during the
   examples-site build to get the exact import chains Rollup sees.

2. **Prioritize barrels.** The biggest offenders are barrels (`index.ts`) that
   re-export *values* (classes, functions, MST factories) and are themselves
   imported by the modules they re-export. `util/types/index.ts:622` is a
   confirmed example. Prefer:
   - moving value re-exports out of broad "types" barrels, or
   - importing the direct module path instead of the barrel at the cycle seam,
     or
   - converting eager top-level uses into lazy ones (inside functions/getters).

3. **Verify both runtimes after each change.** A core module-structure change
   must not regress the webpack builds. After breaking a cycle:
   - examples-site: `pnpm --filter lgv-examples-site build`, then load
     `/storybook/lgv/with-web-worker/` and confirm no console error + a track
     draws (display test-id ends in `-done`).
   - webpack: build `products/jbrowse-web` (and the embedded products) to ensure
     nothing broke.

## Alternative if untangling proves too invasive

Ship the worker as a **prebuilt classic-worker asset** for the examples-site
only: bundle `rpcWorker` with webpack/esbuild to a single classic IIFE file,
drop it in `public/`, and construct it with
`new Worker('/storybook/lgv/rpcWorker.js')`. Downside: the displayed example
source no longer matches a normal copy-paste app, so keep a note in the example.

## Current state / how to re-enable

- Example source: `src/examples/WithWebWorker.tsx` (uses Vite's `?worker`
  import; a webpack/CRA app would instead use the package's prebuilt
  `@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance`).
- Page: `src/pages/with-web-worker.astro.disabled` — rename back to `.astro`.
- Registry: uncomment the `with-web-worker` entry in `src/examples.ts`.
- `astro.config.mjs` already sets `vite.worker.format = 'es'` (required for the
  worker to bundle at all, since it code-splits).
