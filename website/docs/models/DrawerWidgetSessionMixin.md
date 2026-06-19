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
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">DrawerWidgetSessionMixin - Properties</summary>

#### property: drawerPosition

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
drawerPosition: types.optional(
        types.string,
        () => localStorageGetItem('drawerPosition') ?? 'right',
      )
```

#### property: drawerWidth

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
drawerWidth: types.stripDefault(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      )
```

#### property: widgets

```js
// type signature
IOptionalIType<IMapType<IAnyType>, [undefined]>
// code
widgets: types.stripDefault(types.map(widgetStateModelType), {})
```

#### property: activeWidgets

```js
// type signature
IOptionalIType<IMapType<IMaybe<IReferenceType<IAnyType>>>, [undefined]>
// code
activeWidgets: types.stripDefault(
        types.map(types.safeReference(widgetStateModelType)),
        {},
      )
```

#### property: minimized

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">DrawerWidgetSessionMixin - Getters</summary>

#### getter: visibleWidget

```js
// type
any
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">DrawerWidgetSessionMixin - Actions</summary>

#### action: setDrawerPosition

```js
// type signature
setDrawerPosition: (arg: string) => void
```

#### action: updateDrawerWidth

```js
// type signature
updateDrawerWidth: (drawerWidth: number) => number
```

#### action: resizeDrawer

```js
// type signature
resizeDrawer: (distance: number) => number
```

#### action: addWidget

```js
// type signature
addWidget: (typeName: string, id: string, initialState?: any, conf?: unknown) => any
```

#### action: showWidget

```js
// type signature
showWidget: (widget: any) => void
```

#### action: hideWidget

```js
// type signature
hideWidget: (widget: any) => void
```

#### action: minimizeWidgetDrawer

```js
// type signature
minimizeWidgetDrawer: () => void
```

#### action: showWidgetDrawer

```js
// type signature
showWidgetDrawer: () => void
```

#### action: hideAllWidgets

```js
// type signature
hideAllWidgets: () => void
```

#### action: editConfiguration

opens a configuration editor to configure the given thing, and sets the current
task to be configuring it

```js
// type signature
editConfiguration: (configuration: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | { ...; }, opts?: { ...; } | undefined) => void
```

</details>
