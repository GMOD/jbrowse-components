# @jbrowse/app-core

The workspaces seam: **dockview owns the grid** (panels, groups, sizes, active
panel — persisted as the opaque `dockviewLayout` blob) and **MST owns which
views live in which panel** (`panelViewAssignments`), because "a panel holds a
stack of JBrowse views" is our concept, not dockview's. Everything hard in
`ui/App/useDockviewController.ts` is keeping those two consistent.

That is also why the seam is ours rather than dockview's: nine of the ten
imports from `dockview-react` are `import type`, and the bugs that live here are
reconciliation bugs, not library bugs. Vendoring dockview has been proposed and
rejected —
[ADR-057](../../agent-docs/architecture-decision-records/adr-057-dockview-stays-external.md)
records why, and what would actually retire the friction.

## `session.views` is the order; a panel assignment is the grouping

One ordering, both layout modes. `getViewsForPanel` reads a panel's membership
off `panelViewAssignments` and then renders those views **in `session.views`
order**, so the assignment array's own order carries no meaning and nothing may
read it as one.

It used to, and two arrays each claiming to be the order meant one user intent
needed two implementations picked by mode. `replaceView` (put a new view where
an old one was) was the first operation that could not express itself to
whichever ordering happened to be live, and the fix was not a third case but
deleting the second ordering.

So the mode now decides the **scope** of a move and nothing else:
`reorderWithin(views, idx, direction, inScope)` — `@jbrowse/core/util/reorder`,
driven from product-core's `Session/MultipleViews.ts`, not from here — moves
past the previous view _in this panel_, leaving out-of-scope views pinned in
their slots. `ViewMenu` passes the panel's members as the scope, or nothing at
all in the classic stack.

An order arriving in another vocabulary lands in `session.views` too: a session
spec's `layout` lists views per panel, top to bottom, and `applyInitLayout`
applies that with `orderViews` rather than leaving it implicit in the
assignment.

What this does **not** unify is _which_ panel a replacement lands in. A new view
arrives unassigned and reconcile homes it to the active panel, which is the
replaced view's panel only because clicking into a view activates its panel.

## dockview tells you whether you or the user did it — use that, not a flag

`DockviewOrigin` is `'user' | 'api'`. Everything entered through `DockviewApi`
is tagged `'api'`; every user gesture is `'user'`. It reaches us two ways:

- `onDidActivePanelChange` carries `origin` on the event.
- `onWillMutateLayout` / `onDidMutateLayout` bracket each top-level structural
  mutation with `{kind, origin}`, and nested calls **join the outermost
  bracket**, so one compound operation (a drag that relocates a panel) is one
  bracket rather than three. `onDidRemovePanel` fires inside it, which is how
  the controller answers "did the user close this tab, or am I restructuring?"

This replaced a `try/finally` flag (`withSuppressedPanelRemoval`) that we set
around our own calls. That flag was not wrong, it was **unenforceable**: nothing
made a newly added restructure remember to wrap itself, and a forgotten wrap
silently closes the user's views. Don't reintroduce one.

### The one `pnpm patch` in the repo lives here

`patches/dockview-react@8.0.0.patch` sets `createContextMenuItemComponent` to
`undefined` in `DockviewReact`'s framework options. Upstream sets it
unconditionally, and dockview-core reads a non-null value there as the consumer
_declaring intent_ to use context menus — a feature in the paid `ContextMenu`
module — so it logs, on every mount:

```
dockview: `createContextMenuItemComponent` requires the "ContextMenu" module,
which ships in dockview-enterprise.
```

It is a deduplicated `console.error`, not a throw, and nothing degrades: without
the enterprise module the feature cannot work whether or not the option is set,
so dropping it costs us nothing we had. But it is a `console.error` in every
workspaces session that reads as a real failure and advertises a paid product,
so it is worth the repo's first patched dependency.

`dockviewEnterprisePatch.test.tsx` pins it, and pins it through `DockviewReact`
rather than `createDockview` — a bare `createDockview` never sets the option, so
testing that path passes whether or not the patch is applied and proves nothing.

Per
[ADR-057](../../agent-docs/architecture-decision-records/adr-057-dockview-stays-external.md),
a patch carried across more than a release or two is the signal that our needs
and upstream's have diverged. **Try deleting it at every dockview bump** — if
upstream fixed it the patch will refuse to apply, which is the reminder.

### Two caveats to check before leaning on origin

- `DockviewApi.addGroup` is the one method upstream does **not** wrap in
  `withOrigin('api')` — every sibling is — so our own `addGroup` reports
  `'user'`. Harmless today (adding a group removes no panels, and the empty
  group has no active panel to report), but don't build a rule that needs it.
- **`onDidLayoutChange` has no origin**, and cannot get one: it is an
  `AsapEvent` that `queueMicrotask`s a _coalesced_ fire, so by the time it runs
  no mutation is in flight and several may have merged. It is also the only
  signal for splitter drags, which are not structural mutations at all. Persist
  from it by comparing before writing (`layoutsEqual`) — that part stands.

It matters because dockview re-fires the layout event after every layout we
install ourselves: `fromJSON` on restore and on undo, the tile presets. The
session is the TimeTraveller's target, so writing that echo back counts as a
fresh edit — an undo's echo lands 300ms later and `addUndoState` splices away
the redo stack.

Compounding it: `types.frozen` set to a deep-equal-but-new object **still**
fires `onSnapshot` (MST compares the snapshot computed by reference), so a fresh
`api.toJSON()` always reads as a change.

## One autorun, three ordered steps

`init` → re-apply `dockviewLayout` → `reconcilePanelAssignments`. Each step
reads the panel set the one before it installs. Split across separate reactions
their relative order is an accident of registration, and for undo it is the
wrong one: reconcile fires first, judges the restored assignments against the
panels undo is about to replace, and prunes every one of them as dead.

## Step 2 fires on the session's layout moving, never on dockview disagreeing

Those read as the same test and are not. Dockview disagrees with the persisted
blob for the whole window between an imperative mutation and the microtask that
records it, so `!layoutsEqual(api.toJSON(), dockviewLayout)` is _true by
construction_ during any of our own `addPanel`/`addGroup` calls. Whatever else
re-enters the autorun in that window then "restores" the layout the user just
left — undoing the tab they opened. Step 2's one caller is undo, so it compares
`dockviewLayout` against the value the previous run saw and only then against
dockview.

The re-entry is not hypothetical, it is the common case: `addPanel` fires
`onDidActivePanelChange` **synchronously**, that writes `activePanelId`, and
reconcile subscribes to `activePanelId` the moment it homes a view. So the
autorun ran from inside dockview's own emitter, and `fromJSON` disposed every
group while that emitter was still walking its listener list — the next listener
touched its disposed React part and threw
`invalid operation: resource is already disposed`.

Filtering `onDidActivePanelChange` on `origin === 'user'` removes the re-entry
our _own_ api calls cause, which is where that crash came from. It cannot remove
all of it — a user gesture that writes to the session is a mutation in flight
too, and that write is one we want. Hence the third mechanism below.

## The invariant: the autorun never touches dockview mid-mutation

The two guards above each remove a _reason_ to re-enter dockview. Neither makes
re-entering impossible, and the case that escapes both is not exotic: a user
gesture writes to the session, some **other** model reacts to that write by
setting `init` (`setPendingMove` is public API precisely so plugins can), and
`applyInit` then calls `api.clear()` from inside the user's own close.

So the autorun refuses to run while dockview is mid-mutation at all. It reads
`mutationOriginRef` (`undefined` means no mutation in flight), sets a deferred
flag, and returns; `onDidMutateLayout` resumes it on a **microtask** — not
inline, because that event is itself a dispatch and a mutation started from
there would nest inside the listener loop. `resumeTick` is an observable box
purely so a deferred autorun can be re-run on demand.

That case violated the invariant for a long time while looking fine, surviving
on the accident that `applyInit` calls `clearPanelAssignments` _before_
`api.clear()`, so the removes it triggers find no assignments to act on. Reorder
those two lines and every view in the session is deleted, silently. That is why
the invariant is tested as an invariant: `dockviewReentrancy.test.ts` asserts
"no api call at mutation depth > 0" across every workspace operation, rather
than asserting the symptom, which depends on which listener happens to run next.

Removing any one of the three mechanisms fails a different test. They are not
redundant.

## An assignment is what marks a view as "homed"

So a stale one is worse than none. `getPanelContainingView` returns truthy, the
homing loop skips the view, and nothing renders the panel it names — the view is
invisible with no error. Reconcile drops assignments naming panels dockview
doesn't have _before_ homing, for that reason.

## `init` is a standing request, not a mount-time read

`loadSessionSpec` launches views one awaited handler at a time and sets `layout`
last. A visitor whose `useWorkspaces` preference is already on has the container
mounted by the time the first view lands, so reading `init` only in `onReady`
dropped exactly those spec layouts on the floor. It is applied whenever it
appears, at mount and after.

It is also the _only_ "arrange the panels like this" channel. `pendingMove` was
a second, volatile one saying the same thing, consumed in the same place;
ViewMenu now writes an `init` (using `direction: 'tabs'` for "move to new tab").

`setPendingMove` survives as **sugar over `init`**, and has to: it is public API
an external plugin calls behind a `'setPendingMove' in session` guard
(jbrowse-plugin-protein3d, putting a protein view beside its genome view).
Deleting the action along with the channel did not fail anywhere — the plugin
feature-detects, so it silently stopped asking for a split and started stacking,
and the only thing that noticed was a website figure eight commits later. Keep
the entry point even when its storage changes; a capability-detecting caller
cannot tell you it lost a capability.

## `DockviewLayoutNode` is not isomorphic to dockview's grid

dockview forces branch orientation to **alternate by depth**, so a `horizontal`
nested inside a `horizontal` in our tree is flattened into siblings of one
branch. There is no single group to address for a nested container, which is why
`size` is honoured only on the top-level split — and only when every panel there
carries one, the pass being all-or-nothing, so one nested `size` silently kills
the outer split's too. `loadSessionSpec` notifies rather than dropping the
numbers in silence.

Making sizes work at depth means building dockview's serialized grid and handing
it to `fromJSON`, **not** recursive `setSize`. Don't bolt size math onto
`applyInitLayout`.

## Closing a panel closes its views, and that is safe

`onDidRemovePanel` removes the panel's views from the session. Dragging a tab
between groups does not trip it: dockview's `_moving` lock suppresses the event
during re-parenting. It fires for real closes and for our own restructures, and
the origin of the enclosing mutation is what tells those apart (above).

Both directions are pinned by tests, because both failure modes are silent: a
close that does not reach the session strands views in a panel nobody renders,
and a restructure that does reach it deletes the user's views mid-retile.

## Products key `<App>` on `session.id`

jbrowse-web, -desktop and -react-app all do. So a session swap remounts the
dockview container and `session` is effectively constant for a mounted
controller; undo (`applySnapshot` on the same node) keeps the id and does not
remount, which is why the re-apply autorun exists at all.
