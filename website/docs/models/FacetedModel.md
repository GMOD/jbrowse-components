---
id: facetedmodel
title: FacetedModel
sidebar_label: Widget -> FacetedModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/FacetedSelector/facetedModel.ts).

## Overview

## Members

| Member                                                   | Kind       | Description                                                                                                                                                     |
| -------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [filterText](#property-filtertext)                       | Properties |                                                                                                                                                                 |
| [showSparse](#property-showsparse)                       | Properties |                                                                                                                                                                 |
| [showFilters](#property-showfilters)                     | Properties |                                                                                                                                                                 |
| [panelWidth](#property-panelwidth)                       | Properties |                                                                                                                                                                 |
| [hiddenColumns](#property-hiddencolumns)                 | Properties | Column names the user has hidden. Loaded from a config+assembly scoped localStorage entry in setTrackConfigurations (once assemblies are known).                |
| [assemblyNames](#volatile-assemblynames)                 | Volatiles  |                                                                                                                                                                 |
| [useShoppingCart](#volatile-useshoppingcart)             | Volatiles  |                                                                                                                                                                 |
| [filters](#volatile-filters)                             | Volatiles  |                                                                                                                                                                 |
| [sortField](#volatile-sortfield)                         | Volatiles  | Field id the grid is sorted by; empty string keeps natural order.                                                                                               |
| [sortAscending](#volatile-sortascending)                 | Volatiles  |                                                                                                                                                                 |
| [trackConfigurations](#volatile-trackconfigurations)     | Volatiles  |                                                                                                                                                                 |
| [session](#volatile-session)                             | Volatiles  |                                                                                                                                                                 |
| [allRows](#getter-allrows)                               | Getters    | Builds row objects from track configs. Cached and only recomputes when track configurations change, not on every filterText keystroke.                          |
| [rows](#getter-rows)                                     | Getters    | Text-filtered rows. Cheap string filtering on already-built allRows.                                                                                            |
| [metadataKeys](#getter-metadatakeys)                     | Getters    |                                                                                                                                                                 |
| [facetFields](#getter-facetfields)                       | Getters    | Facet field ids in column order (non-metadata first, then `metadata.<key>`); both kinds resolve through getRowStr. Sparse fields are dropped unless showSparse. |
| [fields](#getter-fields)                                 | Getters    |                                                                                                                                                                 |
| [nonMetadataFieldSet](#getter-nonmetadatafieldset)       | Getters    | The non-metadata field names, used to detect when a metadata key collides with one (so the header can show "x (from metadata)").                                |
| [visible](#getter-visible)                               | Getters    | Per-field visibility derived from the persisted hiddenColumns list. A field absent from the list (e.g. newly introduced) defaults to visible.                   |
| [filteredRows](#getter-filteredrows)                     | Getters    |                                                                                                                                                                 |
| [facetCategoryCounts](#getter-facetcategorycounts)       | Getters    | Per-facet category counts for the filter sidebar. Cached by MobX so it recomputes only when rows or filters change, not on every render.                        |
| [initialWidths](#getter-initialwidths)                   | Getters    | Measured pixel widths for every column. Measured over allRows so widths stay stable and don't recompute on every filterText keystroke.                          |
| [sortedRows](#getter-sortedrows)                         | Getters    | Faceted rows in display order: filteredRows sorted by the active sort field (natural order when no field is selected).                                          |
| [setTrackConfigurations](#action-settrackconfigurations) | Actions    |                                                                                                                                                                 |
| [setFilter](#action-setfilter)                           | Actions    |                                                                                                                                                                 |
| [clearFilters](#action-clearfilters)                     | Actions    |                                                                                                                                                                 |
| [setSort](#action-setsort)                               | Actions    |                                                                                                                                                                 |
| [setPanelWidth](#action-setpanelwidth)                   | Actions    |                                                                                                                                                                 |
| [setUseShoppingCart](#action-setuseshoppingcart)         | Actions    |                                                                                                                                                                 |
| [setFilterText](#action-setfiltertext)                   | Actions    |                                                                                                                                                                 |
| [setShowSparse](#action-setshowsparse)                   | Actions    |                                                                                                                                                                 |
| [setShowFilters](#action-setshowfilters)                 | Actions    |                                                                                                                                                                 |
| [setColumnVisible](#action-setcolumnvisible)             | Actions    |                                                                                                                                                                 |

<details>
<summary>FacetedModel - Properties</summary>

#### property: hiddenColumns

Column names the user has hidden. Loaded from a config+assembly scoped
localStorage entry in setTrackConfigurations (once assemblies are known).

```ts
// type signature
type hiddenColumns = IOptionalIType<
  IArrayType<ISimpleType<string>>,
  [undefined]
>
// code
hiddenColumns: types.optional(types.array(types.string), [])
```

</details>

<details>
<summary>FacetedModel - Properties (other undocumented members)</summary>

#### property: filterText

```ts
// type signature
type filterText = IOptionalIType<ISimpleType<string>, [undefined]>
// code
filterText: types.optional(types.string, '')
```

#### property: showSparse

```ts
// type signature
type showSparse = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showSparse: types.optional(types.boolean, () =>
  localStorageGetBoolean('facet-showSparse', false),
)
```

#### property: showFilters

```ts
// type signature
type showFilters = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showFilters: types.optional(types.boolean, () =>
  localStorageGetBoolean('facet-showFilters', true),
)
```

#### property: panelWidth

```ts
// type signature
type panelWidth = IOptionalIType<ISimpleType<number>, [undefined]>
// code
panelWidth: types.optional(types.number, () =>
  localStorageGetNumber('facet-panelWidth', 400),
)
```

</details>

<details>
<summary>FacetedModel - Volatiles</summary>

#### volatile: sortField

Field id the grid is sorted by; empty string keeps natural order.

```ts
// type signature
type sortField = string
// code
sortField: ''
```

</details>

<details>
<summary>FacetedModel - Volatiles (other undocumented members)</summary>

#### volatile: assemblyNames

```ts
// type signature
type assemblyNames = string[]
// code
assemblyNames: [] as string[]
```

#### volatile: useShoppingCart

```ts
// type signature
type useShoppingCart = false
// code
useShoppingCart: false
```

#### volatile: filters

```ts
// type signature
type filters = ObservableMap<string, string[]>
// code
filters: observable.map<string, string[]>()
```

#### volatile: sortAscending

```ts
// type signature
type sortAscending = true
// code
sortAscending: true
```

#### volatile: trackConfigurations

```ts
// type signature
type trackConfigurations = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
// code
trackConfigurations: [] as AnyConfigurationModel[]
```

#### volatile: session

```ts
// type signature
type session = AbstractSessionModel | undefined
// code
session: undefined as AbstractSessionModel | undefined
```

</details>

<details>
<summary>FacetedModel - Getters</summary>

#### getter: allRows

Builds row objects from track configs. Cached and only recomputes when track
configurations change, not on every filterText keystroke.

```ts
type allRows = { readonly id: string; readonly conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<...>; }[]
```

#### getter: rows

Text-filtered rows. Cheap string filtering on already-built allRows.

```ts
type rows = { readonly id: string; readonly conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<...>; }[]
```

#### getter: facetFields

Facet field ids in column order (non-metadata first, then `metadata.<key>`);
both kinds resolve through getRowStr. Sparse fields are dropped unless
showSparse.

```ts
type facetFields = string[]
```

#### getter: nonMetadataFieldSet

The non-metadata field names, used to detect when a metadata key collides with
one (so the header can show "x (from metadata)").

```ts
type nonMetadataFieldSet = Set<string>
```

#### getter: visible

Per-field visibility derived from the persisted hiddenColumns list. A field
absent from the list (e.g. newly introduced) defaults to visible.

```ts
type visible = Record<string, boolean>
```

#### getter: facetCategoryCounts

Per-facet category counts for the filter sidebar. Cached by MobX so it
recomputes only when rows or filters change, not on every render.

```ts
type facetCategoryCounts = Map<string, Map<string, number>>
```

#### getter: initialWidths

Measured pixel widths for every column. Measured over allRows so widths stay
stable and don't recompute on every filterText keystroke.

```ts
type initialWidths = Record<string, number>
```

#### getter: sortedRows

Faceted rows in display order: filteredRows sorted by the active sort field
(natural order when no field is selected).

```ts
type sortedRows = { readonly id: string; readonly conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<...>; }[]
```

</details>

<details>
<summary>FacetedModel - Getters (other undocumented members)</summary>

#### getter: metadataKeys

```ts
type metadataKeys = string[]
```

#### getter: fields

```ts
type fields = string[]
```

#### getter: filteredRows

```ts
type filteredRows = { readonly id: string; readonly conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<...>; }[]
```

</details>

<details>
<summary>FacetedModel - Actions</summary>

#### action: setTrackConfigurations

```ts
type setTrackConfigurations = (tracks: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[], session: AbstractSessionModel, assemblyNames: string[]) => void
```

#### action: setFilter

```ts
type setFilter = (key: string, value: string[]) => void
```

#### action: clearFilters

```ts
type clearFilters = () => void
```

#### action: setSort

```ts
type setSort = (field: string, ascending: boolean) => void
```

#### action: setPanelWidth

```ts
type setPanelWidth = (width: number) => void
```

#### action: setUseShoppingCart

```ts
type setUseShoppingCart = (f: boolean) => void
```

#### action: setFilterText

```ts
type setFilterText = (str: string) => void
```

#### action: setShowSparse

```ts
type setShowSparse = (f: boolean) => void
```

#### action: setShowFilters

```ts
type setShowFilters = (f: boolean) => void
```

#### action: setColumnVisible

```ts
type setColumnVisible = (field: string, visible: boolean) => void
```

</details>
