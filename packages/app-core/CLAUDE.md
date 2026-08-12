# @jbrowse/app-core

The workspace is **one MST tree** (`src/WorkspaceLayout/`). There is no window
manager library, no imperative api, and nothing to reconcile: the layout is
session state, React renders it, and a gesture is an action.

This replaced dockview, and most of what used to be in this file described the
seam between the two. If you are reading an old comment or commit that talks
about `dockviewLayout`, `panelViewAssignments`, `useDockviewController`,
`withSuppressedPanelRemoval`, `layoutsEqual` or `init`, all of it is gone —
[ADR-057](../../agent-docs/architecture-decision-records/adr-057-dockview-stays-external.md)
records why it existed and what the measurement was that ended it.

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
exist, and each is called only by the gesture that just emptied the thing.

## `session.views` is the order; a tab's `viewIds` is the grouping

Unchanged from the dockview era, and still the rule. `viewIds` is membership
only; the order views render in is `session.views`, in both layout modes. Two
arrays each claiming to be the order is what made "move this view up" need two
implementations picked by mode.

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
why it can be checked by a 2000-step randomised operation sequence asserting
canonical form, and no duplicated or stranded tab or view, after every step.

**Flattening a same-direction branch is the rule dockview could not express.**
It forces orientation to alternate by depth, so `row` inside `row` was not
representable and a nested split got silently reparented — which is why `size`
used to apply only to the top-level split, and only if every panel there carried
one. Here nesting is preserved and canonicalised, so `size` works at any depth.

## Sizes are `flex-grow`; there is no resize code

A branch's children divide its space in proportion to their `size`, whatever
that space becomes, so a window resize is the browser's problem. This is the
pixel maths a grid engine is most likely to get subtly wrong, and we do not do
any of it. The one place sizes are computed is the splitter drag, which moves
the boundary _within the combined space of the pair either side of it_ so every
other pane holds still.

## Drag-and-drop: geometry is pure, wiring is thin

`dropZoneAt` is a pure function over a rect: edge bands, the corner tie-break,
what counts as the middle. It is tested without a DOM or a synthetic pointer.
`useLayoutDrag` is the DOM half and is deliberately dumb.

The React test stubs geometry and therefore covers **wiring only**, and says so.
A test that stubs the thing it is checking proves nothing, and drag-and-drop is
mostly geometry.

Pointer events, not HTML5 DnD — for pointer capture, so releasing outside the
window ends the drag instead of leaving it stuck on.

**The in-flight drag is React state, never MST.** It is transient UI; putting it
in the session would put every intermediate hover into the undo history.

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

## Closing a tab or a panel closes its views

The layout does not own views, so the two go together explicitly at the call
site: `WorkspaceTab`'s close and `WorkspacePanelActions`' close both
`session.removeView` the views first, then drop the tab or the cell. Homing runs
in the other direction only — `homeUnassignedViews` puts a newly launched view
somewhere and drops members the session no longer has, and nothing reads back.

## `@jbrowse/react-app2/styles.css` is intentionally empty

It used to be a single `@import` of dockview's stylesheet. Owning that entry
point is what let the dependency be dropped without breaking a single embedder's
import, which is exactly what it was for. Keep it exported even while empty —
deleting it is a breaking change for every consumer.

## Products key `<App>` on `session.id`

jbrowse-web, -desktop and -react-app all do, so a session swap remounts the
container and `session` is effectively constant for a mounted one. Undo
(`applySnapshot` on the same node) keeps the id and does not remount — which no
longer matters the way it used to, since there is nothing to re-install.
