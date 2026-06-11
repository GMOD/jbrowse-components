---
id: dockviewlayoutmixin
title: DockviewLayoutMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/DockviewLayout/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DockviewLayoutMixin.md)

## Overview

Session mixin that persists dockview layout state. Each dockview panel can
contain multiple views stacked vertically.

### DockviewLayoutMixin - Properties

#### property: dockviewLayout

Serialized dockview layout state

```js
// type signature
IOptionalIType<IMaybe<IType<SerializedDockview, SerializedDockview, SerializedDockview>>, [undefined]>
// code
dockviewLayout: types.stripDefault(
        types.maybe(types.frozen<SerializedDockview>()),
        undefined,
      )
```

#### property: panelViewAssignments

Maps panel IDs to arrays of view IDs (for stacking views within a panel)

```js
// type signature
IOptionalIType<IMapType<IArrayType<ISimpleType<string>>>, [undefined]>
// code
panelViewAssignments: types.stripDefault(
        types.map(types.array(types.string)),
        {},
      )
```

#### property: init

Initial layout configuration from URL params. Processed once then cleared.

```js
// type signature
IType<DockviewLayoutNode | undefined, DockviewLayoutNode | undefined, DockviewLayoutNode | undefined>
// code
init: types.frozen<DockviewLayoutNode | undefined>()
```

#### property: pendingMove

A view move queued before workspaces were enabled. Consumed once when the
dockview container mounts, then cleared.

```js
// type signature
IType<PendingMove | undefined, PendingMove | undefined, PendingMove | undefined>
// code
pendingMove: types.frozen<PendingMove | undefined>()
```

#### property: activePanelId

The currently active panel ID in dockview

```js
// type signature
IOptionalIType<IMaybe<ISimpleType<string>>, [undefined]>
// code
activePanelId: types.stripDefault(types.maybe(types.string), undefined)
```

### DockviewLayoutMixin - Getters

#### getter: getViewIdsForPanel

Get view IDs for a specific panel

```js
// type
(panelId: string) => never[] | (IMSTArray<ISimpleType<string>> & IStateTreeNode<IArrayType<ISimpleType<string>>>)
```

#### getter: getPanelContainingView

Find the panel containing a view, returning the panel ID, that panel's view-ID
list, and the view's index within it (or undefined if unassigned)

```js
// type
(viewId: string) => { panelId: string; viewIds: IMSTArray<ISimpleType<string>> & IStateTreeNode<IArrayType<ISimpleType<string>>>; idx: number; } | undefined
```

### DockviewLayoutMixin - Actions

#### action: setDockviewLayout

Save the current dockview layout

```js
// type signature
setDockviewLayout: (layout: SerializedDockview | undefined) => void
```

#### action: setActivePanelId

Set the active panel ID

```js
// type signature
setActivePanelId: (panelId: string | undefined) => void
```

#### action: setInit

Set the initial layout configuration (from URL params)

```js
// type signature
setInit: (init: DockviewLayoutNode | undefined) => void
```

#### action: setPendingMove

Queue a view move to be applied when the dockview container mounts

```js
// type signature
setPendingMove: (pendingMove: PendingMove | undefined) => void
```

#### action: assignViewToPanel

Assign a view to a panel (adds to the panel's view stack)

```js
// type signature
assignViewToPanel: (panelId: string, viewId: string) => void
```

#### action: removeViewFromPanel

Remove a view from its panel

```js
// type signature
removeViewFromPanel: (viewId: string) => void
```

#### action: removePanel

Remove a panel and all its view assignments

```js
// type signature
removePanel: (panelId: string) => void
```

#### action: moveViewUpInPanel

Move a view up within its panel's view stack

```js
// type signature
moveViewUpInPanel: (viewId: string) => void
```

#### action: moveViewDownInPanel

Move a view down within its panel's view stack

```js
// type signature
moveViewDownInPanel: (viewId: string) => void
```

#### action: moveViewToTopInPanel

Move a view to the top of its panel's view stack

```js
// type signature
moveViewToTopInPanel: (viewId: string) => void
```

#### action: moveViewToBottomInPanel

Move a view to the bottom of its panel's view stack

```js
// type signature
moveViewToBottomInPanel: (viewId: string) => void
```
