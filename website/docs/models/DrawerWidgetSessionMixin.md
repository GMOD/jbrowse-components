---
id: drawerwidgetsessionmixin
title: DrawerWidgetSessionMixin
sidebar_label: Mixin -> DrawerWidgetSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/DrawerWidgets.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DrawerWidgetSessionMixin.md)

## Overview

<details open>
<summary>DrawerWidgetSessionMixin - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                       | Signature                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| [`drawerPosition`](#property-drawerposition) | `IOptionalIType<ISimpleType<string>, [undefined]>`                        |
| [`drawerWidth`](#property-drawerwidth)       | `IOptionalIType<ISimpleType<number>, [undefined]>`                        |
| [`widgets`](#property-widgets)               | `IOptionalIType<IMapType<IAnyType>, [undefined]>`                         |
| [`activeWidgets`](#property-activewidgets)   | `IOptionalIType<IMapType<IMaybe<IReferenceType<IAnyType>>>, [undefined]>` |
| [`minimized`](#property-minimized)           | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                       |

</details>

<details>
<summary>DrawerWidgetSessionMixin - Properties (all signatures)</summary>

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

<details open>
<summary>DrawerWidgetSessionMixin - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                   | Signature |
| ---------------------------------------- | --------- |
| [`visibleWidget`](#getter-visiblewidget) | `any`     |

</details>

<details>
<summary>DrawerWidgetSessionMixin - Getters (all signatures)</summary>

#### getter: visibleWidget

```ts
type visibleWidget = any
```

</details>

<details open>
<summary>DrawerWidgetSessionMixin - Actions</summary>

#### action: editConfiguration

opens a configuration editor to configure the given thing, and sets the current
task to be configuring it

```ts
type editConfiguration = (configuration: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | { ...; }, opts?: { ...; } | undefined) => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| [`setDrawerPosition`](#action-setdrawerposition)       | `(arg: string) => void`                                                     |
| [`updateDrawerWidth`](#action-updatedrawerwidth)       | `(drawerWidth: number) => number`                                           |
| [`resizeDrawer`](#action-resizedrawer)                 | `(distance: number) => number`                                              |
| [`addWidget`](#action-addwidget)                       | `(typeName: string, id: string, initialState?: any, conf?: unknown) => any` |
| [`showWidget`](#action-showwidget)                     | `(widget: any) => void`                                                     |
| [`hideWidget`](#action-hidewidget)                     | `(widget: any) => void`                                                     |
| [`minimizeWidgetDrawer`](#action-minimizewidgetdrawer) | `() => void`                                                                |
| [`showWidgetDrawer`](#action-showwidgetdrawer)         | `() => void`                                                                |
| [`hideAllWidgets`](#action-hideallwidgets)             | `() => void`                                                                |

</details>

<details>
<summary>DrawerWidgetSessionMixin - Actions (all signatures)</summary>

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
