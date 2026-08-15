# WorkspaceLayout

The workspace is **one MST tree**. No window manager library, no imperative api,
nothing to reconcile: the layout is session state, React renders it, a gesture
is an action.
[ADR-068](../../../../agent-docs/architecture-decision-records/adr-068-workspace-layout-is-an-mst-tree.md)
is the decision — read it before reasoning about an old comment or commit that
names dockview.

## Four levels, and the middle two are the ones people get wrong

```
branch (a split)  >  panel (a grid cell)  >  tab  >  views (stacked vertically)
```

Collapsing tab and view into one level, as the first version did, silently
deletes tabs as a feature. Both middle levels are legal empty — a tabless panel
is what a drag leaves behind, a viewless tab is "new empty tab" — so **nothing
prunes empties as a rule**. `pruneEmptyPanel` / `pruneEmptyTabIn` are called
only by the gesture that just emptied the thing.

**A panel with no tabs renders nothing at all**, not even the launcher an empty
_tab_ shows. Survivable only because the state cannot be held: the prunes
collapse it, `ViewsContainer` renders `ViewLauncher` instead of the workspace
when no views remain, and `homeViews` mints a tab in a tabless panel rather than
declining.

## Ids are random, not a counter

`createElementId()` (nanoid). Panel and tab ids are `types.identifier` and must
be unique **within the tree**, which includes ids in a restored snapshot. The
obvious test passes against the broken version; `integrity.test.ts` is the one
that doesn't.

## `PanelChrome` is the seam

`LayoutRenderer` and below know nothing about views, assemblies or sessions —
what a tab is called and contains arrive as render props, as **one memoisable
object**. It is a prop of every panel, so anything in it that changes per render
defeats `observer`'s memo for all of them and every panel's render rebuilds its
`ViewStack`. Hence `useLayoutDrag` returns memoised `handlers` reading the
in-flight drag from a ref, and `WorkspaceContainer` memoises the chrome — the
React Compiler does not compile `observer(function(){})`.

The `drag` prop is deliberately NOT in the chrome, so it reaches the one cell it
describes and the rest hold still. For the same reason `showDrag` publishes
nothing when the new target would paint the same indicator.

**Reading dockview's source is the cheapest way to settle "right vs merely
working"** when you touch the grid, sash or dnd — it already found one missing
constraint. Where we differ on purpose the comment says so.
`npm pack dockview-core@8.0.0` (the version the comments cite); the dependency
is gone from the lockfile.

## Every pure function in `tree.ts` is total

An MST action guarding its arguments protects that one caller; these are
exported and callable directly, so passing an id not in the tree returns the
tree unchanged. `moveTabToPanel` is the one where this is not a nicety — it
removes then re-inserts, so an unrejected missing target loses the tab and every
view in it. Both layers are tested, because the model guard hides the tree bug
from the model tests. `splitPanel` / `addTab` return `undefined` rather than
claim an id that was never inserted, since `activePanelId` is homing's fallback.

## `session.views` is the order; a tab's `viewIds` is the grouping

Two arrays each claiming to be the order is what made "move this view up" need
two implementations picked by mode.

**`homeViews` keeps them in step and takes the session's WHOLE view list.** It
is two-directional: a view no tab holds lands in the active one, and a view the
list omits is dropped from whatever tab holds it — so passing only the view you
care about unhomes the rest. The parameter is required for that reason.

## Normalisation, and its fixed point

Every operation is `tree in -> tree out` over plain snapshots and must leave the
tree canonical: drop empty branches, replace a single-child branch with its
child, flatten into a same-direction parent, renormalise sizes to sum to 1.

**Normalisation has to have a FIXED POINT, and floating point is why that is not
free.** Dividing by a sum of 1 is not the identity — seven equal panes oscillate
forever between two values, so every action on a settled workspace pushed a
snapshot in which nothing observable changed. `scaleSizes` leaves siblings alone
within `SIZE_EPSILON`. `expectCanonical` cannot catch this: it checks the sum to
six places, which both halves of an oscillation pass.

**Every operation belongs in `integrity.test.ts`'s 2000-step randomised
sequence** — two lines to add. `homeViews` used to close over `activePanelId`
and the id minter and so was outside it; it takes both as arguments now.

**Flattening a same-direction branch is the rule dockview could not express**,
its orientation alternating by depth. Here `size` and nesting work at any depth.

## Sizes are `flex-grow`; there is no resize code

`splitter.ts` moves a boundary _within the combined space of the pair either
side of it_ so every other pane holds still — pure, tested without a DOM, same
split as `dropZone.ts`. Everything else is the browser's.

**`MIN_PANE_PX` is the one pixel in the design, and it is dockview's** (100px).
A share of zero is a legal `flex-grow`, so without a floor a pane can be dragged
or `Home`'d to nothing, taking its tab strip and views with it. Converting it to
a share needs the pair's pixel span — the only reason the handle measures
anything.

## Drag-and-drop: geometry is pure, wiring is thin

`dropZoneAt` (which half of a cell) and `stripDropAt` (which GAP between tabs)
are pure over rects. `stripDropAt` answers by midpoint, which makes it total —
no dead band where a drop degrades into an append. **The strip is tested before
the panel**, since it sits inside the panel's own top edge band.

**What the indicator says is what the drop does, and a drop that says nothing
does nothing.** The centre wash means "be a tab of this cell", so on the cell a
tab is already in, `dropTabInPanel` declines (as dockview does) and
`useLayoutDrag` paints no wash. The rule belongs to the gesture, not to
`moveTabToPanel`, where no index still means append — the only reading a total
function has.

`useLayoutDrag` is the DOM half and deliberately dumb; its React test stubs
geometry and covers **wiring only**.

Pointer events, not HTML5 DnD, for pointer capture — so releasing outside the
window ends the drag. Escape cancels from a `window` listener and clears
`pendingRef` too, since the drag is rebuilt from `pending` on every move.
**Choosing pointer events means owning the three rules the browser was
applying**:

- **Primary button of the primary pointer only.** A right-press left `pending`
  armed, because the native context menu eats the `pointerup`. `Tab` gates
  _activation_ on the same button separately (showing a tab mounts views).
- **One `pointerId` per gesture**, checked in every handler.
- **`pointercancel` ends the gesture** — a touch long-press has no `pointerup`.

**The in-flight drag is React state, never MST**; in the session every
intermediate hover would enter the undo history.

**`index` counts the strip the user is looking at**, so `moveTabToPanel` adjusts
for its own remove-then-insert. Across panels there is no shift.

## Only the shown tab is mounted, and that is the constraint, not an oversight

Next to dockview's always-mounted panels this reads as a gap to close, and
closing it breaks what it looks like it would help: each display costs a WebGL2
context and the ceiling is 16 (`agent-docs/reference/GPU_CONTEXT_BUDGET.md`). It
is also why the tab strip activates **manually** from the keyboard — automatic
activation is the commoner reading of the WAI tabs pattern and this is its
documented exception.

## The strip hides its scrollbar, so it has to scroll some other way

Hiding it removes both the affordance and the means, and a mouse wheel has no
horizontal axis. So the wheel is translated (taking the larger axis, since a
trackpad's `deltaX` is already applied), and a tab that becomes current _without
being touched_ scrolls itself into view. Clicking never needs that; arrowing
gets it from `focus()`.

## Keyboard: the strip is one tab stop, the splitter is operable

A roving tabindex, so eight tabs are one stop. `role="tablist"` wraps the tabs
**alone** — the panel's +/× buttons are not tabs. The splitter takes
arrows/Home/ End, 2% of the pair per press.

**A control rendered INSIDE a tab must stop its keys, the way it already stops
its pointer.** The strip `preventDefault()`s arrows, Home, End, Enter and Space,
all of which bubble out of the tab label — the rename box did not stop them, so
a tab could not be named "Comparison view". Stop the whole event, not the keys
you use. Isolated component tests cannot see this.

## Undo is `applySnapshot`, and nothing has to be told

One owner, so no echo. A settled layout emits no further snapshots at all —
pinned by a test, because the old design's worst bug was the opposite.

## `applyLayoutSpec` is a plain action, not a standing request

A session spec's `layout` is converted and _becomes_ the layout immediately;
there is no `init` property. `spec.ts` keeps the documented URL vocabulary
(`horizontal`/`vertical`/`tabs`, percentage sizes).

**A `tabs` node is where the vocabulary outruns the tree, in exactly two
places**: a `size` on its child describes nothing, and a container child has no
split to become so its views gather into one tab. Both are **reported** by
`loadSessionSpec`; the second used to drop those views silently. Nothing else is
approximated.

**A spec states an arrangement, not a selection** — `treeFromSpec` shows each
cell's first tab, so an action that builds a layout and means to reveal a view
says which one afterwards (`setPendingMove`).

## Three surfaces that will not fail to compile

- **`setPendingMove`** — jbrowse-plugin-protein3d calls it behind
  `'setPendingMove' in session`. Deleting it throws nothing; the plugin silently
  stops asking for a split.
- **`applyLayoutSpec`** — `loadSessionSpec` duck-types it behind an `in` guard
  (an embedded product has no workspace). Rename one side only and every spec
  layout is silently declined.
- **A menu item.** Deleting one compiles and passes every model test; four
  "Global:" tilings went with a component in ADR-068 and nobody noticed for 225
  commits. When a component holding items is deleted, the items move or get
  named as dropped. `WorkspacePanelActions.test.tsx` asserts the labels.

**The SIGNATURE is as public as the name**: a required second argument on
`setPendingMove` broke protein3d exactly as deleting it would. Plugin-facing
arguments may be **added optional and never made required**.
`pluginFacingSessionApi.test.ts` performs protein3d's call rather than asserting
the member exists.

## Closing a tab or a panel closes its views

The layout does not own views, so the two go together at the call site —
`session.removeView` first, then drop the tab or cell. Homing runs the other
direction only. `closeTab` is **one function with two callers** (the ⋮ menu and
middle-click); spelled twice, one of them drops the tab and leaves its views in
the session forever. `WorkspaceTab` and `TabStrip` take `PanelChrome.onTabClose`
rather than building one; neither knows what a view is.
