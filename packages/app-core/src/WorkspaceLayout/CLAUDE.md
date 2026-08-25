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
  the thing. A tabless panel renders nothing at all — not the launcher an empty
  TAB shows — and needs no case, for two reasons worth knowing before adding
  one: with views left, the prunes collapse the cell, and with none
  `ViewsContainer` renders `ViewLauncher` in place of the whole workspace rather
  than mounting it. `homeViews` mints a tab in a tabless panel on top of that,
  so the state self-heals if it is ever built.
- Ids come from `createElementId()` (nanoid) and are `types.identifier`s, unique
  within the tree _including a restored snapshot_. `integrity.test.ts` catches a
  counter; the obvious test doesn't.
- **Every pure function in `tree.ts` is total** — unknown id, tree unchanged.
  Test tree and model separately; the model guard hides tree bugs. `splitPanel`
  / `addTab` return `undefined` rather than claim an id that was never inserted,
  since `activePanelId` is homing's fallback.
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
  nothing.** `dropTabInPanel` declines on the cell a tab is already in and
  `useLayoutDrag` paints no wash. That belongs to the gesture, not
  `moveTabToPanel`, where no index means append.
- Pointer events, so own the three rules the browser was applying: **primary
  button of the primary pointer**, **one `pointerId` per gesture**,
  **`pointercancel` ends it**. Both gestures — the tab drag and the splitter —
  and any third one.
- **Capture is also what stops a drag selecting the text it crosses**, so
  neither gesture needs `user-select: none` or a cancelled `pointerdown`.
  Measured against the real `Splitter` in Chrome: take `setPointerCapture` out
  and one sash drag selects both cells' content, as well as no longer resizing.
  A synthetic repro of this answers the opposite — drive the component.
- **The in-flight drag is React state, never MST** — every hover would enter
  undo. Escape cancels from a `window` listener and must clear `pendingRef` too,
  since the drag is rebuilt from `pending` on every move.
- **`showDrag` publishes nothing when the new target would paint the same
  indicator** — same reason `drag` is kept out of the chrome.
- **`index` counts the strip the user sees**; `moveTabToPanel` adjusts for its
  own remove-then-insert.

## Maximize

- **`maximizedPanelId` is on the MIXIN, beside `activePanelId`** — never a flag
  on `PanelNode`. On the node it would be inside `tree.ts`, where every
  operation would have to say what it does to it and the 2000-step sequence
  would need a new invariant to catch any of that going wrong.
- `visibleTree` is what the renderer gets, so `LayoutRenderer` and below know
  nothing about the mode. **It re-sizes the cell to 1**: CSS hands out free
  space by grow factor only up to a total of 1, so a cell that was a third of a
  row would draw a third of the window.
- **The repair is in `apply`, not at the gestures.** Losing the cell leaves the
  mode (`livePanelIds`, which also takes `activePanelId` — they fall back
  DIFFERENTLY); gaining one leaves it too, since a cell appearing where it
  cannot be seen is the one thing maximize must not do. Both drop gestures
  prune, and `applyLayoutSpec` replaces every id, so per-gesture would be five
  call sites for one rule.
- The gesture is the strip background's `onDoubleClick`, kept off the tab's own
  rename double-click by `target === currentTarget`. The cell menu's item is how
  it is discovered and the only way to it from the keyboard.

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
- **A spec states an arrangement, not a selection** — `treeFromSpec` shows each
  cell's first tab, so say which view to reveal afterwards (`setPendingMove`).

## Three surfaces that will not fail to compile

`setPendingMove` and `applyLayoutSpec` are duck-typed behind `in` guards
(protein3d, `loadSessionSpec`), and **a menu item** deleted compiles and passes
every model test. `WorkspacePanelActions.test.tsx` asserts labels;
`pluginFacingSessionApi.test.ts` performs protein3d's call. **The signature is
as public as the name** — add arguments optional, never required.

## Closing a tab or panel closes its views

`session.removeView`, then drop the tab or cell. **`WorkspaceContainer` states
the removal once** (`closeViews`) and both `closeTab` and `closePanel` build on
it; spelled per gesture, one of the three leaks its views. `WorkspaceTab`,
`TabStrip` and `WorkspacePanelActions` take a callback rather than building the
pair — none of them knows what a view is, and that is the property the tests
pin.
