---
id: drawerwidgetsessionmixin
title: DrawerWidgetSessionMixin
sidebar_label: Mixin -> DrawerWidgetSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/DrawerWidgets.ts).

## Overview

## Members

| Member                                               | Kind       | Defined by               | Description                                                                                                                                                                                      |
| ---------------------------------------------------- | ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [drawerPosition](#property-drawerposition)           | Properties | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [drawerWidth](#property-drawerwidth)                 | Properties | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [widgets](#property-widgets)                         | Properties | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [activeWidgets](#property-activewidgets)             | Properties | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [minimized](#property-minimized)                     | Properties | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [poppedOut](#volatile-poppedout)                     | Volatiles  | DrawerWidgetSessionMixin | true while the visible widget is shown in a modal dialog instead of the drawer. Volatile because a restored session that opened straight into a modal, with no drawer behind it, is disorienting |
| [visibleWidget](#getter-visiblewidget)               | Getters    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [setDrawerPosition](#action-setdrawerposition)       | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [updateDrawerWidth](#action-updatedrawerwidth)       | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [resizeDrawer](#action-resizedrawer)                 | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [addWidget](#action-addwidget)                       | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [showWidget](#action-showwidget)                     | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [hideWidget](#action-hidewidget)                     | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [minimizeWidgetDrawer](#action-minimizewidgetdrawer) | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [showWidgetDrawer](#action-showwidgetdrawer)         | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [popoutWidget](#action-popoutwidget)                 | Actions    | DrawerWidgetSessionMixin | show the visible widget in a modal dialog, freeing the drawer column                                                                                                                             |
| [returnWidgetToDrawer](#action-returnwidgettodrawer) | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [hideAllWidgets](#action-hideallwidgets)             | Actions    | DrawerWidgetSessionMixin |                                                                                                                                                                                                  |
| [editConfiguration](#action-editconfiguration)       | Actions    | DrawerWidgetSessionMixin | opens a configuration editor to configure the given thing, and sets the current task to be configuring it                                                                                        |

<details>
<summary>DrawerWidgetSessionMixin - Properties</summary>

#### property: drawerPosition

```ts
// type signature
type drawerPosition = IOptionalIType<ISimpleType<string>, [undefined]>
// code
drawerPosition: types.optional(
  types.string,
  () => localStorageGetItem('drawerPosition') ?? 'right',
)
```

#### property: drawerWidth

```ts
// type signature
type drawerWidth = IOptionalIType<ISimpleType<number>, [undefined]>
// code
drawerWidth: types.stripDefault(
  types.refinement(types.integer, width => width >= minDrawerWidth),
  384,
)
```

#### property: widgets

```ts
// type signature
type widgets = IOptionalIType<IMapType<IAnyType>, [undefined]>
// code
widgets: types.stripDefault(types.map(widgetStateModelType), {})
```

#### property: activeWidgets

```ts
// type signature
type activeWidgets = IOptionalIType<
  IMapType<IMaybe<IReferenceType<IAnyType>>>,
  [undefined]
>
// code
activeWidgets: types.stripDefault(
  types.map(types.safeReference(widgetStateModelType)),
  {},
)
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

</details>

<details>
<summary>DrawerWidgetSessionMixin - Volatiles</summary>

#### volatile: poppedOut

true while the visible widget is shown in a modal dialog instead of the drawer.
Volatile because a restored session that opened straight into a modal, with no
drawer behind it, is disorienting

```ts
// type signature
type poppedOut = false
// code
poppedOut: false
```

</details>

<details>
<summary>DrawerWidgetSessionMixin - Getters</summary>

#### getter: visibleWidget

```ts
type visibleWidget = any
```

</details>

<details>
<summary>DrawerWidgetSessionMixin - Actions</summary>

#### action: popoutWidget

show the visible widget in a modal dialog, freeing the drawer column

```ts
type popoutWidget = () => void
```

#### action: editConfiguration

opens a configuration editor to configure the given thing, and sets the current
task to be configuring it

```ts
type editConfiguration = (configuration: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | { ...; }, opts?: { ...; } | undefined) => void
```

</details>

<details>
<summary>DrawerWidgetSessionMixin - Actions (other undocumented members)</summary>

#### action: setDrawerPosition

```ts
type setDrawerPosition = (arg: string) => void
```

#### action: updateDrawerWidth

```ts
type updateDrawerWidth = (drawerWidth: number) => number
```

#### action: resizeDrawer

```ts
type resizeDrawer = (distance: number) => number
```

#### action: addWidget

```ts
type addWidget = (
  typeName: string,
  id: string,
  initialState?: any,
  conf?: unknown,
) => any
```

#### action: showWidget

```ts
type showWidget = (widget: any) => void
```

#### action: hideWidget

```ts
type hideWidget = (widget: any) => void
```

#### action: minimizeWidgetDrawer

```ts
type minimizeWidgetDrawer = () => void
```

#### action: showWidgetDrawer

```ts
type showWidgetDrawer = () => void
```

#### action: returnWidgetToDrawer

```ts
type returnWidgetToDrawer = () => void
```

#### action: hideAllWidgets

```ts
type hideAllWidgets = () => void
```

</details>
