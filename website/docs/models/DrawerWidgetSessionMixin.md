---
id: drawerwidgetsessionmixin
title: DrawerWidgetSessionMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/product-core/src/Session/DrawerWidgets.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/DrawerWidgets.ts)

### DrawerWidgetSessionMixin - Properties

#### property: drawerPosition

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
drawerPosition: types.optional(
        types.string,
        () => localStorageGetItem('drawerPosition') || 'right',
      )
```

#### property: drawerWidth

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      )
```

#### property: widgets

```js
// type signature
IMapType<IAnyType>
// code
widgets: types.map(widgetStateModelType)
```

#### property: activeWidgets

```js
// type signature
IMapType<IMaybe<IReferenceType<IAnyType>>>
// code
activeWidgets: types.map(types.safeReference(widgetStateModelType))
```

#### property: minimized

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.optional(types.boolean, false)
```

### DrawerWidgetSessionMixin - Getters

#### getter: visibleWidget

```js
// type
any
```

### DrawerWidgetSessionMixin - Actions

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
addWidget: (typeName: string, id: string, initialState?: {}, conf?: unknown) => any
```

#### action: showWidget

```js
// type signature
showWidget: (widget: any) => void
```

#### action: hasWidget

```js
// type signature
hasWidget: (widget: any) => boolean
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
editConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => void
```
