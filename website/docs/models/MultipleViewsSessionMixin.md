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

#### action: addLinearGenomeViewOfAssembly

```js
// type signature
addLinearGenomeViewOfAssembly: (assemblyName: string, initialState?: {}) => any
```

#### action: addView

```js
// type signature
addView: (typeName: string, initialState?: {}) => any
```

#### action: addViewFromAnotherView

```js
// type signature
addViewFromAnotherView: (viewType: string, otherView: { displayName: string; id: string; minimized: boolean; displayedRegions: IMSTArray<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<...>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>;...
```

#### action: addViewOfAssembly

```js
// type signature
addViewOfAssembly: (viewType: string, assemblyName: string, initialState?: Record<string, unknown>) => any
```

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

#### action: removeView

```js
// type signature
removeView: (view: { displayName: string; id: string; minimized: boolean; } & NonEmptyObject & { width: number; } & { menuItems(): MenuItem[]; } & { setDisplayName(name: string): void; setMinimized(flag: boolean): void; setWidth(newWidth: number): void; } & IStateTreeNode<...>) => void
```
