---
id: appsessionmixin
title: AppSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/AppSession/AppSessionMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/AppSessionMixin.md)

## Overview

Session getters shared by the "app" products (desktop + web) that simply
delegate to the root model — `version`, `history`, `menus`, `assemblyManager` —
plus `renderProps` and `renameCurrentSession`. Centralized here so the products
compose one mixin instead of re-declaring (and diverging on) the same root
delegations. The root must satisfy .

### AppSessionMixin - Getters

#### getter: root

```js
// type
AppRootModel
```

#### getter: version

```js
// type
string
```

#### getter: history

```js
// type
{ canUndo: boolean; canRedo: boolean; undo(): void; redo(): void; } | undefined
```

#### getter: assemblyManager

```js
// type
ModelInstanceTypeProps<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 5 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 10 more ... & { ...; }, _NotCustomized, _NotCust...
```

### AppSessionMixin - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: Theme
  highResolutionScaling: any
}
```

#### method: menus

```js
// type signature
menus: () => Menu[]
```

### AppSessionMixin - Actions

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => void
```
