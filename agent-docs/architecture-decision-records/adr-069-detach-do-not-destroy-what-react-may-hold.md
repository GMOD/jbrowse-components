---
status: Accepted
summary: "An MST node React may still be rendering is detached, never destroyed in place. Destroying it is what turned a plugin install into a white page, and no deferral is provably long enough"
---

# ADR-069: detach, do not destroy, a tree React may still hold

## Status

Accepted (2026-08-13).

## Context

A plugin install rebuilds jbrowse-web in place: a replacement `SessionLoader` is
built and the old one, with its `pluginManager` and rootModel, is torn down. That
teardown ran from a React effect cleanup, and it destroyed the outgoing tree
there.

React is not finished with the outgoing props at that point. Its dev-mode
`logComponentRender` diffs each component's previous props against its new ones
and recurses four levels into any plain object it finds, which reaches the
rootModel through `{pluginManager}` and the session below it. Reading a
destroyed MST node warns; reading a child node that was never materialized
**throws** `the creation of the observable instance must be done on the
initializing phase`, because `createObservableInstance` asserts the node is
INITIALIZING and a dead one is not. That throw went through React's error
boundary and took the page down (#5616, #5618).

Which of the two you got was decided by whether the property the walk happened
to land on had been read before — that is, by what the user had open.

The same shape had a second door. `setSession` did `self.session = cast(...)`,
and replacing an MST property destroys the old subtree **in place, inside the
action**. MobX runs an action's pending reactions at the `endBatch` closing it,
so every observer over that session got a final run against a node that died
mid-action: 19 liveliness reads on an ordinary volvox session. Every way a user
reaches a different session — New Session, opening a saved one, import, factory
reset — goes through it.

## Decision

**A tree React may still be rendering is detached, not destroyed.** Concretely:

- `disposeLoader` no longer destroys a superseded loader (it needed no teardown;
  `deactivate()` already released what held it open).
- `disposePluginManager` calls `rootModel.detach()`, a new action that runs the
  things reaching *outside* the tree — the `beforeunload` listener, the
  sessionStorage and IndexedDB autoruns, registered through `addDetachDisposer`
  rather than `addDisposer` — and leaves the tree alone.
The same shape applies to `setSession`, where the outgoing session would be
detached inside the action and destroyed on a later task. That one is proposed
rather than landed (#5621) and is a weaker case: measured, every read there is
of a scalar or a reference, which warns and cannot throw, so it buys a quieter
console rather than preventing a crash.

## Rejected

**Defer the destroy.** The obvious fix, and the one PR #5616 proposed. It works
for the reported crash and does not generalise: a `queueMicrotask` around the
rootModel destroy takes the dead reads from 16 to **4**, not to 0, because
`act()` drains microtasks between flushes and a later one still diffs a widget
React is holding. There is no delay provably long enough, which is the whole
reason this is a rule and not a timing tweak.

The one place a timer *is* used — `setSession` — is not that shape. It waits for
this action's `endBatch`, a synchronous bounded flush, not for React to release
fibers. Deferring it 250ms instead of 0 changed the residual from 14 to 16, i.e.
nothing, which is the evidence that the wait is not doing hopeful work.

**Never destroy anything.** Available for the loader, not for the rest.
`beforeDestroy` is a plugin-facing contract: jbrowse-plugin-apollo aborts the
`AbortController` for its in-flight fetches there, and core's `BaseTrackModel`
releases the `rpcSessionId` claim that lets `CoreFreeResources` evict a parsed
adapter from the worker. Detaching and never destroying zeroes the warning count
while leaking both, the adapter one without bound across repeated switches.

**Guard the getters with `isAlive`.** Tried on
`HierarchicalTrackSelectorWidget.trackContainer` and reverted. A model getter
defending itself against its own node being dead is a band-aid over the actual
problem — something is still observing a computed on a tree being destroyed —
and it did not work either: the residual stayed flaky, because the next getter
along has the same exposure.

## Consequences

The dangerous window is empty and deterministically so, on both paths: while
components are mounted over a tree, nothing reads a dead node. In a browser the
plugin-install path went from **46 dead-node reads to 0**.

It does **not** make the console silent. A session switch still logs ~14 reads
while the detached tree is destroyed, down from 19. What changed is where a read
can land: those are now plain reads on a tree nothing renders, and the throw
they can produce lands in a `setTimeout` callback instead of React's error
boundary. Severity, not volume.

It does not promise prompt collection either. Measured with a `WeakRef` after a
forced gc, a superseded root is still reachable — and so is one that has been
`destroy`ed, so the retention is not something this introduces. The likely cause
is filed separately: mobx-react `observer()` reactions from renders React
discarded are never disposed, and go on observing the tree. See
[TODO.md](../TODO.md).

## Tests

Each fails without its fix and is scoped to what is deterministic:

- `products/jbrowse-web/src/tests/rootModelTeardown.test.tsx` — real teardown,
  real component tree, React's real render-logging, zero dead reads.
- `products/jbrowse-web/src/components/workerPoolTeardown.test.ts` — a spy on
  `rpcManager.destroy`, because the bug was that nothing called it. No harness
  here can watch a worker thread die; see [TODO.md](../TODO.md).
- `plugin-reload-browser-tests` carries a browser suite for the same reload,
  where the production-build failure is visible and jsdom's is not. It lands
  once its prerequisites are merged.

`enableReactRenderLogging.ts` is what makes any of this observable under jest:
React gates render-logging on `console.timeStamp` and `performance.measure`
both being functions, jsdom supplies neither, and that single fact is why the
whole suite was blind to a crash a user hit on first load.
