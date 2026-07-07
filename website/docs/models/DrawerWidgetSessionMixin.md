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

| Member                                               | Kind       | Description                                                                                               |
| ---------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| [drawerPosition](#property-drawerposition)           | Properties |                                                                                                           |
| [drawerWidth](#property-drawerwidth)                 | Properties |                                                                                                           |
| [widgets](#property-widgets)                         | Properties |                                                                                                           |
| [activeWidgets](#property-activewidgets)             | Properties |                                                                                                           |
| [minimized](#property-minimized)                     | Properties |                                                                                                           |
| [visibleWidget](#getter-visiblewidget)               | Getters    |                                                                                                           |
| [setDrawerPosition](#action-setdrawerposition)       | Actions    |                                                                                                           |
| [updateDrawerWidth](#action-updatedrawerwidth)       | Actions    |                                                                                                           |
| [resizeDrawer](#action-resizedrawer)                 | Actions    |                                                                                                           |
| [addWidget](#action-addwidget)                       | Actions    |                                                                                                           |
| [showWidget](#action-showwidget)                     | Actions    |                                                                                                           |
| [hideWidget](#action-hidewidget)                     | Actions    |                                                                                                           |
| [minimizeWidgetDrawer](#action-minimizewidgetdrawer) | Actions    |                                                                                                           |
| [showWidgetDrawer](#action-showwidgetdrawer)         | Actions    |                                                                                                           |
| [hideAllWidgets](#action-hideallwidgets)             | Actions    |                                                                                                           |
| [editConfiguration](#action-editconfiguration)       | Actions    | opens a configuration editor to configure the given thing, and sets the current task to be configuring it |

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
<summary>DrawerWidgetSessionMixin - Getters</summary>

#### getter: visibleWidget

```ts
type visibleWidget = any
```

</details>

<details>
<summary>DrawerWidgetSessionMixin - Actions</summary>

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

#### action: hideAllWidgets

```ts
type hideAllWidgets = () => void
```

</details>
