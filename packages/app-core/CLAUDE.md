# @jbrowse/app-core

The workspaces seam: **dockview owns the grid** (panels, groups, sizes, active
panel — persisted as the opaque `dockviewLayout` blob) and **MST owns which
views live in which panel** (`panelViewAssignments`), because "a panel holds a
stack of JBrowse views" is our concept, not dockview's. Everything hard in
`ui/App/useDockviewController.ts` is keeping those two consistent.

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
