---
name: jest-worker-teardown
description: State of jbrowse-web's "worker process failed to exit gracefully" — what causes it, the two teardown variants that were measured (one does nothing, one works but breaks 13 suites), and the decision left open. Read before touching products/jbrowse-web/src/tests/util.tsx or the jest worker/memory settings.
---

# jbrowse-web test engines are never torn down

## Where it stands

Every full `jest products/jbrowse-web/src` run ends with:

```
A worker process has failed to exit gracefully and has been force exited.
```

Nothing is committed for this. A spike was run on 2026-08-04 and reverted; this
file is what it measured so the next attempt starts from the answer rather than
from the experiment.

## The cause, confirmed

`products/jbrowse-web/src/tests/util.tsx` `getPluginManager` builds a
PluginManager and a root model, and nothing ever destroys either. It is the
single chokepoint — `createView`, `createViewNoWait` and `getTestSession` all go
through it — and 63 files under `src/tests` reach it.

React unmounting does not own the engine. Testing-library's auto-cleanup
unmounts the tree; the MST root lives on with its autoruns running. This is the
same shape as the embedded-product leaks fixed in `e457e27ec8` / `585d13703e`
(see `destroyViewState` in the react products for the working teardown).

`jest.config.js` already says so, and its worker settings are the workaround:

> The full-app integration suites each retain ~140MB (root model + RPC workers +
> autoruns are not torn down) … Using >1 worker plus `workerIdleMemoryLimit`
> recycles a worker once it grows past the limit, capping memory regardless of
> the per-suite leak.

So `maxWorkers: '50%'` and `workerIdleMemoryLimit: '1500MB'` are load-bearing for
survival, not tuned for speed. That is the second reason to care; the first is
that a warning which fires on every run cannot report the *next* leak.

## Verified facts, do not re-derive

- **Driver-only teardown does nothing.** `rpcManager.destroy()` in an `afterEach`,
  without destroying the tree: 790 pass / 1 pre-existing fail, warning **still
  present**. Expected in hindsight — `getPluginManager` forces
  `MainThreadRpcDriver`, which holds no OS handles. Do not spend time here.
- **Full teardown clears the warning and breaks 13 suites.** `cleanup()` →
  `rpcManager.destroy()` → `destroy(rootModel)`: warning **gone**, but
  **32 tests across 13 suites** fail (759/798 pass, vs 790/798 baseline).
- **The breakage is async work outliving the test body**, reaching a destroyed
  tree. Representative stack:
  ```
  Proxy.get (packages/core/src/assemblyManager/assemblyManager.ts)
  getAssemblyRefNames (packages/synteny-core/src/detectSwappedAssemblies.ts)
  detectAssembliesSwapped
  syntenyAssemblySwapCheck (plugins/linear-comparative-view/src/LinearSyntenyDisplay/afterAttach.ts)
  ```
- **Those are arguably real bugs, not test artifacts.** An `afterAttach` autorun
  still reading the assembly manager after its tree dies would misbehave in the
  app too, on `setSession` — it is harmless today only because production never
  destroys these trees either. Teardown in tests is what makes the class visible.
- **Destroy needs the session materialized first.** MST snapshots each dying
  node, and snapshotting one that was never *observed* instantiates it during
  death finalization, where creating a further observable throws "the creation of
  the observable instance must be done on the initializing phase". `void
  rootModel.session` before `destroy()`. Same trap as `destroyViewState`.
- **Call testing-library's `cleanup()` yourself, first.** It is idempotent, so
  RTL's own auto-cleanup `afterEach` is unaffected whichever order the two run
  in — which removes the need to reason about jest hook ordering at all.
- **Do not trust wall-clock deltas measured on a shared worktree.** Three full
  runs: 194s baseline, 152s full-teardown, 220s driver-only — and driver-only is
  near-baseline code. Other agents run their suites concurrently here, so
  variance exceeded 13% and no speed claim survives it. If runtime is part of the
  justification, measure repeatedly on a quiet machine.

## The spike, for re-application

In `util.tsx`, module scope:

```ts
const engines: WebRootModel[] = []

afterEach(() => {
  cleanup()
  for (const rootModel of engines.splice(0)) {
    if (isAlive(rootModel)) {
      void rootModel.session
      rootModel.rpcManager.destroy()
      destroy(rootModel)
    }
  }
})
```

plus `engines.push(rootModel)` at the end of `getPluginManager`. Imports:
`destroy`/`isAlive` from `@jbrowse/mobx-state-tree`, `cleanup` from
`@testing-library/react`. `WebRootModel` from `../rootModel/rootModel.ts` —
`AppRootModel` does not carry `rpcManager`.

## The decision left open

Whether to spend the follow-through, which is **making the ~13 suites
teardown-safe** — an `isAlive` guard or a real disposer on each autorun that
outlives its tree — and only then landing the hook. There is no cheap version:
the driver-only half was the candidate and it does nothing.

Argument for: it restores a diagnostic that is currently dead, frees the jest
worker settings from being correctness-critical, and the fixes are in autoruns
whose lifetime handling is genuinely wrong. Argument against: it is a real
project with a wide blast radius across plugins, for no user-visible bug today.

Start from the synteny `afterAttach` stack above — it was the first and most
frequent, and the other suites may share the pattern rather than each needing
their own fix.
