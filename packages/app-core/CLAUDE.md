# @jbrowse/app-core

The workspace is **one MST tree** (`src/WorkspaceLayout/`). There is no window
manager library, no imperative api, and nothing to reconcile: the layout is
session state, React renders it, and a gesture is an action.

This replaced dockview, and most of what used to be in this file described the
seam between the two. If you are reading an old comment or commit that talks
about `dockviewLayout`, `panelViewAssignments`, `useDockviewController`,
`withSuppressedPanelRemoval`, `layoutsEqual` or `init`, all of it is gone —
[ADR-068](../../agent-docs/architecture-decision-records/adr-068-workspace-layout-is-an-mst-tree.md)
is the decision, and the
[ADR-057](../../agent-docs/architecture-decision-records/adr-057-dockview-stays-external.md)
it supersedes is worth reading for why the seam existed for as long as it did.

## Four levels, and the middle two are the ones people get wrong

```
branch (a split)  >  panel (a grid cell)  >  tab  >  views (stacked vertically)
```

A **branch** divides its space among children in one direction. A **panel** is a
cell of the grid: it owns a tab strip and shows one tab at a time. A **tab**
holds a vertical stack of views. dockview modelled the first three as
branch/group/panel and had no fourth, which is why `panelViewAssignments` had to
exist beside its serialized grid — the vertical stack is our concept.

The first version of this tree collapsed tab and view into one level, which
silently deleted tabs as a feature. Both middle levels are real:

- a **panel with no tabs** is legal and is what a drag leaves behind before the
  gesture prunes it
- a **tab with no views** is legal and is what "new empty tab" creates — it
  shows the view launcher

So nothing prunes empties as a rule. `pruneEmptyPanel` and `pruneEmptyTabIn`
exist, and each is called only by the gesture that just emptied the thing —
which is every gesture that can empty one: a drag out of a cell, and closing a
cell's last tab.

**A panel with no tabs renders nothing at all** — not even the launcher an empty
_tab_ shows, since `PanelView` draws the active tab's content and there is no
active tab. That is only survivable because the state cannot be reached and
held: with views left in the session the prunes above collapse the cell, and
with none `ViewsContainer` renders `ViewLauncher` in place of the whole
workspace rather than mounting `WorkspaceContainer` at all. So the blank cell
needs no launcher of its own, and giving `renderTabContent` an `undefined`-tab
case to serve one would be answering a state nothing can show.

## Ids are random, not a counter

`nextId` uses `createElementId()` (nanoid). Panel and tab ids are
`types.identifier`, so they must be unique **within the tree** — and a
module-level counter restarts at zero on every page load while the restored
snapshot still holds `panel-1`, `tab-1`, .... The first tab a returning user
opened would mint an id the tree already had.

This shipped as a counter and the obvious test could not see it: within one run
the counter keeps advancing, so ids never collide and the test passes against
the broken code. `integrity.test.ts` restarts the module graph with
`jest.resetModules()` and re-imports, which is the only version of that test
worth having.

## Where the files sit, and why the split is there

```
tree.ts        every operation on the layout, pure, no MST and no React
spec.ts        the public `layout` URL vocabulary -> a tree
model.ts       the MST mixin: tree in a node, and a named action per gesture
panelChrome.ts what a panel needs from the APP, as one `PanelChrome` object
LayoutRenderer the grid: branches, panes, splitters
PanelView      one cell: the frame, the tabpanel, the drop indicator
TabStrip       the strip and everything with state in it (+ one tab)
useLayoutDrag  the DOM half of dragging a tab; geometry is dropZone.ts
splitter.ts    moving a boundary between two panes, and the pane minimum
```

**Reading dockview's source is the cheapest way to settle "did we get this right
or merely get it working"**, and worth doing when you touch the grid, the sash
or the dnd. It has already found one missing constraint (`MIN_PANE_PX`) and
confirmed the fiddliest arithmetic here (the same-strip move index) matches
character for character. Where we differ on purpose the comment says so and
names dockview's version — corner drop resolution and the tab that becomes
active on close are the two.

**Get it from npm, not from `node_modules`.** The dependency is gone from every
`package.json` and from the lockfile; what is left in the primary checkout's
`.pnpm/` is orphaned store content from an install predating the removal, and
the next `pnpm install` there deletes it. The comments below cite **8.0.0**,
which is the version that shipped, so `npm pack dockview-core@8.0.0` (or the tag
on GitHub) is the copy the citations were checked against.

`PanelChrome` is worth naming because it is the seam. `LayoutRenderer` and
everything under it knows nothing about views, assemblies or sessions — what a
tab is _called_ and what it _contains_ arrive as render props. They travel as
one object rather than five, because the recursion forwards them unchanged at
every hop and five copies of that list drift.

**And because one object can be memoised.** It is a prop of every panel, so
anything in it that changes per render defeats `observer`'s memo for all of them
at once — and a panel's render rebuilds its `ViewStack`. That is why
`useLayoutDrag` returns `handlers` as one memoised object and reads the
in-flight drag from a ref rather than closing over it: handlers that changed on
every pointer move re-rendered every view in the workspace while a tab was being
dragged. `WorkspaceContainer` memoises the chrome for the same reason, and
nothing does it for us — `observer(function(){})` is not compiled by the React
Compiler.

The `drag` prop is deliberately NOT in the chrome. It goes down its own prop so
it reaches the one cell it describes and the rest hold still.

## Every pure function is total, and the guard belongs in the function

An MST action guarding its arguments protects that one caller. The pure
functions in `tree.ts` are exported and callable directly, so each is total on
its own — passing an id that is not in the tree returns the tree unchanged.

`moveTabToPanel` is the one where this is not a nicety. It takes the tab out and
then puts it back, so a target panel that is missing and not rejected **before
the removal** leaves the tab, and every view in it, nowhere at all. Both layers
are tested, because the model guard hides the tree bug from the model tests.

The same shape one level up: `splitPanel` and `addTab` return `undefined` rather
than claiming an id that was never inserted, because `activePanelId` is what
homing falls back on and a dangling one puts views in a cell nobody draws.

## `session.views` is the order; a tab's `viewIds` is the grouping

Unchanged from the dockview era, and still the rule. `viewIds` is membership
only; the order views render in is `session.views`, in both layout modes. Two
arrays each claiming to be the order is what made "move this view up" need two
implementations picked by mode.

**`homeViews` is what keeps the two in step, and its list is the session's WHOLE
set of views.** It is two-directional about membership: a view no tab holds
lands in the active one, and a view the list does not name is dropped from
whatever tab holds it. So a caller passing only the view it cares about does not
"leave the rest alone" — it unhomes them, and the next homing pass sweeps them
all into one tab. `moveViewToNewTab`/`moveViewToSplitRight` default it to
nothing for that reason; the parameter is required.

## The pure tree is where the risk lives, and it is pure so that it can be

`tree.ts` is plain functions over plain snapshots — no MST nodes, no parents, no
lifecycle. Every operation is `tree in -> tree out`.

The work that replaced reconciliation is **normalisation**: after a split or a
removal the tree is usually not canonical, and every operation has to put it
back. Four rules, bottom-up — drop empty branches, replace a single-child branch
with its child, flatten a branch into a same-direction parent, renormalise sizes
to sum to 1. That is genuine work and it is where this design's bugs would live.

What it is not is _timing_. There is no event, no re-entrancy, no window during
which the tree is half-updated, and no second owner to disagree with. Which is
why it can be checked by a 2000-step randomised operation sequence asserting,
after every step: canonical form, no duplicated or stranded tab or view, no
panel naming a tab it does not have, and — the fifth, below — that normalising
again would change nothing.

**Normalisation has to have a FIXED POINT, and floating point is why that is not
free.** It runs on every action, so an operation that renormalises sizes which
are already right must return them untouched. Dividing by a sum of 1 and
multiplying by 1 is not the identity: seven equal panes go to
`0.14285714285714285`, summing to `0.9999999999999998`, which renormalises to
`0.14285714285714288`, summing to `1.0000000000000002`, which renormalises back
— forever, for 6, 7, 9, 10, 11, 13, 14, 15 and every count from 18 up. So every
action on a settled workspace rewrote every size and pushed a snapshot in which
nothing observable had changed, which is the dockview echo bug reached from the
other side. `scaleSizes` leaves siblings alone within `SIZE_EPSILON` for that
reason; the drift it admits cannot accumulate, because the sizes stop moving
inside it. `expectCanonical` cannot catch this on its own — it checks the sum to
six places, which both halves of an oscillation pass.

**Every operation is in that sequence, and keeping it that way is the point.**
`homeViews` — the one-directional reconcile with `session.views`, which runs on
every change to it — used to live in the model, closing over `activePanelId` and
the id minter, and so was outside the only test that drives operations against
each other. It takes both as arguments now and is in the mix. A new operation
that skips this test is a new operation with no test worth the name; adding it
to the sequence is two lines.

**Flattening a same-direction branch is the rule dockview could not express.**
It forces orientation to alternate by depth, so `row` inside `row` was not
representable and a nested split got silently reparented — which is why `size`
used to apply only to the top-level split, and only if every panel there carried
one. Here nesting is preserved and canonicalised, so `size` works at any depth.

## Sizes are `flex-grow`; there is no resize code

A branch's children divide its space in proportion to their `size`, whatever
that space becomes, so a window resize is the browser's problem. This is the
pixel maths a grid engine is most likely to get subtly wrong, and we do not do
any of it. The one place sizes are computed is `splitter.ts`, which moves the
boundary _within the combined space of the pair either side of it_ so every
other pane holds still — pure, and tested without a DOM, the same split as
`dropZone.ts`.

**`MIN_PANE_PX` is the one pixel in the design, and it is dockview's.** A share
of zero is a perfectly legal `flex-grow`, so without a floor a pane can be
dragged — or `Home`'d — to nothing, taking its tab strip and its views with it
and leaving a 4px sash flush against its neighbour to get it back. 100px is
`MINIMUM_DOCKVIEW_GROUP_PANEL_WIDTH`, so it is the constraint the workspace
shipped with before the grid was ours. Converting it into a share needs the
pair's pixel span, which is the only reason the handle measures anything.

## Drag-and-drop: geometry is pure, wiring is thin

Two pure functions over rects, both tested without a DOM or a synthetic pointer.
`dropZoneAt` answers which half of a cell — edge bands, the corner tie-break,
what counts as the middle. `stripDropAt` answers which GAP between tabs, by
midpoint, which is what makes it total: every x belongs to exactly one gap, so
there is no dead band where a drop degrades into appending.

**The strip is tested before the panel.** It sits inside the panel's own top
edge band, so `dropZoneAt` alone reads a drop between two tabs as "split this
cell upwards". A strip drop draws a caret at the gap rather than washing half
the cell, which would say the wrong thing.

**What the indicator says is what the drop does, and a drop that says nothing
does nothing.** The centre wash means "be a tab of this cell", so on the cell a
tab is already in it promises no change — and the gesture states no position,
because there is no gap under the pointer and no caret drawn. `dropTabInPanel`
therefore declines it, where it used to append and send the tab to the end of
its own strip. dockview declines the same drop. The rule belongs to the gesture
and not to `moveTabToPanel`, where no index still means append: that is the only
reading a total function has.

`useLayoutDrag` is the DOM half and is deliberately dumb. The React test stubs
geometry and therefore covers **wiring only**, and says so. A test that stubs
the thing it is checking proves nothing, and drag-and-drop is mostly geometry.

Pointer events, not HTML5 DnD — for pointer capture, so releasing outside the
window ends the drag instead of leaving it stuck on. Escape cancels, from a
`window` listener: capture routes pointer events to the tab and does nothing for
the keyboard. It clears `pendingRef` as well as the drag state, because the drag
is rebuilt from `pending` on every move and clearing only what is on screen lets
the next pixel of movement resume it.

**Choosing pointer events means owning the rules HTML5 dnd was giving us**, and
all three were missing. dockview states none of them either, because it doesn't
have to: its tab drags over HTML5 dnd, where the browser applies them, and its
`PointerDragSource` is touch/pen only unless `dndStrategy: 'pointer'`.

- **The primary button of the primary pointer, and nothing else.** A right-drag
  moved a tab; worse, a right-press left `pending` armed, because the native
  context menu eats the `pointerup` that would have cleared it — after which the
  next move of a button-less pointer dragged the tab, and the click dismissing
  the menu dropped it. `Tab` gates _activation_ on the same button separately
  (dockview's `_activateOnPointerDown` does too): showing a tab mounts a stack
  of views, which is not what a right-press is asking for.
- **One `pointerId` per gesture**, checked in every handler. A second finger
  elsewhere in the strip otherwise steered the first one's drag and its release
  ended it. dockview tracks the same id in `PointerDragSource`.
- **`pointercancel` ends the gesture.** A long-press on a touch device opens the
  platform's context menu and cancels the pointer, with no `pointerup` to
  follow. Same clearing as Escape, for the same reason.

**And the memoised handlers are only half the re-render story.** The cell being
dragged _over_ has an indicator to draw — but the indicator is a function of the
cell and the zone, or of the gap on a strip, and a pointer emits events far
faster than it crosses between any of those. `showDrag` therefore publishes
nothing when the new target would paint the same thing, because a cell's render
rebuilds its `ViewStack` and `renderTabContent` hands back a fresh `views` array
that nothing downstream can memoise away.

**The in-flight drag is React state, never MST.** It is transient UI; putting it
in the session would put every intermediate hover into the undo history.

**`index` counts the strip the user is looking at.** `moveTabToPanel` adjusts
for its own remove-then-insert, because within one panel the two orderings
differ exactly when the tab starts left of the gap it was dropped in — dragging
A to the gap between B and C in `[A, B, C]` is index 2 on screen and index 1
once A is out. Across panels there is no shift.

## Only the shown tab is mounted, and that is the constraint, not an oversight

`PanelView` renders the active tab's content and nothing else. Next to
dockview's always-mounted panels that reads as a gap to close, and closing it
would break the thing it looks like it would help: each display costs a WebGL2
context, the ceiling is 16, and `useViewVisibility` already tears views down
when they scroll off — see `agent-docs/reference/GPU_CONTEXT_BUDGET.md`.

It is also why the tab strip activates **manually** from the keyboard (arrows
move focus, Enter/Space shows). Automatic activation is the more common reading
of the WAI tabs pattern, and its documented exception is exactly this: arrowing
across five tabs would build and tear down five sets of views in passing.

## The strip hides its scrollbar, so it has to scroll some other way

`tabs` is `overflow-x: auto` with the scrollbar hidden — it is chrome, and a
scrollbar across it would be noise. That removes both the affordance saying
there is more and the means of getting there, and a mouse wheel has no
horizontal axis to fall back on. Measured at 1400px with 30 tabs: 11 of them
entirely outside the strip, `scrollLeft` immovable.

So the wheel is translated to horizontal scroll, and a tab that becomes current
_without being touched_ scrolls itself into view — `+` on a full strip appends a
tab, makes it active, and otherwise leaves the user looking somewhere else.
Clicking never needs that (you clicked something visible) and arrowing gets it
free from `focus()`, which is why the keyboard could always reach an overflowing
strip when the mouse could not.

A trackpad's own horizontal swipe arrives as `deltaX` and the browser has
already applied it, so the handler takes the larger axis and leaves that gesture
alone rather than scrolling twice as far as the fingers moved.

## Keyboard: the strip is one tab stop, the splitter is operable

A roving tabindex, so a panel with eight tabs is one stop rather than eight
between the user and the view. `role="tablist"` wraps the tabs **alone** — a
tablist's children have to be tabs, and the panel's own +/× buttons are not. The
splitter is focusable and takes the arrows, Home and End, moving 2% of the pair
per press: the same "within the pair either side of it" rule the drag follows.
Both roles were being claimed before any of this existed, which is worse than
plain divs — an affordance announced and then not there.

**A control rendered INSIDE a tab has to stop its keys, the way it already stops
its pointer.** The strip's handler is a roving tabindex over tabs and it
`preventDefault()`s everything it takes — the arrows, Home, End, Enter and Space
— all of which reach it by bubbling out of whatever the tab label renders. The
rename box did not stop them, so arrows jumped tabs instead of moving the caret
and a space never reached the input: a tab could not be named "Comparison view".
It stops the whole event rather than the keys it happens to use, because none of
that handler is meant for a control inside a tab. Isolated component tests
cannot see this; it only exists in a real strip.

## Undo is `applySnapshot`, and nothing has to be told

There is one owner, so there is no echo. A settled layout emits no further
snapshots at all — pinned by a test, because the old design's worst bug was the
opposite: dockview's layout event fired on a microtask after every layout we
installed ourselves, `types.frozen` set to a deep-equal-but-new object still
fires `onSnapshot`, and so an undo pushed its own re-serialisation into the undo
history 300ms later and truncated the redo stack.

## `applyLayoutSpec` is a plain action, not a standing request

A session spec's `layout` (a documented URL parameter, so `spec.ts` keeps its
`horizontal`/`vertical`/`tabs` vocabulary and percentage sizes) is converted and
_becomes_ the layout, immediately.

**A `tabs` node is where the vocabulary outruns the tree, and there are exactly
two places.** It shares one cell rather than dividing space, so a `size` on a
child describes nothing; and a tab holds a flat stack of views, so a container
child has no split to become and its views are gathered into one tab. Both are
honoured as closely as they can be and **reported** by `loadSessionSpec` — the
second used to drop those views from the layout in silence, after which homing
swept them into whichever tab was showing, so the spec's arrangement simply was
not the one that came up. Nothing else in the vocabulary is approximated: `size`
and nesting mean what they say at any depth.

**A spec states an arrangement, not a selection.** `treeFromSpec` shows each
cell's first tab, so any action that builds a layout from a spec _and_ has a
view it means to reveal has to say which one afterwards. `setPendingMove` is the
one that does — `newTab` puts the moved view in a tab beside the others, which
without that is the one tab nobody can see.

There is no `init` property. `init` existed because dockview had to be told,
could not be told before it mounted, and had to be told again afterwards. All
three problems came from the layout living somewhere an action could not reach.

`ViewMenu`'s "move to new tab" / "move to split view" lost its fork for the same
reason: it used to call the live dockview api when a workspace was up and write
an `init` when it was not.

## Two members are looked up at runtime and will not fail to compile

- **`setPendingMove`** — jbrowse-plugin-protein3d calls it behind a
  `'setPendingMove' in session` guard. It has survived two storage changes as
  sugar and must keep doing so. Deleting it does not break a build or throw; the
  plugin just silently stops asking for a split, and the only thing that noticed
  last time was a website figure eight commits later.
- **`applyLayoutSpec`** — `loadSessionSpec` duck-types it behind an `in` guard
  for the same reason (an embedded product has no workspace). Rename the action
  without renaming it there and every spec layout is silently declined.

A capability-detecting caller cannot tell you it lost a capability.

**A menu item is the third such surface, and the quietest.** Deleting one
compiles, passes every model test, and changes no behaviour that anything
asserts — the capability is simply no longer offered. The four "Global:" tilings
went with `DockviewRightHeaderActions` in ADR-068 and nobody noticed for 225
commits; the commit message even lists four things that were dropped
deliberately, and these were not among them. So a component that holds menu
items is not interchangeable with the items it holds: when one is deleted, the
items move or get named as dropped. `WorkspacePanelActions.test.tsx` asserts the
labels for this reason, and a diff of `label: '...'` strings against an older
revision is how you check the rest.

## Closing a tab or a panel closes its views

The layout does not own views, so the two go together explicitly at the call
site: `WorkspaceContainer`'s `closeTab` and `WorkspacePanelActions`' close both
`session.removeView` the views first, then drop the tab or the cell. Homing runs
in the other direction only — `homeUnassignedViews` puts a newly launched view
somewhere and drops members the session no longer has, and nothing reads back.

Closing a cell's LAST tab closes the cell too, which is `pruneEmptyPanel` doing
the job it was written for by way of a second gesture — see the empty-states
section above for why a cell left standing there had no way out of itself.

`closeTab` is **one function with two callers** — the tab's own ⋮ menu and
middle-clicking the tab — rather than the pair spelled out at each. Spelled
twice, one of them ends up dropping the tab and leaving its views in the session
forever, which nothing reports. `WorkspaceTab` and `TabStrip` therefore take a
close callback (`PanelChrome.onTabClose`) rather than building one; neither
knows what a view is.

## `@jbrowse/react-app2/styles.css` is intentionally empty

It used to be a single `@import` of dockview's stylesheet. Owning that entry
point is what let the dependency be dropped without breaking a single embedder's
import, which is exactly what ADR-057 said it was for — the one part of that
ADR's reasoning that paid off precisely as written. Keep it exported even while
empty; deleting it is a breaking change for every consumer.

## Products key `<App>` on `session.id`

jbrowse-web, -desktop and -react-app all do, so a session swap remounts the
container and `session` is effectively constant for a mounted one. Undo
(`applySnapshot` on the same node) keeps the id and does not remount — which no
longer matters the way it used to, since there is nothing to re-install.
