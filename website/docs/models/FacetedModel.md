---
id: facetedmodel
title: FacetedModel
sidebar_label: Widget -> FacetedModel
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

## Overview

<details open>
<summary>FacetedModel - Properties</summary>

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

<details open>
<summary>FacetedModel - Volatiles</summary>

#### volatile: visible

```ts
// type signature
type visible = Record<string, boolean>
// code
visible: {} as Record<string, boolean>
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

<details open>
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

#### getter: filteredNonMetadataKeys

```ts
type filteredNonMetadataKeys =
  | string[]
  | readonly ['category', 'adapter', 'description']
```

#### getter: metadataKeys

```ts
type metadataKeys = string[]
```

#### getter: filteredMetadataKeys

```ts
type filteredMetadataKeys = string[]
```

#### getter: fields

```ts
type fields = string[]
```

#### getter: nonMetadataFieldSet

Used to detect when a metadata key collides with a non-metadata column name (so
the header can show "x (from metadata)").

```ts
type nonMetadataFieldSet = Set<string>
```

#### getter: filteredRows

```ts
type filteredRows = { readonly id: string; readonly conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; ... 4 more ...; readonly metadata: Record<...>; }[]
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

</details>

<details open>
<summary>FacetedModel - Actions</summary>

#### action: setTrackConfigurations

```ts
type setTrackConfigurations = (tracks: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[], session: AbstractSessionModel) => void
```

#### action: setFilter

```ts
type setFilter = (key: string, value: string[]) => void
```

#### action: setPanelWidth

```ts
type setPanelWidth = (width: number) => number
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

#### action: setVisible

```ts
type setVisible = (args: Record<string, boolean>) => void
```

</details>
