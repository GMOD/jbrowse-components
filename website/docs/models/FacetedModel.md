---
id: facetedmodel
title: FacetedModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/data-management/src/HierarchicalTrackSelectorWidget/facetedModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/HierarchicalTrackSelectorWidget/facetedModel.ts)

### FacetedModel - Properties

#### property: filterText

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
filterText: types.optional(types.string, '')
```

#### property: showSparse

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showSparse: types.optional(types.boolean, () =>
        JSON.parse(localStorageGetItem('facet-showSparse') || 'false'),
      )
```

#### property: showFilters

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showFilters: types.optional(types.boolean, () =>
        JSON.parse(localStorageGetItem('facet-showFilters') || 'true'),
      )
```

#### property: showOptions

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showOptions: types.optional(types.boolean, () =>
        JSON.parse(localStorageGetItem('facet-showTableOptions') || 'false'),
      )
```

#### property: panelWidth

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
panelWidth: types.optional(types.number, () =>
        JSON.parse(localStorageGetItem('facet-panelWidth') || '400'),
      )
```

### FacetedModel - Getters

#### getter: allTrackConfigurations

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)[]
```

#### getter: rows

```js
// type
{ readonly id: string; readonly conf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ ...; } & ... 2 more ... & IStateTreeNode<...>); } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<string, unknown>; }[]
```

#### getter: filteredNonMetadataKeys

```js
// type
string[] | readonly ["category", "adapter", "description"]
```

#### getter: metadataKeys

```js
// type
any[]
```

#### getter: fields

```js
// type
any[]
```

#### getter: filteredRows

```js
// type
{ readonly id: string; readonly conf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ ...; } & ... 2 more ... & IStateTreeNode<...>); } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<string, unknown>; }[]
```

### FacetedModel - Actions

#### action: setFilter

```js
// type signature
setFilter: (key: string, value: string[]) => void
```

#### action: setPanelWidth

```js
// type signature
setPanelWidth: (width: number) => number
```

#### action: setUseShoppingCart

```js
// type signature
setUseShoppingCart: (f: boolean) => void
```

#### action: setFilterText

```js
// type signature
setFilterText: (str: string) => void
```

#### action: setShowSparse

```js
// type signature
setShowSparse: (f: boolean) => void
```

#### action: setShowOptions

```js
// type signature
setShowOptions: (f: boolean) => void
```

#### action: setShowFilters

```js
// type signature
setShowFilters: (f: boolean) => void
```

#### action: setVisible

```js
// type signature
setVisible: (args: Record<string, boolean>) => void
```
