---
id: hierarchicaltrackselectorwidget
title: HierarchicalTrackSelectorWidget
sidebar_label: Widget -> HierarchicalTrackSelectorWidget
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/HierarchicalTrackSelectorWidget.md)

## Overview

<details open>
<summary>HierarchicalTrackSelectorWidget - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                   | Signature                                          |
| ------------------------ | -------------------------------------------------- |
| [`id`](#property-id)     | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| [`type`](#property-type) | `ISimpleType<"HierarchicalTrackSelectorWidget">`   |
| [`view`](#property-view) | `IMaybe<IReferenceType<IAnyType>>`                 |

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Properties (all signatures)</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<'HierarchicalTrackSelectorWidget'>
// code
type: types.literal('HierarchicalTrackSelectorWidget')
```

#### property: view

```ts
// type signature
type view = IMaybe<IReferenceType<IAnyType>>
// code
view: types.safeReference(pluginManager.pluggableMstType('view', 'stateModel'))
```

</details>

<details open>
<summary>HierarchicalTrackSelectorWidget - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature                                                                                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`favorites`](#volatile-favorites)                     | `string[]`                                                                                                                                                                                         |
| [`recentlyUsed`](#volatile-recentlyused)               | `string[]`                                                                                                                                                                                         |
| [`selection`](#volatile-selection)                     | `(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]` |
| [`sortTrackNames`](#volatile-sorttracknames)           | `boolean \| undefined`                                                                                                                                                                             |
| [`sortCategories`](#volatile-sortcategories)           | `boolean \| undefined`                                                                                                                                                                             |
| [`collapsed`](#volatile-collapsed)                     | `ObservableMap<string, boolean>`                                                                                                                                                                   |
| [`folderCategories`](#volatile-foldercategories)       | `ObservableSet<string>`                                                                                                                                                                            |
| [`filterText`](#volatile-filtertext)                   | `string`                                                                                                                                                                                           |
| [`recentlyUsedCounter`](#volatile-recentlyusedcounter) | `number`                                                                                                                                                                                           |
| [`favoritesCounter`](#volatile-favoritescounter)       | `number`                                                                                                                                                                                           |

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Volatiles (all signatures)</summary>

#### volatile: favorites

```ts
// type signature
type favorites = string[]
// code
favorites: localStorageGetJSON<string[]>(favoritesK(), [])
```

#### volatile: recentlyUsed

```ts
// type signature
type recentlyUsed = string[]
// code
recentlyUsed: [] as string[]
```

#### volatile: selection

```ts
// type signature
type selection = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
// code
selection: [] as AnyConfigurationModel[]
```

#### volatile: sortTrackNames

```ts
// type signature
type sortTrackNames = boolean | undefined
// code
sortTrackNames: localStorageGetJSON<boolean | undefined>(
  sortTrackNamesK,
  undefined,
)
```

#### volatile: sortCategories

```ts
// type signature
type sortCategories = boolean | undefined
// code
sortCategories: localStorageGetJSON<boolean | undefined>(
  sortCategoriesK,
  undefined,
)
```

#### volatile: collapsed

```ts
// type signature
type collapsed = ObservableMap<string, boolean>
// code
collapsed: observable.map<string, boolean>()
```

#### volatile: folderCategories

```ts
// type signature
type folderCategories = ObservableSet<string>
// code
folderCategories: observable.set<string>()
```

#### volatile: filterText

```ts
// type signature
type filterText = string
// code
filterText: ''
```

#### volatile: recentlyUsedCounter

```ts
// type signature
type recentlyUsedCounter = number
// code
recentlyUsedCounter: 0
```

#### volatile: favoritesCounter

```ts
// type signature
type favoritesCounter = number
// code
favoritesCounter: 0
```

</details>

<details open>
<summary>HierarchicalTrackSelectorWidget - Getters</summary>

#### getter: configAndSessionTrackConfigurations

filter out tracks that don't match the current assembly/display types

```ts
type configAndSessionTrackConfigurations = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: allTrackConfigurationMap

unfiltered map of every track (incl. connection tracks for other assemblies/view
types); used by the faceted selector

```ts
type allTrackConfigurationMap = Map<any, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

#### getter: displayableTrackConfigurationMap

map restricted to tracks the current view can display; connection tracks go
through the same filterTracks() pass as the tree so favorites and recently-used
don't surface tracks the view can't show

```ts
type displayableTrackConfigurationMap = Map<any, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

#### getter: favoriteTracks

filters out tracks that are not in the favorites group

```ts
type favoriteTracks = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: recentlyUsedTracks

filters out tracks that are not in the recently used group

```ts
type recentlyUsedTracks = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                     | Signature                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`shownTrackIds`](#getter-showntrackids)                   | `Set<string>`                                                                                                                                                                                                                                        |
| [`selectionSet`](#getter-selectionset)                     | `Set<ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>`                                                  |
| [`favoritesSet`](#getter-favoritesset)                     | `Set<string>`                                                                                                                                                                                                                                        |
| [`recentlyUsedSet`](#getter-recentlyusedset)               | `Set<string>`                                                                                                                                                                                                                                        |
| [`assemblyNames`](#getter-assemblynames)                   | `string[]`                                                                                                                                                                                                                                           |
| [`activeSortTrackNames`](#getter-activesorttracknames)     | `any`                                                                                                                                                                                                                                                |
| [`activeSortCategories`](#getter-activesortcategories)     | `any`                                                                                                                                                                                                                                                |
| [`allTrackConfigurations`](#getter-alltrackconfigurations) | `(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]`                                                   |
| [`allTracks`](#getter-alltracks)                           | `{ group: any; tracks: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]; noCategories: boolean; }[]` |
| [`hierarchy`](#getter-hierarchy)                           | `{ name: string; id: string; type: "category"; children: { name: any; id: any; type: "category"; nestingLevel: number; children: TreeNode[]; }[]; }`                                                                                                 |
| [`flattenedItems`](#getter-flatteneditems)                 | `TreeNode[]`                                                                                                                                                                                                                                         |
| [`flattenedItemOffsets`](#getter-flatteneditemoffsets)     | `{ cumulativeHeight: number; offsets: number[]; }`                                                                                                                                                                                                   |
| [`folderCategoryStats`](#getter-foldercategorystats)       | `Map<string, { active: number; total: number; }>`                                                                                                                                                                                                    |
| [`hasAnySubcategories`](#getter-hasanysubcategories)       | `boolean`                                                                                                                                                                                                                                            |

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Getters (all signatures)</summary>

#### getter: shownTrackIds

```ts
type shownTrackIds = Set<string>
```

#### getter: selectionSet

```ts
type selectionSet = Set<ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

#### getter: favoritesSet

```ts
type favoritesSet = Set<string>
```

#### getter: recentlyUsedSet

```ts
type recentlyUsedSet = Set<string>
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: activeSortTrackNames

```ts
type activeSortTrackNames = any
```

#### getter: activeSortCategories

```ts
type activeSortCategories = any
```

#### getter: allTrackConfigurations

```ts
type allTrackConfigurations = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: allTracks

```ts
type allTracks = { group: any; tracks: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]; noCategories: boolean; }[]
```

#### getter: hierarchy

```ts
type hierarchy = {
  name: string
  id: string
  type: 'category'
  children: {
    name: any
    id: any
    type: 'category'
    nestingLevel: number
    children: TreeNode[]
  }[]
}
```

#### getter: flattenedItems

```ts
type flattenedItems = TreeNode[]
```

#### getter: flattenedItemOffsets

```ts
type flattenedItemOffsets = { cumulativeHeight: number; offsets: number[] }
```

#### getter: folderCategoryStats

```ts
type folderCategoryStats = Map<string, { active: number; total: number }>
```

#### getter: hasAnySubcategories

```ts
type hasAnySubcategories = boolean
```

</details>

<details open>
<summary>HierarchicalTrackSelectorWidget - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                                                                                                                                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`isSelected`](#method-isselected)                 | `(track: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => boolean`                      |
| [`isFavorite`](#method-isfavorite)                 | `(trackId: string) => boolean`                                                                                                                                                                                                          |
| [`isRecentlyUsed`](#method-isrecentlyused)         | `(trackId: string) => boolean`                                                                                                                                                                                                          |
| [`getRefSeqTrackConf`](#method-getrefseqtrackconf) | `(assemblyName: string) => (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) \| undefined` |
| [`itemOffsets`](#method-itemoffsets)               | `(height: number, scrollTop: number) => { startIndex: number; endIndex: number; totalHeight: number; }`                                                                                                                                 |

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Methods (all signatures)</summary>

#### method: isSelected

```ts
type isSelected = (track: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => boolean
```

#### method: isFavorite

```ts
type isFavorite = (trackId: string) => boolean
```

#### method: isRecentlyUsed

```ts
type isRecentlyUsed = (trackId: string) => boolean
```

#### method: getRefSeqTrackConf

```ts
type getRefSeqTrackConf = (assemblyName: string) => (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | undefined
```

#### method: itemOffsets

```ts
type itemOffsets = (
  height: number,
  scrollTop: number,
) => { startIndex: number; endIndex: number; totalHeight: number }
```

</details>

<details open>
<summary>HierarchicalTrackSelectorWidget - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                             | Signature                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`setSortTrackNames`](#action-setsorttracknames)                   | `(val: boolean) => void`                                                                                                                                                                                          |
| [`setSortCategories`](#action-setsortcategories)                   | `(val: boolean) => void`                                                                                                                                                                                          |
| [`setSelection`](#action-setselection)                             | `(elt: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]) => void` |
| [`addToSelection`](#action-addtoselection)                         | `(elt: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]) => void` |
| [`removeFromSelection`](#action-removefromselection)               | `(elt: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]) => void` |
| [`clearSelection`](#action-clearselection)                         | `() => void`                                                                                                                                                                                                      |
| [`addToFavorites`](#action-addtofavorites)                         | `(trackId: string) => void`                                                                                                                                                                                       |
| [`removeFromFavorites`](#action-removefromfavorites)               | `(trackId: string) => void`                                                                                                                                                                                       |
| [`clearFavorites`](#action-clearfavorites)                         | `() => void`                                                                                                                                                                                                      |
| [`setRecentlyUsedCounter`](#action-setrecentlyusedcounter)         | `(val: number) => void`                                                                                                                                                                                           |
| [`setRecentlyUsed`](#action-setrecentlyused)                       | `(str: string[]) => void`                                                                                                                                                                                         |
| [`setFavoritesCounter`](#action-setfavoritescounter)               | `(val: number) => void`                                                                                                                                                                                           |
| [`addToRecentlyUsed`](#action-addtorecentlyused)                   | `(id: string) => void`                                                                                                                                                                                            |
| [`clearRecentlyUsed`](#action-clearrecentlyused)                   | `() => void`                                                                                                                                                                                                      |
| [`setView`](#action-setview)                                       | `(view: unknown) => void`                                                                                                                                                                                         |
| [`toggleCategory`](#action-togglecategory)                         | `(pathName: string) => void`                                                                                                                                                                                      |
| [`setCategoryCollapsed`](#action-setcategorycollapsed)             | `(pathName: string, status: boolean) => void`                                                                                                                                                                     |
| [`expandAllCategories`](#action-expandallcategories)               | `() => void`                                                                                                                                                                                                      |
| [`setCollapsedCategories`](#action-setcollapsedcategories)         | `(str: [string, boolean][]) => void`                                                                                                                                                                              |
| [`toggleFolderCategory`](#action-togglefoldercategory)             | `(categoryId: string) => void`                                                                                                                                                                                    |
| [`setFolderCategories`](#action-setfoldercategories)               | `(ids: string[]) => void`                                                                                                                                                                                         |
| [`clearFilterText`](#action-clearfiltertext)                       | `() => void`                                                                                                                                                                                                      |
| [`setFilterText`](#action-setfiltertext)                           | `(newText: string) => void`                                                                                                                                                                                       |
| [`collapseSubCategories`](#action-collapsesubcategories)           | `() => void`                                                                                                                                                                                                      |
| [`collapseTopLevelCategories`](#action-collapsetoplevelcategories) | `() => void`                                                                                                                                                                                                      |

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Actions (all signatures)</summary>

#### action: setSortTrackNames

```ts
type setSortTrackNames = (val: boolean) => void
```

#### action: setSortCategories

```ts
type setSortCategories = (val: boolean) => void
```

#### action: setSelection

```ts
type setSelection = (elt: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]) => void
```

#### action: addToSelection

```ts
type addToSelection = (elt: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]) => void
```

#### action: removeFromSelection

```ts
type removeFromSelection = (elt: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]) => void
```

#### action: clearSelection

```ts
type clearSelection = () => void
```

#### action: addToFavorites

```ts
type addToFavorites = (trackId: string) => void
```

#### action: removeFromFavorites

```ts
type removeFromFavorites = (trackId: string) => void
```

#### action: clearFavorites

```ts
type clearFavorites = () => void
```

#### action: setRecentlyUsedCounter

```ts
type setRecentlyUsedCounter = (val: number) => void
```

#### action: setRecentlyUsed

```ts
type setRecentlyUsed = (str: string[]) => void
```

#### action: setFavoritesCounter

```ts
type setFavoritesCounter = (val: number) => void
```

#### action: addToRecentlyUsed

```ts
type addToRecentlyUsed = (id: string) => void
```

#### action: clearRecentlyUsed

```ts
type clearRecentlyUsed = () => void
```

#### action: setView

```ts
type setView = (view: unknown) => void
```

#### action: toggleCategory

```ts
type toggleCategory = (pathName: string) => void
```

#### action: setCategoryCollapsed

```ts
type setCategoryCollapsed = (pathName: string, status: boolean) => void
```

#### action: expandAllCategories

```ts
type expandAllCategories = () => void
```

#### action: setCollapsedCategories

```ts
type setCollapsedCategories = (str: [string, boolean][]) => void
```

#### action: toggleFolderCategory

```ts
type toggleFolderCategory = (categoryId: string) => void
```

#### action: setFolderCategories

```ts
type setFolderCategories = (ids: string[]) => void
```

#### action: clearFilterText

```ts
type clearFilterText = () => void
```

#### action: setFilterText

```ts
type setFilterText = (newText: string) => void
```

#### action: collapseSubCategories

```ts
type collapseSubCategories = () => void
```

#### action: collapseTopLevelCategories

```ts
type collapseTopLevelCategories = () => void
```

</details>
