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
  rather than `addDisposer` — and then destroys the tree on a later task, the
  same shape as `setSession` below.

  **The destroy is a correction.** As first written this path detached and never
  destroyed, on the reasoning in "Never destroy anything" below — which was
  right about the loader and wrong about the rootModel, because the whole
  plugin-facing tree hangs off the rootModel. jbrowse-plugin-apollo reported it:
  its internet account closes its websocket in `beforeDestroy` and its session
  aborts its in-flight fetches there, and after #5618 neither ran, on the very
  path its login flow drives. Core loses the same contract quietly —
  `BaseTrackModel`'s `rpcSessionId` release, `TimeTraveller`, `HistoryManagement`
  — and every `addDisposer` in the tree, which fires only on destroy, so the
  superseded app's autoruns and reactions go on running.
- `setSession` detaches the outgoing session inside the action and destroys it
  on a later task (#5621). It is the weaker of the two cases and worth saying so:
  measured, every read there is of a scalar or a reference, which warns and
  cannot throw, so it buys a quieter console rather than preventing a crash. It
  also repairs the restore-on-throw path, which had been re-attaching a
  destroyed node.
- `removeView` and `replaceView` do the same for a view, and this is the
  STRONGEST of the three rather than the weakest: what is mounted over a view is
  a display, and a display's reads reach `getContainingView`, which walks parents
  and **throws** where the session cases warn. `cancer_sv/multihop_split_view`
  showed the whole escalation on one spec — the liveliness warnings, then
  `Error: no containing view found` into an ErrorBoundary, then a missing
  `[aria-label="JBrowse"]` saying the throw had taken the page rather than a lane.

  **A view that reaches outside its own tree moves that work to `beforeDetach`.**
  MST fires it while the node is still attached, which is the whole difference:
  from `beforeDestroy` on the scheduled task the view is a root and `getSession`
  throws out of MST's own teardown. Both comparative views were in that position
  — they give back the read-vs-ref assembly they synthesized — and share
  `releaseTemporaryAssemblies`, which keeps `beforeDestroy` too, for the paths
  that destroy a view without taking it out of a session first.

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

**Never destroy anything.** Available for the `SessionLoader` node itself, and
for nothing else. `beforeDestroy` is a plugin-facing contract:
jbrowse-plugin-apollo aborts the `AbortController` for its in-flight fetches
there and closes its websocket, and core's `BaseTrackModel` releases the
`rpcSessionId` claim that lets `CoreFreeResources` evict a parsed adapter from
the worker. Detaching and never destroying zeroes the warning count while
leaking both, the adapter one without bound across repeated switches.

This is written as a rejected alternative because it was tried: #5618 applied it
to the loader's **rootModel** as well as the loader, and Apollo reported the
websockets. The loader is a boot record with no hooks under it; the rootModel is
the root of everything a plugin builds. The distinction is the whole content of
this entry, and it is not visible from the call site — both are "the outgoing
tree" there.

**A longer deferral, to get the destroy without the noise.** Measured on the
reload, in a production browser: 48 dead reads destroying on a 0ms task, 49 on a
5s one. It is not a race with React finishing its unmount, so no delay is the
fix — the same finding as `setSession`'s 250ms-vs-0, and the same cause, the
undisposed `observer()` reactions in [TODO.md](../TODO.md).

**Guard the getters with `isAlive`.** Tried on
`HierarchicalTrackSelectorWidget.trackContainer` and reverted. A model getter
defending itself against its own node being dead is a band-aid over the actual
problem — something is still observing a computed on a tree being destroyed —
and it did not work either: the residual stayed flaky, because the next getter
along has the same exposure.

## Consequences

The dangerous window is empty and deterministically so, on both paths: while
components are mounted over a tree, nothing reads a dead node. On the
plugin-install path the 46 reads measured in a browser were the app's own
teardown walk (`Action: '.deactivate()'`) destroying nodes it was still
enumerating; detaching in the action takes that to 0, and it stays 0, because
the destroy now happens after that walk has finished rather than inside it.

It does **not** make the console silent, and on the reload path it is louder
than on the others. A session switch logs ~14 reads while the detached tree is
destroyed, down from 19; a plugin reload logs ~48. Same cause both times —
killing an MST tree invalidates computeds inside it that undisposed `observer()`
reactions still watch — and the same severity: every read measured is of a
scalar or a reference (`type`, `configuration`, `view`, `trackContainerId`),
which warns and cannot throw, on a detached tree nothing renders, with no page
error and none of the throw shape. The crash this rule exists for is the
unmaterialized complex child of #5618, which is a read of the tree *while React
still holds it*, and that window is what the detach empties.

**So the count is not the measure of this rule, and reading it as one is the
mistake #5618 made.** Zero reads is also what detaching and never destroying
gives you, and that is strictly worse.

It does not promise prompt collection either. Measured with a `WeakRef` after a
forced gc, a superseded root is still reachable — and so is one that has been
`destroy`ed, so the retention is not something this introduces. The likely cause
is filed separately: mobx-react `observer()` reactions from renders React
discarded are never disposed, and go on observing the tree. See
[TODO.md](../TODO.md).

## Tests

Each fails without its fix and is scoped to what is deterministic:

- `products/jbrowse-web/src/tests/rootModelTeardown.test.tsx` — real teardown,
  real component tree, React's real render-logging, zero dead reads *while the
  superseded root is still alive*, and the root dead afterwards. The two halves
  are the whole decision, and the first without the second is what #5618
  shipped; it buckets by `isAlive` rather than by a timer so neither half can
  quietly become the other.
- `products/jbrowse-web/src/tests/sessionSwitchTeardown.test.tsx` — a real
  session switch, asserting zero dead reads across the action and the reaction
  flush closing it, and that the outgoing session is destroyed afterwards
  rather than left detached and leaking its `beforeDestroy` contracts.
- `products/jbrowse-web/src/tests/viewTeardown.test.tsx` — a view with a track
  open in it, removed and replaced, same scoping. Its third test is the one that
  would otherwise have gone quiet: a comparative view's temporary assembly is
  given back, which the `hasParent` guard would have turned into a leak with
  nothing said if `beforeDetach` were ever dropped.
  `MultipleViews.test.ts` pins the other half of that contract at its own layer —
  the view is still in the session when `beforeDetach` runs.
- `products/jbrowse-web/src/components/workerPoolTeardown.test.ts` — a spy on
  `rpcManager.destroy`, because the bug was that nothing called it. No harness
  here can watch a worker thread die; see [TODO.md](../TODO.md).
- `products/jbrowse-web/browser-tests/suites/plugin-reload.ts` — the same reload
  in a real browser, which is the only place the production build's behaviour is
  visible and the only place "does the app still work afterwards" can be asked.
  It asserts the throw shape, uncaught page errors and 404s, and deliberately
  not the warning count; the counts quoted above were taken with it.

`enableReactRenderLogging.ts` is what makes any of this observable under jest:
React gates render-logging on `console.timeStamp` and `performance.measure`
both being functions, jsdom supplies neither, and that single fact is why the
whole suite was blind to a crash a user hit on first load.
