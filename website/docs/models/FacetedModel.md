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

#### property: panelWidth

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
panelWidth: types.optional(types.number, () =>
        JSON.parse(localStorageGetItem('facet-panelWidth') || '400'),
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

#### property: showSparse

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showSparse: types.optional(types.boolean, () =>
        JSON.parse(localStorageGetItem('facet-showSparse') || 'false'),
      )
```

### FacetedModel - Getters

#### getter: allTrackConfigurations

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

#### getter: rows

```js
// type
{ readonly adapter: string; readonly category: string; readonly conf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>; readonly description: string; readonly id: string; readonly metadata: Record<...>; readonly name: string...
```

#### getter: fields

```js
// type
any[]
```

#### getter: filteredNonMetadataKeys

```js
// type
string[] | readonly ["category", "adapter", "description"]
```

#### getter: filteredRows

```js
// type
{ readonly adapter: string; readonly category: string; readonly conf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>; readonly description: string; readonly id: string; readonly metadata: Record<...>; readonly name: string...
```

#### getter: metadataKeys

```js
// type
any[]
```

### FacetedModel - Actions

#### action: setFilter

```js
// type signature
setFilter: (key: string, value: string[]) => void
```

#### action: setFilterText

```js
// type signature
setFilterText: (str: string) => void
```

#### action: setPanelWidth

```js
// type signature
setPanelWidth: (width: number) => void
```

#### action: setShowFilters

```js
// type signature
setShowFilters: (f: boolean) => void
```

#### action: setShowOptions

```js
// type signature
setShowOptions: (f: boolean) => void
```

#### action: setShowSparse

```js
// type signature
setShowSparse: (f: boolean) => void
```

#### action: setUseShoppingCart

```js
// type signature
setUseShoppingCart: (f: boolean) => void
```

#### action: setVisible

```js
// type signature
setVisible: (args: Record<string, boolean>) => void
```

#### action: setWidths

```js
// type signature
setWidths: (args: Record<string, number>) => void
```
