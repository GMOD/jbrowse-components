---
id: hierarchicaltrackselectorwidget
title: HierarchicalTrackSelectorWidget
sidebar_label: Widget -> HierarchicalTrackSelectorWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts).

## Overview

## Members

| Member                                                                             | Kind       | Defined by                      | Description                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ---------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                                                 | Properties | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [type](#property-type)                                                             | Properties | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [view](#property-view)                                                             | Properties | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [favorites](#volatile-favorites)                                                   | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [recentlyUsed](#volatile-recentlyused)                                             | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [selection](#volatile-selection)                                                   | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [sortTrackNames](#volatile-sorttracknames)                                         | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [sortCategories](#volatile-sortcategories)                                         | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [collapsed](#volatile-collapsed)                                                   | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [folderCategories](#volatile-foldercategories)                                     | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [filterText](#volatile-filtertext)                                                 | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [recentlyUsedCounter](#volatile-recentlyusedcounter)                               | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [favoritesCounter](#volatile-favoritescounter)                                     | Volatiles  | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [shownTrackIds](#getter-showntrackids)                                             | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [selectionSet](#getter-selectionset)                                               | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [favoritesSet](#getter-favoritesset)                                               | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [recentlyUsedSet](#getter-recentlyusedset)                                         | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [assemblyNames](#getter-assemblynames)                                             | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [activeSortTrackNames](#getter-activesorttracknames)                               | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [activeSortCategories](#getter-activesortcategories)                               | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [configAndSessionTrackConfigurations](#getter-configandsessiontrackconfigurations) | Getters    | HierarchicalTrackSelectorWidget | filter out tracks that don't match the current assembly/display types                                                                                                                                |
| [allTrackConfigurations](#getter-alltrackconfigurations)                           | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [allTrackConfigurationMap](#getter-alltrackconfigurationmap)                       | Getters    | HierarchicalTrackSelectorWidget | unfiltered map of every track (incl.                                                                                                                                                                 |
| [displayableTrackConfigurationMap](#getter-displayabletrackconfigurationmap)       | Getters    | HierarchicalTrackSelectorWidget | map restricted to tracks the current view can display; connection tracks go through the same filterTracks() pass as the tree so favorites and recently-used don't surface tracks the view can't show |
| [favoriteTracks](#getter-favoritetracks)                                           | Getters    | HierarchicalTrackSelectorWidget | filters out tracks that are not in the favorites group                                                                                                                                               |
| [recentlyUsedTracks](#getter-recentlyusedtracks)                                   | Getters    | HierarchicalTrackSelectorWidget | filters out tracks that are not in the recently used group                                                                                                                                           |
| [allTracks](#getter-alltracks)                                                     | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [hierarchy](#getter-hierarchy)                                                     | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [flattenedItems](#getter-flatteneditems)                                           | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [flattenedItemOffsets](#getter-flatteneditemoffsets)                               | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [folderCategoryStats](#getter-foldercategorystats)                                 | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [hasAnySubcategories](#getter-hasanysubcategories)                                 | Getters    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [isSelected](#method-isselected)                                                   | Methods    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [isFavorite](#method-isfavorite)                                                   | Methods    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [isRecentlyUsed](#method-isrecentlyused)                                           | Methods    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [getRefSeqTrackConf](#method-getrefseqtrackconf)                                   | Methods    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [itemOffsets](#method-itemoffsets)                                                 | Methods    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setSortTrackNames](#action-setsorttracknames)                                     | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setSortCategories](#action-setsortcategories)                                     | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setSelection](#action-setselection)                                               | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [addToSelection](#action-addtoselection)                                           | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [removeFromSelection](#action-removefromselection)                                 | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [clearSelection](#action-clearselection)                                           | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [addToFavorites](#action-addtofavorites)                                           | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [removeFromFavorites](#action-removefromfavorites)                                 | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [clearFavorites](#action-clearfavorites)                                           | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setRecentlyUsedCounter](#action-setrecentlyusedcounter)                           | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setRecentlyUsed](#action-setrecentlyused)                                         | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setFavoritesCounter](#action-setfavoritescounter)                                 | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [addToRecentlyUsed](#action-addtorecentlyused)                                     | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [clearRecentlyUsed](#action-clearrecentlyused)                                     | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setView](#action-setview)                                                         | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [toggleCategory](#action-togglecategory)                                           | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setCategoryCollapsed](#action-setcategorycollapsed)                               | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [expandAllCategories](#action-expandallcategories)                                 | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setCollapsedCategories](#action-setcollapsedcategories)                           | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [toggleFolderCategory](#action-togglefoldercategory)                               | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setFolderCategories](#action-setfoldercategories)                                 | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [clearFilterText](#action-clearfiltertext)                                         | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [setFilterText](#action-setfiltertext)                                             | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [collapseSubCategories](#action-collapsesubcategories)                             | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |
| [collapseTopLevelCategories](#action-collapsetoplevelcategories)                   | Actions    | HierarchicalTrackSelectorWidget |                                                                                                                                                                                                      |

<details>
<summary>HierarchicalTrackSelectorWidget - Properties</summary>

| Member                               | Type                                               |
| ------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>     | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-type">type</span> | `ISimpleType<"HierarchicalTrackSelectorWidget">`   |
| <span id="property-view">view</span> | `IMaybe<IReferenceType<IAnyType>>`                 |

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Volatiles</summary>

| Member                                                             | Type                                                                                                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="volatile-favorites">favorites</span>                     | `string[]`                                                                                                                                                                       |
| <span id="volatile-recentlyused">recentlyUsed</span>               | `string[]`                                                                                                                                                                       |
| <span id="volatile-selection">selection</span>                     | `(ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]` |
| <span id="volatile-sorttracknames">sortTrackNames</span>           | `boolean \| undefined`                                                                                                                                                           |
| <span id="volatile-sortcategories">sortCategories</span>           | `boolean \| undefined`                                                                                                                                                           |
| <span id="volatile-collapsed">collapsed</span>                     | `ObservableMap<string, boolean>`                                                                                                                                                 |
| <span id="volatile-foldercategories">folderCategories</span>       | `ObservableSet<string>`                                                                                                                                                          |
| <span id="volatile-filtertext">filterText</span>                   | `string`                                                                                                                                                                         |
| <span id="volatile-recentlyusedcounter">recentlyUsedCounter</span> | `number`                                                                                                                                                                         |
| <span id="volatile-favoritescounter">favoritesCounter</span>       | `number`                                                                                                                                                                         |

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Getters</summary>

#### getter: configAndSessionTrackConfigurations

filter out tracks that don't match the current assembly/display types

```ts
type configAndSessionTrackConfigurations = (ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: allTrackConfigurationMap

unfiltered map of every track (incl. connection tracks for other assemblies/view
types); used by the faceted selector

```ts
type allTrackConfigurationMap = Map<any, ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

#### getter: displayableTrackConfigurationMap

map restricted to tracks the current view can display; connection tracks go
through the same filterTracks() pass as the tree so favorites and recently-used
don't surface tracks the view can't show

```ts
type displayableTrackConfigurationMap = Map<any, ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

#### getter: favoriteTracks

filters out tracks that are not in the favorites group

```ts
type favoriteTracks = (ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: recentlyUsedTracks

filters out tracks that are not in the recently used group

```ts
type recentlyUsedTracks = (ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Getters (other undocumented members)</summary>

| Member                                                                 | Type                                                                                                                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="getter-showntrackids">shownTrackIds</span>                   | `Set<string>`                                                                                                                                                                     |
| <span id="getter-selectionset">selectionSet</span>                     | `Set<ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>` |
| <span id="getter-favoritesset">favoritesSet</span>                     | `Set<string>`                                                                                                                                                                     |
| <span id="getter-recentlyusedset">recentlyUsedSet</span>               | `Set<string>`                                                                                                                                                                     |
| <span id="getter-assemblynames">assemblyNames</span>                   | `string[]`                                                                                                                                                                        |
| <span id="getter-activesorttracknames">activeSortTrackNames</span>     | `any`                                                                                                                                                                             |
| <span id="getter-activesortcategories">activeSortCategories</span>     | `any`                                                                                                                                                                             |
| <span id="getter-alltrackconfigurations">allTrackConfigurations</span> | `(ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]`  |
| <span id="getter-alltracks">allTracks</span>                           | `{ group: string; id: string; tracks: (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>)[]; noCategories: boolean; defaultCollapsed: boolean; loading: boolean; }[]`           |
| <span id="getter-hierarchy">hierarchy</span>                           | `{ name: string; id: string; type: "category"; children: {…}[]; }`                                                                                                                |
| <span id="getter-flatteneditems">flattenedItems</span>                 | `TreeNode[]`                                                                                                                                                                      |
| <span id="getter-flatteneditemoffsets">flattenedItemOffsets</span>     | `{ cumulativeHeight: number; offsets: number[]; }`                                                                                                                                |
| <span id="getter-foldercategorystats">folderCategoryStats</span>       | `Map<string, { active: number; total: number; }>`                                                                                                                                 |
| <span id="getter-hasanysubcategories">hasAnySubcategories</span>       | `boolean`                                                                                                                                                                         |

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Methods</summary>

| Member                                                         | Type                                                                                                                                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-isselected">isSelected</span>                 | `(track: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => boolean` |
| <span id="method-isfavorite">isFavorite</span>                 | `(trackId: string) => boolean`                                                                                                                                                     |
| <span id="method-isrecentlyused">isRecentlyUsed</span>         | `(trackId: string) => boolean`                                                                                                                                                     |
| <span id="method-getrefseqtrackconf">getRefSeqTrackConf</span> | `(assemblyName: string) => (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) \| undefined`                                                                                     |
| <span id="method-itemoffsets">itemOffsets</span>               | `(height: number, scrollTop: number) => { startIndex: number; endIndex: number; }`                                                                                                 |

</details>

<details>
<summary>HierarchicalTrackSelectorWidget - Actions</summary>

| Member                                                                         | Type                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-setsorttracknames">setSortTrackNames</span>                   | `(val: boolean) => void`                                                                                                                                                          |
| <span id="action-setsortcategories">setSortCategories</span>                   | `(val: boolean) => void`                                                                                                                                                          |
| <span id="action-setselection">setSelection</span>                             | `(elt: (ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]) => void` |
| <span id="action-addtoselection">addToSelection</span>                         | `(elt: (ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]) => void` |
| <span id="action-removefromselection">removeFromSelection</span>               | `(elt: (ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]) => void` |
| <span id="action-clearselection">clearSelection</span>                         | `() => void`                                                                                                                                                                      |
| <span id="action-addtofavorites">addToFavorites</span>                         | `(trackId: string) => void`                                                                                                                                                       |
| <span id="action-removefromfavorites">removeFromFavorites</span>               | `(trackId: string) => void`                                                                                                                                                       |
| <span id="action-clearfavorites">clearFavorites</span>                         | `() => void`                                                                                                                                                                      |
| <span id="action-setrecentlyusedcounter">setRecentlyUsedCounter</span>         | `(val: number) => void`                                                                                                                                                           |
| <span id="action-setrecentlyused">setRecentlyUsed</span>                       | `(str: string[]) => void`                                                                                                                                                         |
| <span id="action-setfavoritescounter">setFavoritesCounter</span>               | `(val: number) => void`                                                                                                                                                           |
| <span id="action-addtorecentlyused">addToRecentlyUsed</span>                   | `(id: string) => void`                                                                                                                                                            |
| <span id="action-clearrecentlyused">clearRecentlyUsed</span>                   | `() => void`                                                                                                                                                                      |
| <span id="action-setview">setView</span>                                       | `(view: unknown) => void`                                                                                                                                                         |
| <span id="action-togglecategory">toggleCategory</span>                         | `(pathName: string) => void`                                                                                                                                                      |
| <span id="action-setcategorycollapsed">setCategoryCollapsed</span>             | `(pathName: string, status: boolean) => void`                                                                                                                                     |
| <span id="action-expandallcategories">expandAllCategories</span>               | `() => void`                                                                                                                                                                      |
| <span id="action-setcollapsedcategories">setCollapsedCategories</span>         | `(str: [string, boolean][]) => void`                                                                                                                                              |
| <span id="action-togglefoldercategory">toggleFolderCategory</span>             | `(categoryId: string) => void`                                                                                                                                                    |
| <span id="action-setfoldercategories">setFolderCategories</span>               | `(ids: string[]) => void`                                                                                                                                                         |
| <span id="action-clearfiltertext">clearFilterText</span>                       | `() => void`                                                                                                                                                                      |
| <span id="action-setfiltertext">setFilterText</span>                           | `(newText: string) => void`                                                                                                                                                       |
| <span id="action-collapsesubcategories">collapseSubCategories</span>           | `() => void`                                                                                                                                                                      |
| <span id="action-collapsetoplevelcategories">collapseTopLevelCategories</span> | `() => void`                                                                                                                                                                      |

</details>
