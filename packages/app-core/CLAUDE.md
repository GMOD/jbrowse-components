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

## dockview's layout event is a microtask; its panel events are not

`onDidLayoutChange` is an `AsapEvent`, which `queueMicrotask`s its fire.
`onDidRemovePanel` / `onDidActivePanelChange` are plain `Emitter`s and fire
synchronously.

So a `try/finally` flag held across an imperative burst guards the panel events
and **can never** guard the layout event — the microtask only runs once the
stack empties, long after the `finally`. Don't reach for a flag there; compare
before writing (`layoutsEqual`).

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
during re-parenting. It fires for real closes and for our own restructures —
telling those two apart is the sole job of `withSuppressedPanelRemoval`.

## Products key `<App>` on `session.id`

jbrowse-web, -desktop and -react-app all do. So a session swap remounts the
dockview container and `session` is effectively constant for a mounted
controller; undo (`applySnapshot` on the same node) keeps the id and does not
remount, which is why the re-apply autorun exists at all.
