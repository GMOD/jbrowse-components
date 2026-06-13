# Jest CI OOM — fix + teardown handoff

## What was happening

CI (`pnpm test-ci` → `jest --ci`) intermittently died with
`FATAL ERROR: Ineffective mark-compacts near heap limit — JavaScript heap out of
memory` at ~6.9GB (the `--max-old-space-size=7000` ceiling). Not specific to any
one test — a slow climb across the whole run.

## Root cause (two compounding factors)

1. **A real per-suite leak.** Every `products/jbrowse-web/src/tests/*`
   integration suite builds a full JBrowse root model (PluginManager + rootModel
   + autoruns; RPC workers are mocked to no-ops) via `createView`/
   `getPluginManager` in `tests/util.tsx`, and **nothing destroys it**. The
   model's `addDisposer`'d autoruns (assembly manager, autosave,
   MultiRegionDisplayMixin fetch autoruns) stay registered in mobx's global
   reaction scheduler, which keeps the whole tree + the jsdom DOM/data it
   observed alive. Measured retention: ~140MB/suite, heap climbed monotonically
   687MB → 6846MB over ~47 suites, then OOM.

2. **CI couldn't recover.** `maxWorkers: '25%'` on a 4-core `ubuntu-latest`
   runner resolves to **1 worker**, and Jest runs a lone worker *in-band in the
   main process* — there is no child worker process to recycle, so the leak
   accumulates unbounded. (Verified via `jest --showConfig`: the config
   `maxWorkers` IS honored — it resolved to the harmful value `1`.)

How it was traced: a custom synchronous reporter (`process.memoryUsage()` →
`fs.appendFileSync`, survives the crash) logging heap per suite. The curve is
unmistakable and entirely within the jbrowse-web integration suites.

## The fix that shipped (jest.config.js)

```js
maxWorkers: '50%',              // ≥2 child workers on a 4-core runner → not in-band
workerIdleMemoryLimit: '1500MB' // recycle a worker once it grows past the limit
```

Both are global-level Jest options (confirmed they land in `globalConfig` even
with the `projects` array). This caps memory **regardless of the leak**.

**Validation:**
- Stringent proof of recycling: 94 jbrowse-web suites passed under a deliberately
  tight `--max-old-space-size=2048` with `--maxWorkers=2 --workerIdleMemoryLimit=900MB`
  — impossible without worker recycling.
- Full CI simulation: `jest --ci --maxWorkers=2 --workerIdleMemoryLimit=1500MB`
  under the 7GB cap → **567 suites / 4918 tests passed, 0 OOM**.

This is the actual answer to the CI failure and is low-risk.

## Optional hardening (not done)

`maxWorkers: '50%'` still collapses to in-band if a runner ever has ≤2 cores.
Pinning `maxWorkers: 2` for CI would make the >1-worker guarantee explicit.
Trade-off: it caps local-dev parallelism on many-core machines, which is why the
percentage was kept.

## Can we ALSO fix the leak with real teardown? (investigated, not landed)

**Yes for memory, but it is not a test-harness one-liner — it needs display
autoruns to be teardown-safe.** Evidence below so the next agent doesn't repeat
the dead ends.

### What works

Adding an `afterEach` in `tests/util.tsx` that tracks created root models and
calls `cleanup()` (RTL unmount) then `destroy(rootModel)`:
- **Flattens memory dramatically**: heap held flat ~1.5GB vs the 6.8GB climb.
  This confirms the diagnosis — the rootModel + its autoruns ARE the leak.

### Why it doesn't land as-is

`destroy(rootModel)` throws synchronously inside `afterEach` and **fails ~3+
suites** (e.g. VcfCluster, OverlapHatchDemo):

```
TypeError: Cannot read properties of undefined (reading 'featureSpacing')
  at getConfWithOverride (BaseLinearDisplay/models/ConfigOverrideMixin.ts:143)
  at laidOutByGroup (alignments/LinearAlignmentsDisplay/model.ts:885)
  ... Reaction.runReaction_ (mobx)
```

**Mechanism:** `display.configuration` is a `ConfigurationReference` into the
jbrowse config tree. During the destroy cascade the referenced config node dies
while the display's `MultiRegionDisplayMixin` autoruns (notably
`SettingsInvalidate`, which reads `rpcProps()` → many config slots) are *still
alive*. They recompute against a now-undefined reference and throw. mobx
surfaces the reaction error out of the destroy's `endBatch`, failing the test.

This is exactly the "destroying the rootModel during test teardown races with
pending async work and surfaces noisy errors" already documented in
`products/jbrowse-web/src/components/disposeLoader.ts` — which is why the
production teardown path (`useLoaderLifecycle` → `disposeLoader` →
`SessionLoader.disposePluginManager` → `destroy(rootModel)` at
`SessionLoader.ts:358`) is deliberately mocked out in tests today. **Note the
integration tests bypass the Loader entirely** (they mount `<JBrowse
pluginManager=…/>` and build the root by hand), so they never exercised that
production path — they leak because no owner ever disposes the root.

### Dead ends tried (don't repeat)

- **Guard the leaf config accessor** (`getConfWithOverride` returns `undefined`
  when the config reference is dead): whack-a-mole. Fixed the
  `getConfWithOverride` frame, then a *second* site (`model.ts:1211`,
  `featureHeight + featureSpacing`) threw. Many getters read config; guarding
  each is the wrong layer.
- **Destroy the session subtree first** (`destroy(session)` before
  `destroy(rootModel)`, so display autoruns dispose while config is still
  alive): this **eliminated all config-read errors (8 → 0)** — promising — but
  `destroy(session)` itself throws
  `[mobx-state-tree] Cannot modify 'AnonymousModel@<root>', the object is
  protected and can only be modified by using an action`, because tearing down
  the session triggers a reaction that mutates the root outside an action.
  Subtree destroy must go through a model action, not a raw `destroy()`.

### Recommended path for a real teardown (next agent)

The session-first ordering is the right instinct; the blocker is doing it
through MST actions and making the autoruns teardown-safe. Concretely:

- Tear the session down via a **root model action** (e.g. a
  `setSession(undefined)` / clear-session action) rather than a raw
  `destroy(session)`, so the parent mutation it triggers is inside an action
  context. Then `destroy(rootModel)`.
- And/or make `MultiRegionDisplayMixin`'s four autoruns (see
  `BaseLinearDisplay/CLAUDE.md`) early-return when their config reference is
  dead, not just on `!view.initialized`. They already guard `isAlive(self)` in
  places — but `self` (the display) is still alive here; it's the *referenced
  config node* that died. A `getView(self)`/reference-liveness guard at the top
  of `rpcProps()`-reading autoruns is the surgical fix.
- Once teardown is clean, the `workerIdleMemoryLimit` safety net can stay
  (belt-and-suspenders) or `maxWorkers` can be raised back toward `'25%'`.

This would also make the **production** session-swap/unmount path quieter, not
just tests — so it's worth doing, but it's a model-layer change across the
display mixins, not a config tweak.

## Repro / measurement commands

```bash
# reproduce OOM in a single process (in-band = CI's lone worker)
NODE_OPTIONS='--max-old-space-size=7000' npx jest --ci --runInBand --logHeapUsage

# CI-simulated validation of the shipped fix (4-core runner ⇒ 2 workers)
NODE_OPTIONS='--max-old-space-size=7000' npx jest --ci --maxWorkers=2 --workerIdleMemoryLimit=1500MB
```

Per-suite heap is best captured with a sync reporter (buffered stdout is lost on
OOM); `--logHeapUsage` only reports the test-running process when `--runInBand`.
```
