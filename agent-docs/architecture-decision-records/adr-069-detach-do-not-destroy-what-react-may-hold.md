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
- jbrowse-desktop's `destroyPluginManager` takes the same shape at its own swap:
  `detach()` then `scheduleDetachedDestroy`, with the worker pool and the
  autosave autorun on `addDetachDisposer`. Every route that replaces a session
  lands there (Open session, Open link, Return to start screen, and a launch
  target pushed from the main process), as do the two that abandon a manager
  React never installed.

  **This one is preventive.** Desktop destroyed synchronously, so its
  `beforeDestroy` hooks did run and Apollo's report is not about it; what it had
  was the ordering hazard, and the reason to fix it anyway is that an invariant
  one product keeps and the other doesn't is worth less than either.
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

- **A whole-session `applySnapshot` is a fourth door into a view, and undo is
  it.** `TimeTraveller.undo()`/`redo()` replaces the session in place; every view
  carries an `ElementId`, so MST reconciles by identifier and destroys what the
  target snapshot lacks, inside the action, with the components mounted. Same
  sequence, and no call site to fix — so `TimeTraveller` asks its target to take
  those views out first, through an optional `takeOutViewsMissingFrom` that the
  session implements next to `takeOut` (core cannot import product-core, which is
  why the call is duck-typed rather than an import). It sits inside the
  `skipNextUndoState` bracket, because a detach patches the tree: outside it, the
  patch would be recorded as an undoable step of its own and shift the history
  under the index being applied.

  Measured on a redo across a closed view, with the restored view repainted
  first: 4 liveliness reads of its display and `getContainingView`'s throwing
  branch running, down to none. That throw reached no boundary only because the
  same action empties `session.views`, so React unmounts the component in the
  same update and never reads the computed the exception was stored in — which is
  containment by coincidence, not by design.

**The rule stops at the view, and stopping there is part of it.** A track or a
display the snapshot drops is still destroyed in place, as it is when you simply
close the track: `hideTrackGeneric` is a plain `tracks.remove` and measures 5
liveliness reads to the undo's 4, same shape, all on the display's
`configuration` and `type`. Detaching below a view is not a further application
of this rule but a worse trade — see "Detach a track or a display too" below.

**A `safeReference` into the detached tree is the live-root asymmetry again**,
and it reaches the widgets. MST hangs the invalidation hook on the reference's
TARGET node, so a reference to the view itself empties on the view's way out
(the hook fires on detach as well as on destroy) and a reference to anything
UNDER the view does not: that node is neither detached nor destroyed, it simply
leaves the session's identifier cache with the view. Reading it **throws** where
destroy-in-place resolved it to undefined.

So `takeOut` empties those references itself — what `onInvalidated` would have
done, while the reference can still be read. Two things about which references,
each of which took its own bug to find:

- **By containment (`isWithin`), not by `widget.view.id === view.id`.**
  `openFeatureWidget` stores `getContainingView(node)`, which inside a
  breakpoint-split or synteny view is the SUB-view, and an id comparison left
  that widget active and rendering. Worse, the matching loop reads every active
  widget's view, so one left behind took the NEXT `removeView` down with it —
  "close a view, then close another, and it breaks".
- **Empty the reference; hiding the widget is not the same thing.** Hiding takes
  the panel off screen and leaves the model in `session.widgets` with its own
  autoruns running — and `BaseFeatureWidget` registers one whose first statement
  reads `self.track`, outside the try/catch that guards the rest of it. So every
  "Replace current view" over an open feature widget logged an uncaught
  `InvalidReferenceError` at the `endBatch` closing the action, from a panel the
  user could no longer see. Over every widget rather than the active ones, for
  the same reason: a widget the user closed keeps its references AND its
  autoruns.

  **Removing the widget outright is the worse fix**, and `viewTeardown.test.tsx`
  is what says so: a `widgets.delete` destroys it inside the action with React
  still mounted over it — this ADR's own rule — and measures three dead reads of
  `HierarchicalTrackSelectorWidget`'s `view` and `trackContainerId`.

Pinned by four tests in `MultipleViews.test.ts`, two of them over
`onReactionError`, which is where an autorun's throw goes when no caller is
there to catch it.

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

**Detach a track or a display too**, so a whole-tree apply could route
*everything* that vanishes through one path instead of stopping at views. It
inverts the rule at exactly the point the rule is about. A detached node is a
**live** root, and what a display reads through is `getContainingView`, which
walks parents and throws when the walk finds no view — so detaching a track turns
the warning a dead display produces into the throw this ADR exists to prevent, on
a node still being rendered. A view is the highest node that walk has to find,
which is why detaching at or above one is safe and below one is not. The cost of
stopping there is stated above and is measured: the same reads the ordinary
close-a-track path already produces, scalars and references only.

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

### A fetch in flight over the detach window still counts as current

`createStopTokenRotation`'s guard is
`!ended && token === current && isAlive(self)`, and a detached node is alive —
so for the one task between the detach and the `scheduleDetachedDestroy` that
follows it, a display inside a closed view is still the current fetch. One that
fails in that window is therefore logged and published rather than swallowed.
`LinearSyntenyDisplay`'s `afterAttach` reaches `getRpcHost` after an await, so
closing a synteny view mid-fetch lands `no session model found!` with
`no matching node found` as its cause — the walk reaching the detached view as
root, every node on the way alive, which is what tells that case apart from the
`alive=false` one the deferred destroy produces.

Accepted, and on the invariant this ADR already relies on everywhere else:
**a detach always hands the node straight to `scheduleDetachedDestroy`**, so the
window is bounded and the guard closes correctly the moment it fires. Nothing is
dropped — `rotation.dispose` is an `addDisposer`, so the token is stopped on that
destroy and the worker stops with it, a task later than it could have. Inside the
window the cost is a console line and a `setError` on a node about to be freed,
and the throw is inside `runFetchOnce`'s own catch, so it cannot reach a boundary
— which is the failure this ADR is about.

Both fixes are ones already rejected above. There is no cheap "am I still in the
app tree" predicate to widen the guard with: a display under a detached view has
a parent and is alive, so the test would be per-call-site and `isAlive`-shaped.
Closing the window properly means cancelling every fetch under a view on detach
rather than on destroy, which is teardown work moved back into the action the
detach exists to keep it out of. `SyntenySettingsMenu.test.tsx`,
`DotplotSettingsMenu.test.tsx` and `appendRow.integration.test.ts` take the two
messages rather than print them, and assert they were still provoked so the
filter cannot outlive its cause.

### `isSessionModel*` cannot stand in for `isAlive`

The `isX(thing)` predicates in `core/util/types` are **capability** checks, and
they answer `true` for a destroyed node. Each is a chain of `in` tests
(`isSessionModel` is `'rpcManager' in thing && 'configuration' in thing`), and
`in` does not invoke the getter, so MST's `assertAlive` never runs. Measured
against the fork:

```
live:  'rpcManager' in s = true
destroy(root); isAlive(s) = false
dead:  'rpcManager' in s = true      <- the guard still passes
```

This is worth stating because the wrong version is the intuitive one. A guard
written as "the session might be gone by the time this async continuation runs"
reads as defending exactly the window this ADR is about, and does nothing of the
kind: it passes, and the very next line reads a property off the dead node.
`d40eae3cab` added one to `indexJobsModel.setWidgetStatus` on that reasoning,
and `8936c9f763` removed it and five others.

Two further things make such a guard worse than useless there. Reaching the
session at all is usually a `getParent` hop, and `getParent` on a dead node
**throws** (`Failed to find the parent of X [dead] at depth 1`) — before the
guard it was meant to sit behind can run. And reads of a dead node are not
uniformly loud: a view returns its value silently, and only a property read
warns, so a fake guard can look like it is working for a long time.

If liveness is genuinely the question, `isAlive` is the answer. Usually it is
not the question — as above, the right fix is that the tree does not outlive its
teardown, not that every caller re-checks.

## Tests

Each fails without its fix and is scoped to what is deterministic:

- `products/jbrowse-web/src/tests/rootModelTeardown.test.tsx` — real teardown,
  real component tree, React's real render-logging, zero dead reads *while the
  superseded root is still alive*, and the root dead afterwards. The two halves
  are the whole decision, and the first without the second is what #5618
  shipped; it buckets by `isAlive` rather than by a timer so neither half can
  quietly become the other.
- `products/jbrowse-web/src/tests/pluginLifecycleHooks.test.tsx` — the same
  reload, asserting the plugin-facing half: an Apollo-shaped fixture (a socket on
  a `.volatile()`, a `window` listener, an `AbortController`, and `beforeDestroy`
  rather than `beforeDetach`) registered at both of Apollo's extension points,
  since an internet account lives on the rootModel and a session extension on the
  session. It waits on the socket rather than on `isAlive`, so a regression fails
  saying the socket is still open — which is what was reported — and the pre-fix
  code fails it there. This is the entry the rest of the list could not be: every
  hook in this repo is one we could equally have called explicitly, which is why
  a suite full of teardown tests stayed green through #5618.
- `products/jbrowse-desktop/src/components/StartScreen/destroyPluginManager.test.ts`
  — the same contract at desktop's call site, with a smaller account of its own,
  plus the ordering half specifically: the root is still alive immediately after
  the call and the worker pool is already stopped. A forward guard rather than a
  reproduction, per the desktop bullet above.
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
  the view is still in the session when `beforeDetach` runs, and, for the
  snapshot door, that `takeOutViewsMissingFrom` detaches rather than destroys and
  treats a changed `type` under a kept id as a different view.
- `products/jbrowse-web/src/tests/undoTeardown.test.tsx` — the same measurement
  at the undo door, on the real recorder rather than a hand-built history:
  close a view, wait for the 300ms debounce to record it, undo, repaint, redo.
  Two things keep it honest — it asserts `canRedo` before the redo, so a debounce
  that had truncated the forward history would fail rather than silently measure
  an empty action, and its second test pins the SCOPE from the other side, that
  undoing a track open is no worse than closing the track. That one fails if
  either path starts throwing, which is what a well-meant detach below a view
  would do.
  `teardownNoise.ts` is the shared capture, and it scans every console argument:
  MobX reports an uncaught error in a reaction as `console.error(message, error)`,
  so a first-argument-only filter buckets the throw as ordinary noise.
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
