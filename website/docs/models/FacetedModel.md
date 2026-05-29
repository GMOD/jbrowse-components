---
id: facetedmodel
title: FacetedModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/FacetedSelector/facetedModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/FacetedModel.md)

## Docs

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
        localStorageGetBoolean('facet-showSparse', false),
      )
```

#### property: showFilters

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showFilters: types.optional(types.boolean, () =>
        localStorageGetBoolean('facet-showFilters', true),
      )
```

#### property: panelWidth

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
panelWidth: types.optional(types.number, () =>
        localStorageGetNumber('facet-panelWidth', 400),
      )
```

### FacetedModel - Volatiles

#### volatile: visible

```js
// type signature
Record<string, boolean>
// code
visible: {} as Record<string, boolean>
```

#### volatile: useShoppingCart

```js
// type signature
false
// code
useShoppingCart: false
```

#### volatile: filters

```js
// type signature
ObservableMap<string, string[]>
// code
filters: observable.map<string, string[]>()
```

#### volatile: trackConfigurations

```js
// type signature
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
// code
trackConfigurations: [] as AnyConfigurationModel[]
```

#### volatile: session

```js
// type signature
AbstractSessionModel | undefined
// code
session: undefined as AbstractSessionModel | undefined
```

### FacetedModel - Getters

#### getter: allRows

Builds row objects from track configs. Cached and only recomputes when track
configurations change, not on every filterText keystroke.

```js
// type
{ readonly id: string; readonly conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<...>; }[]
```

#### getter: rows

Text-filtered rows. Cheap string filtering on already-built allRows.

```js
// type
{ readonly id: string; readonly conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<...>; }[]
```

#### getter: filteredNonMetadataKeys

```js
// type
string[] | readonly ["category", "adapter", "description"]
```

#### getter: metadataKeys

```js
// type
string[]
```

#### getter: filteredMetadataKeys

```js
// type
string[]
```

#### getter: fields

```js
// type
string[]
```

#### getter: filteredRows

```js
// type
{ readonly id: string; readonly conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<...>; }[]
```

#### getter: facetCategoryCounts

Per-facet category counts for the filter sidebar. Cached by MobX so it
recomputes only when rows or filters change, not on every render. Active-filter
facets are counted first against the pre-filter row set so their counts reflect
drill-down.

```js
// type
Map<string, Map<string, number>>
```

#### getter: initialWidths

Measured pixel widths for every column. Measured over allRows so widths stay
stable and don't recompute on every filterText keystroke.

```js
// type
Record<string, number>
```

### FacetedModel - Actions

#### action: setTrackConfigurations

```js
// type signature
setTrackConfigurations: (tracks: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[], session: AbstractSessionModel) => void
```

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
