# WorkspaceLayout

One MST tree, no window manager; a gesture is an action (ADR-068).
`branch > panel > tab > views`.

## Tree

- **Every pure function in `tree.ts` is total** — unknown id, tree unchanged.
  Test tree and model separately; the model guard hides tree bugs.
- **Every operation goes in `integrity.test.ts`'s 2000-step sequence.** Take
  `activePanelId` and the id minter as arguments, don't close over them.
- **Normalisation must have a fixed point** (`SIZE_EPSILON`).
- **Panels and tabs may be empty**; the gesture that empties one prunes it.
- **`homeViews` takes the session's whole view list** — `session.views` is the
  order, `viewIds` the grouping, and a partial list unhomes the rest. The mixin
  homes views in an `afterAttach` autorun, so headless callers stay consistent.

## Gestures

- **The in-flight drag is React state, never MST** — every hover would enter
  undo. `drag` stays out of `PanelChrome` for the same memoisation reason.
- **Every pointer gesture goes through `usePointerGesture`**; its pointer
  capture is also what stops a drag selecting text.
- A drop whose indicator paints nothing does nothing (`dropTabInPanel`, not
  `moveTabToPanel`).

## Maximize

- **`maximizedPanelId` lives on the mixin, never on `PanelNode`**, so `tree.ts`
  stays ignorant of it.
- **The repair is in `apply`, not per gesture**: losing or gaining a cell leaves
  the mode. A maximized cell is the active one.
- The strip shows off the whole tree, never `visibleTree`.

## Rendering

- **Only the shown tab is mounted** — each display costs a WebGL2 context
  (ceiling 16). A tab switch mounts a fresh `ViewStack` rather than inheriting
  the last tab's state.
- The strip handles only keys aimed at the tab itself
  (`target === currentTarget`).

## Surfaces no compiler checks

`setPendingMove`, `applyLayoutSpec`, `layoutViews` and the panel menu items are
duck-typed or label-matched by protein3d, `loadSessionSpec` and the agent docs;
deleting one compiles. Add arguments optional, never required.
`WorkspacePanelActions.test.tsx` and `pluginFacingSessionApi.test.ts` pin them.

## Closing

Closing a tab or panel removes its views through `WorkspaceContainer`'s one
`closeViews`; the strip components take a callback and know nothing of views.
