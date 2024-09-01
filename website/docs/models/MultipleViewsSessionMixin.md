---
id: multipleviewssessionmixin
title: MultipleViewsSessionMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/product-core/src/Session/MultipleViews.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/MultipleViews.ts)

composed of

- [BaseSessionModel](../basesessionmodel)
- [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)

### MultipleViewsSessionMixin - Properties

#### property: views

```js
// type signature
IArrayType<IAnyType>
// code
views: types.array(pluginManager.pluggableMstType('view', 'stateModel'))
```

### MultipleViewsSessionMixin - Actions

#### action: moveViewDown

```js
// type signature
moveViewDown: (id: string) => void
```

#### action: moveViewUp

```js
// type signature
moveViewUp: (id: string) => void
```

#### action: moveViewToTop

```js
// type signature
moveViewToTop: (id: string) => void
```

#### action: moveViewToBottom

```js
// type signature
moveViewToBottom: (id: string) => void
```

#### action: addView

```js
// type signature
addView: (typeName: string, initialState?: {}) => any
```

#### action: removeView

```js
// type signature
removeView: (view: { id: string; displayName: string; minimized: boolean; } & NonEmptyObject & { width: number; } & { menuItems(): MenuItem[]; } & { setDisplayName(name: string): void; setWidth(newWidth: number): void; setMinimized(flag: boolean): void; } & IStateTreeNode<...>) => void
```

#### action: addLinearGenomeViewOfAssembly

```js
// type signature
addLinearGenomeViewOfAssembly: (assemblyName: string, initialState?: {}) => any
```

#### action: addViewOfAssembly

```js
// type signature
addViewOfAssembly: (viewType: string, assemblyName: string, initialState?: Record<string, unknown>) => any
```

#### action: addViewFromAnotherView

```js
// type signature
addViewFromAnotherView: (viewType: string, otherView: { id: string; displayName: string; minimized: boolean; displayedRegions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<...>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>;...
```
