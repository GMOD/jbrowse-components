# WorkspaceLayout

One MST tree — no window manager, no imperative api. Layout is session state,
React renders it, a gesture is an action.
[ADR-068](../../../../agent-docs/architecture-decision-records/adr-068-workspace-layout-is-an-mst-tree.md)
is the decision; read it before trusting an old comment naming dockview.

```
branch (a split)  >  panel (a grid cell)  >  tab  >  views (stacked vertically)
```

## Tree

- **Both middle levels are legal empty.** Nothing prunes as a rule;
  `pruneEmptyPanel` / `pruneEmptyTabIn` are called by the gesture that emptied
  the thing. A tabless panel renders nothing at all.
- Ids are nanoid `types.identifier`s, unique within the tree _including a
  restored snapshot_. `integrity.test.ts` catches a counter; the obvious test
  doesn't.
- **Every pure function in `tree.ts` is total** — unknown id, tree unchanged.
  Test tree and model separately; the model guard hides tree bugs.
- **Normalisation must have a fixed point** — `scaleSizes` leaves siblings alone
  within `SIZE_EPSILON`. `expectCanonical` passes both halves of an oscillation.
- **Every operation goes in `integrity.test.ts`'s 2000-step sequence.** Take
  `activePanelId` and the id minter as arguments, don't close over them.
- **`homeViews` takes the session's WHOLE view list** (`session.views` is the
  order, `viewIds` the grouping) and is two-directional, so a partial list
  unhomes the rest.

## `PanelChrome` is the seam

`LayoutRenderer` and below know nothing about views or sessions. The chrome is
**one memoisable object** on every panel, so anything changing per render
rebuilds every `ViewStack`. `drag` is deliberately not in it.

## Sizes, drag-and-drop

- `flex-grow`, no resize code. `splitter.ts` moves a boundary within its pair's
  combined space. **`MIN_PANE_PX` (100) is the one pixel in the design** — zero
  is a legal share.
- `dropZoneAt` / `stripDropAt` are pure over rects; midpoint answers make them
  total. **Test the strip before the panel.**
- **What the indicator says is what the drop does; a drop that says nothing does
  nothing.** That rule belongs to the gesture, not `moveTabToPanel`, where no
  index means append.
- Pointer events, so own the three rules the browser was applying: **primary
  button of the primary pointer**, **one `pointerId` per gesture**,
  **`pointercancel` ends it**.
- **The in-flight drag is React state, never MST** — every hover would enter
  undo.
- **`index` counts the strip the user sees**; `moveTabToPanel` adjusts for its
  own remove-then-insert.

## Rendering, keyboard

- **Only the shown tab is mounted** — a display costs a WebGL2 context, ceiling
  16 (`agent-docs/reference/GPU_CONTEXT_BUDGET.md`). Hence manual keyboard
  activation, the documented exception to the WAI tabs pattern.
- Strip hides its scrollbar: wheel is translated (larger axis), and a tab made
  current _without being touched_ scrolls itself in.
- Roving tabindex. `role="tablist"` wraps the tabs alone.
- **A control inside a tab must stop its keys — the whole event.** The strip
  `preventDefault()`s arrows/Home/End/Enter/Space. Component tests can't see it.

## Snapshots, specs

- Undo is `applySnapshot`; a settled layout emits no further snapshots (tested).
- `applyLayoutSpec` is a plain action, no `init` property.
- **A `tabs` node outruns the tree in exactly two places** — a `size` on its
  child, and a container child with no split. Both are reported by
  `loadSessionSpec`; nothing else is approximated.
- **A spec states an arrangement, not a selection** — say which view to reveal
  (`setPendingMove`).

## Three surfaces that will not fail to compile

`setPendingMove` and `applyLayoutSpec` are duck-typed behind `in` guards
(protein3d, `loadSessionSpec`), and **a menu item** deleted compiles and passes
every model test. `WorkspacePanelActions.test.tsx` asserts labels;
`pluginFacingSessionApi.test.ts` performs protein3d's call. **The signature is
as public as the name** — add arguments optional, never required.

## Closing a tab or panel closes its views

`session.removeView`, then drop the tab or cell. `closeTab` is one function with
two callers; spelled twice, one leaks its views.
