---
name: destroying-an-mst-tree-that-something-still-observes
description: the boundaries are already clean; measured, the discarded unit is a whole boundary subtree and the leak is app-wide, not the drawer's four
metadata:
  area: app-core, drawer
  category: measure-first
---

# Destroying an MST tree that something still observes

The residue of the setSession fix, and the one part of this area still open.

`setSession` no longer destroys the outgoing session inside its own action — it
detaches, and destroys on a later task — so the in-action window is empty, and
deterministically so: while components are still mounted over that session,
nothing reads a dead node. It was 19 reads on an ordinary volvox session; it
is 0.

What is left is the teardown itself. Destroying a detached tree invalidates
computeds *inside* it that something still observes, and MobX recomputes them
against the nodes being killed. In jsdom that is 0-3 reads per switch; in a real
browser, 14 — against 19 before the fix, so the console noise barely moved, and
that is the honest summary of what the fix bought here. Every read measured on
this path, before and after, is of a scalar or a reference — `type`, `view`,
`trackContainerId` — which warns and cannot throw. The crash shape that makes
this a rule elsewhere, an unmaterialized *complex* child, is the loader path's
(#5618) and was not found under `setSession`. What did change is placement: the
remaining 14 are plain reads (`Action: ''`) on a detached tree with nothing
rendering it, where before they were inside the action with components mounted
over them.

**Waiting longer does not help, measured.** Deferring the destroy 250ms instead
of 0 gave 16 rather than 14, i.e. noise. So the residual is not a race with
React finishing its unmount, and no amount of delay is the fix — which is what
makes the next paragraph the actual one.

**The answer is not an `isAlive` guard in the getter.** That was tried and
reverted. A model getter defending itself against its own node being dead is a
band-aid over the real problem — that something is still observing a computed on
a tree being destroyed — and it did not even work: the residual stayed flaky,
because the next getter along has the same exposure.

**What still observes it has been identified.** Read
`_getGlobalState().trackingDerivation` at the moment of the warning and walk up
`observers_` to the derivations with no observers of their own, and it is the
same four every run:

```
ComputedValue :: HierarchicalTrackSelectorWidget.trackContainer
  observed by  Reaction :: observerHierarchicalTree
               Reaction :: observerBadgeDropdownTracks
               Reaction :: observerTrackCheckbox
               Reaction :: observerOverrideBadge
```

Those are mobx-react `observer()` component reactions, all of them in the
track-selector drawer. Two things narrow it further:

- **They are live, not awaiting collection.** mobx-react-lite disposes a
  reaction either on unmount or through a `FinalizationRegistry` when the
  component is collected, so "abandoned reactions from renders React discarded"
  was the obvious theory. It is wrong: forcing `global.gc()` before the destroy
  changes the count not at all. Something holds them strongly.
- **The drawer spans the swap.** Old and new sessions carry the same widget
  keys (`hierarchicalTrackSelector`, `GridBookmark`), so the drawer is mounted
  continuously across it, and its subtree is the natural candidate for React to
  reconcile rather than remount — leaving those reactions pointed at the old
  widget until they next render.

**They never go away, and StrictMode is what decides it.** Take the old widget's
`trackContainer` ComputedValue, count its `observers_` across a switch, and flip
RTL's `reactStrictMode`:

| | observers before | after the switch | dead reads |
| --- | --- | --- | --- |
| StrictMode off | 20 | **11** | 2 |
| StrictMode on | 11 | **0** | 0 |

Reproducible both ways. So StrictMode is not the cause of the surviving
reactions — it is the cure, and its absence is the bug. Without it, roughly half
the `observer()` reactions in the track selector (`observerOverrideBadge` ×7 of
14, `observerBadgeDropdownTracks` ×2 of 4) are never disposed. They stay
attached to the old widget's computed permanently, and a forced `global.gc()`
does not reap them, so they are strongly held rather than awaiting
finalization — mobx-react-lite's `FinalizationRegistry` path is not what this
is. StrictMode's extra mount/unmount cycle evidently drives the disposal that
the plain path skips.

**That makes it production-only.** `products/jbrowse-web/src/index.tsx` wraps
the root in `<StrictMode>`, which double-invokes in a development build and is
a passthrough in a production one. So a developer never sees this, and the
shipped bundle has it — which is a fair account of why this area reads as
perennially flaky, and it matches the browser measurement, taken on a
production build, still showing a residual after the setSession fix.

Two consequences, and the second is the reason to care past console noise:

- Destroying the outgoing session is loud because these still observe it. That
  is the residual this entry is about.
- Reactions that never dispose keep the old tree **observable and reachable**,
  which is the likely explanation for the `WeakRef` measurement in
  [ADR-069](../architecture-decision-records/adr-069-detach-do-not-destroy-what-react-may-hold.md),
  under "It does not promise prompt collection either": a superseded root still
  resolving after a forced gc, including one that had been `destroy`ed. That was
  logged as unexplained; this is the candidate.

**Why the non-StrictMode path skips disposal.** `useObserver` creates the
reaction during *render*, and has exactly two ways to dispose it:

- the cleanup returned from its `useSyncExternalStore` `subscribe`, which React
  calls on unmount — and only ever calls for a render it **committed**;
- `observerFinalizationRegistry`, registered as
  `register(admRef, adm, adm)` — keyed on the React **ref object**, so it fires
  only when React's hook state for that component is garbage collected.

mobx-react-lite is explicit that the second exists for the first's gap:
"StrictMode/ConcurrentMode/Suspense may mean that our component is rendered and
abandoned multiple times, so we need to track leaked Reactions."

The gap is real here, and this is the measurement that shows it rather than
infers it: after an ordinary load, **14 `observerOverrideBadge` reactions exist
and `document.querySelectorAll('[data-testid^="htsTrackLabel-"]')` finds zero
rows**, with zero disposals recorded. Reactions with no DOM behind them are
components React rendered and threw away — never committed, so never mounted,
so never unmounted, so the `subscribe` cleanup never ran. And the registry
cannot save them because React keeps the ref: six forced `global.gc()` calls
move the count not at all.

With `reactStrictMode` the same load produces 7, and all 7 are disposed at the
switch. Without it, 14, of which 7 survive forever.

**Narrowed to a 30-line reproduction, with no jbrowse in it.** One `observer()`
component inside a `Suspense` boundary where something else suspends leaks a
Reaction per discarded pass:

```tsx
const box = observable.box(1)
const Obs = observer(function Obs() {
  return <div data-testid="obs">{box.get()}</div>
})
const gate = new Promise<{ default: ComponentType }>(res => { release = () => { res({ default: () => <div /> }) } })
const Lazy = lazy(() => gate)

render(
  <Suspense fallback={null}>
    <Obs />
    <Lazy />
  </Suspense>,
)
// observers of `box` here: 2
await act(async () => { release(); await gate })
// observers of `box`: 3, with ONE <Obs> in the DOM, and six forced
// global.gc() calls do not reduce it
```

Control, the same component with nothing suspending: **1 observer, 1 in the
DOM**. So the leak is the suspending sibling, not the component.

The structural match in the app is exact and doubly so.
`packages/app-core/src/ui/App/App.tsx` renders
`<Suspense fallback={null}><DrawerWidget session={session} /></Suspense>` with
`DrawerWidget` itself `lazy()`, and the track selector's own `ReactComponent` is
`lazy()` again (`HierarchicalTrackSelectorWidget/index.ts`), with more lazy
dialogs below it in `HamburgerMenu.tsx` and `TrackCategory.tsx`. Every one of
those is a chance for a pass to be discarded, and every `observer()` rendered in
that pass keeps a Reaction for the life of the tab.

That is the whole chain: lazy inside Suspense discards a render → the reaction
created during it is never subscribed, so never disposed → the registry cannot
collect it because React holds the ref → it goes on observing whatever it read,
which is how a destroyed session still has observers.

**There is a fix, and it is ours rather than upstream's.** React discards the
render of everything inside the *nearest* Suspense boundary, so a boundary
shared between an `observer()` and a `lazy()` is what does the damage. Give the
lazy its own:

| | while suspended | after resolve | in DOM | leaked |
| --- | --- | --- | --- | --- |
| `<Suspense><Obs/><Lazy/></Suspense>` | 2 | 3 | 1 | **2** |
| `<Obs/><Suspense><Lazy/></Suspense>` | 1 | 1 | 1 | **0** |

Same components, same lazy, same timing — only the boundary moves, and the leak
goes to zero.

**Do not file this upstream as a bug.** It was checked before recommending, and
mobx-react-lite already knows: `useObserver` on `main` is unchanged from the
version here, and mobx-react-lite#332 introduced the `FinalizationRegistry`
deliberately for this exact case, on the stated grounds that "React no longer
guarantees it will call cleanup functions". GC-based disposal is the intended
remedy and its non-deterministic timing is a documented caveat, not an
oversight. A report saying "reactions from uncommitted renders are not disposed
promptly" would be restating their design.

## The boundary audit is already clean, and the leak is bigger than the drawer

The measurement the paragraph above asked for has been taken, in jsdom rather
than a browser: a jbrowse-web test (`createView` on a one-track volvox config,
React 19.2.8, no StrictMode) with `Reaction` subclassed to log every
`observer*` creation, `OverrideBadge` wrapped in a render/commit counter, and
`getObserverTree(widget, 'trackContainer')` read at the end.

- `trackContainer` carries **10 observers with 2 rows in the DOM**; `OverrideBadge`
  **renders 4 times and commits twice**. So exactly one full pass is discarded,
  matching the browser's shape at a smaller N.
- The creation histogram says where that pass starts and stops. Everything from
  `ClassicViewsContainer` down (`ViewStack`, `ViewContainer`, `ViewWrapper`,
  `LinearGenomeView`, the whole LGV header and scalebar) and everything from
  `DrawerWidget` down (`Drawer`, `DrawerHeader`, `WidgetBody`,
  `HierarchicalTrackSelector`, every row) is created **exactly twice**. `App`,
  `ViewsContainer`, `DialogQueue`, `AppFab`, `Snackbar` are created **once**.
- Those two doubled roots are precisely the children of two Suspense
  boundaries — `ViewsContainer.tsx`'s and `App.tsx`'s drawer one. The discarded
  unit is a **boundary's whole child subtree**, not an `observer` sibling of a
  `lazy`.

**So "audit the drawer's Suspense boundaries" does not close it: they are
already clean.** Every `lazy` on this path has its own boundary with no
`observer` sibling inside it — `App.tsx:69` wraps only `DrawerWidget`,
`WidgetBody` wraps only the widget's `ReactComponent`, `HamburgerMenu`'s and
`TrackCategory`'s dialogs are queued into the session dialog stack, and
`DrawerHeader`'s boundary holds a component that is not lazy at all.

**What actually suspends** is a lazy one level *below* a boundary that has not
committed yet. During the discarded pass, `ClassicViewsContainer` reaches the
LGV's `ReactComponent` (`plugins/linear-genome-view/src/LinearGenomeView/index.ts:47`)
and `DrawerWidget` reaches the track selector's
(`HierarchicalTrackSelectorWidget/index.ts:19`). Each of those has its own
`Suspense`, but the boundary enclosing it is itself mid-mount, so React
restarts the outer attempt rather than committing an inner fallback into a tree
nobody can see yet. Mounting a second time in the same module registry — where
both `lazy` payloads are already resolved — stops the doubling of those
subtrees, which is what pins it on the suspension rather than on anything else
in the pass.

The 30-line repro above still reproduces exactly as written (3 observers with 1
in the DOM shared, 1 and 1 split), so the shared-boundary shape is real. It is
just not the shape this app is hitting.

Two consequences for the entry:

- **The size is wrong by an order of magnitude.** It is not 14 reactions in the
  track selector; it is one per `observer` under either boundary, which at load
  is most of the app tree. The drawer's four were only the ones the
  destroyed-session warning happened to name.
- **The fix has to be about the cascade, not the nesting.** The candidate is to
  start a child chunk's import when the model that will render it is created —
  a view's `ReactComponent` when the view is added, a widget's when `showWidget`
  runs — so the inner `lazy` is resolved by the time the outer boundary renders
  and the boundary commits once. Not built, and not costed against what it does
  to the initial bundle graph.

Still open, and now the narrower question: a warm second mount stops doubling
the view and drawer chrome but leaves the track selector's own subtree at 3x,
with `PluggableComponent` created 5 times. Something inside the widget suspends
even with every chunk resolved, and that one has not been chased.
