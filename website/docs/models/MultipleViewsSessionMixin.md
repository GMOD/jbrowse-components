---
id: multipleviewssessionmixin
title: MultipleViewsSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/MultipleViews.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultipleViewsSessionMixin.md)

## Docs

composed of

- [BaseSessionModel](../basesessionmodel)
- [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)

### MultipleViewsSessionMixin - Properties

#### property: views

```js
// type signature
IArrayType<any>
// code
views: types.array(
          pluginManager.pluggableMstType('view', 'stateModel'),
        )
```

#### property: stickyViewHeaders

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
stickyViewHeaders: types.optional(types.boolean, () =>
          localStorageGetBoolean('stickyViewHeaders', true),
        )
```

#### property: useWorkspaces

enables the dockview-based tabbed/tiled workspace layout

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
useWorkspaces: types.optional(types.boolean, () =>
          localStorageGetBoolean('useWorkspaces', false),
        )
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
removeView: (view: IBaseViewModel) => void
```

#### action: setStickyViewHeaders

```js
// type signature
setStickyViewHeaders: (sticky: boolean) => void
```

#### action: setUseWorkspaces

```js
// type signature
setUseWorkspaces: (useWorkspaces: boolean) => void
```
