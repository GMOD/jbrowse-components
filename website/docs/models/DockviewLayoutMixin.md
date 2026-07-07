---
id: dockviewlayoutmixin
title: DockviewLayoutMixin
sidebar_label: Mixin -> DockviewLayoutMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/DockviewLayout/index.ts).

## Overview

Session mixin that persists dockview layout state. Each dockview panel can
contain multiple views stacked vertically.

## Members

| Member                                                     | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [dockviewLayout](#property-dockviewlayout)                 | Properties | Serialized dockview layout state                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [panelViewAssignments](#property-panelviewassignments)     | Properties | Maps panel IDs to arrays of view IDs (for stacking views within a panel)                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [activePanelId](#property-activepanelid)                   | Properties | The currently active panel ID in dockview                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [init](#property-init)                                     | Properties | The initial nested layout to build dockview from (simple viewIds/ direction/size form, vs. the verbose `dockviewLayout` dockview emits). Set from URL params (spec layout) OR carried in a loaded session snapshot (e.g. the `encoded-` session param), then consumed once when the dockview container mounts — `createInitialPanels` reads it, `applyInitLayout` builds the panels, and it is cleared to undefined (stripped from snapshots) so it never re-applies on a later remount. |
| [pendingMove](#volatile-pendingmove)                       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [getViewIdsForPanel](#getter-getviewidsforpanel)           | Getters    | Get view IDs for a specific panel                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [getPanelContainingView](#getter-getpanelcontainingview)   | Getters    | Find the panel containing a view, returning the panel ID, that panel's view-ID list, and the view's index within it (or undefined if unassigned)                                                                                                                                                                                                                                                                                                                                         |
| [setDockviewLayout](#action-setdockviewlayout)             | Actions    | Save the current dockview layout                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setActivePanelId](#action-setactivepanelid)               | Actions    | Set the active panel ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setInit](#action-setinit)                                 | Actions    | Set the initial layout configuration (from URL params)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [setPendingMove](#action-setpendingmove)                   | Actions    | Queue a view move to be applied when the dockview container mounts                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [assignViewToPanel](#action-assignviewtopanel)             | Actions    | Assign a view to a panel (adds to the panel's view stack)                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [removeViewFromPanel](#action-removeviewfrompanel)         | Actions    | Remove a view from its panel                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [removePanel](#action-removepanel)                         | Actions    | Remove a panel and all its view assignments                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [moveViewUpInPanel](#action-moveviewupinpanel)             | Actions    | Move a view up within its panel's view stack                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [moveViewDownInPanel](#action-moveviewdowninpanel)         | Actions    | Move a view down within its panel's view stack                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [moveViewToTopInPanel](#action-moveviewtotopinpanel)       | Actions    | Move a view to the top of its panel's view stack                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveViewToBottomInPanel](#action-moveviewtobottominpanel) | Actions    | Move a view to the bottom of its panel's view stack                                                                                                                                                                                                                                                                                                                                                                                                                                      |

<details>
<summary>DockviewLayoutMixin - Properties</summary>

#### property: dockviewLayout

Serialized dockview layout state

```ts
// type signature
type dockviewLayout = IOptionalIType<
  IMaybe<IType<SerializedDockview, SerializedDockview, SerializedDockview>>,
  [undefined]
>
// code
dockviewLayout: types.stripDefault(
  types.maybe(types.frozen<SerializedDockview>()),
  undefined,
)
```

#### property: panelViewAssignments

Maps panel IDs to arrays of view IDs (for stacking views within a panel)

```ts
// type signature
type panelViewAssignments = IOptionalIType<
  IMapType<IArrayType<ISimpleType<string>>>,
  [undefined]
>
// code
panelViewAssignments: types.stripDefault(
  types.map(types.array(types.string)),
  {},
)
```

#### property: activePanelId

The currently active panel ID in dockview

```ts
// type signature
type activePanelId = IOptionalIType<IMaybe<ISimpleType<string>>, [undefined]>
// code
activePanelId: types.stripDefault(types.maybe(types.string), undefined)
```

#### property: init

The initial nested layout to build dockview from (simple viewIds/ direction/size
form, vs. the verbose `dockviewLayout` dockview emits). Set from URL params
(spec layout) OR carried in a loaded session snapshot (e.g. the `encoded-`
session param), then consumed once when the dockview container mounts —
`createInitialPanels` reads it, `applyInitLayout` builds the panels, and it is
cleared to undefined (stripped from snapshots) so it never re-applies on a later
remount.

```ts
// type signature
type init = IOptionalIType<
  IMaybe<IType<DockviewLayoutNode, DockviewLayoutNode, DockviewLayoutNode>>,
  [undefined]
>
// code
init: types.stripDefault(
  types.maybe(types.frozen<DockviewLayoutNode>()),
  undefined,
)
```

</details>

<details>
<summary>DockviewLayoutMixin - Volatiles</summary>

#### volatile: pendingMove

```ts
// type signature
type pendingMove = undefined
// code
pendingMove: undefined
```

</details>

<details>
<summary>DockviewLayoutMixin - Getters</summary>

#### getter: getViewIdsForPanel

Get view IDs for a specific panel

```ts
type getViewIdsForPanel = (
  panelId: string,
) =>
  | never[]
  | (IMSTArray<ISimpleType<string>> &
      IStateTreeNode<IArrayType<ISimpleType<string>>>)
```

#### getter: getPanelContainingView

Find the panel containing a view, returning the panel ID, that panel's view-ID
list, and the view's index within it (or undefined if unassigned)

```ts
type getPanelContainingView = (viewId: string) =>
  | {
      panelId: string
      viewIds: IMSTArray<ISimpleType<string>> &
        IStateTreeNode<IArrayType<ISimpleType<string>>>
      idx: number
    }
  | undefined
```

</details>

<details>
<summary>DockviewLayoutMixin - Actions</summary>

#### action: setDockviewLayout

Save the current dockview layout

```ts
type setDockviewLayout = (layout: SerializedDockview | undefined) => void
```

#### action: setActivePanelId

Set the active panel ID

```ts
type setActivePanelId = (panelId: string | undefined) => void
```

#### action: setInit

Set the initial layout configuration (from URL params)

```ts
type setInit = (init: DockviewLayoutNode | undefined) => void
```

#### action: setPendingMove

Queue a view move to be applied when the dockview container mounts

```ts
type setPendingMove = (pendingMove: PendingMove | undefined) => void
```

#### action: assignViewToPanel

Assign a view to a panel (adds to the panel's view stack)

```ts
type assignViewToPanel = (panelId: string, viewId: string) => void
```

#### action: removeViewFromPanel

Remove a view from its panel

```ts
type removeViewFromPanel = (viewId: string) => void
```

#### action: removePanel

Remove a panel and all its view assignments

```ts
type removePanel = (panelId: string) => void
```

#### action: moveViewUpInPanel

Move a view up within its panel's view stack

```ts
type moveViewUpInPanel = (viewId: string) => void
```

#### action: moveViewDownInPanel

Move a view down within its panel's view stack

```ts
type moveViewDownInPanel = (viewId: string) => void
```

#### action: moveViewToTopInPanel

Move a view to the top of its panel's view stack

```ts
type moveViewToTopInPanel = (viewId: string) => void
```

#### action: moveViewToBottomInPanel

Move a view to the bottom of its panel's view stack

```ts
type moveViewToBottomInPanel = (viewId: string) => void
```

</details>
