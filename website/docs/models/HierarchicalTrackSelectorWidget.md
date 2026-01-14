---
id: hierarchicaltrackselectorwidget
title: HierarchicalTrackSelectorWidget
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

## Docs

### HierarchicalTrackSelectorWidget - Properties

#### property: id

```js
// type signature
any
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<"HierarchicalTrackSelectorWidget">
// code
type: types.literal('HierarchicalTrackSelectorWidget')
```

#### property: view

```js
// type signature
IMaybe<IReferenceType<any>>
// code
view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      )
```

#### property: faceted

```js
// type signature
IOptionalIType<IModelType<{ filterText: IOptionalIType<ISimpleType<string>, [undefined]>; showSparse: IOptionalIType<ISimpleType<boolean>, [undefined]>; showFilters: IOptionalIType<...>; showOptions: IOptionalIType<...>; panelWidth: IOptionalIType<...>; }, { ...; } & ... 4 more ... & { ...; }, _NotCustomized, ModelS...
// code
faceted: types.optional(facetedStateTreeF(), {})
```

### HierarchicalTrackSelectorWidget - Getters

#### getter: shownTrackIds

```js
// type
Set<string>
```

#### getter: selectionSet

```js
// type
Set<AnyConfigurationModel>
```

#### getter: favoritesSet

```js
// type
Set<string>
```

#### getter: recentlyUsedSet

```js
// type
Set<GridRowId>
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: activeSortTrackNames

```js
// type
any
```

#### getter: activeSortCategories

```js
// type
any
```

#### getter: configAndSessionTrackConfigurations

filter out tracks that don't match the current assembly/display types

```js
// type
any[]
```

#### getter: allTrackConfigurations

```js
// type
any[]
```

#### getter: allTrackConfigurationTrackIdSet

```js
// type
Map<unknown, unknown>
```

#### getter: favoriteTracks

filters out tracks that are not in the favorites group

```js
// type
unknown[]
```

#### getter: recentlyUsedTracks

filters out tracks that are not in the recently used group

```js
// type
unknown[]
```

#### getter: allTracks

```js
// type
any[]
```

#### getter: hierarchy

```js
// type
{ name: string; id: string; type: "category"; children: { name: any; id: any; type: "category"; menuItems: any; nestingLevel: number; children: TreeNode[]; }[]; }
```

#### getter: hasAnySubcategories

```js
// type
boolean
```

### HierarchicalTrackSelectorWidget - Methods

#### method: isSelected

```js
// type signature
isSelected: (track: AnyConfigurationModel) => boolean
```

#### method: isFavorite

```js
// type signature
isFavorite: (trackId: string) => boolean
```

#### method: isRecentlyUsed

```js
// type signature
isRecentlyUsed: (trackId: string) => boolean
```

#### method: getRefSeqTrackConf

```js
// type signature
getRefSeqTrackConf: (assemblyName: string) => any
```

### HierarchicalTrackSelectorWidget - Actions

#### action: setSortTrackNames

```js
// type signature
setSortTrackNames: (val: boolean) => void
```

#### action: setSortCategories

```js
// type signature
setSortCategories: (val: boolean) => void
```

#### action: setSelection

```js
// type signature
setSelection: (elt: AnyConfigurationModel[]) => void
```

#### action: addToSelection

```js
// type signature
addToSelection: (elt: AnyConfigurationModel[]) => void
```

#### action: removeFromSelection

```js
// type signature
removeFromSelection: (elt: AnyConfigurationModel[]) => void
```

#### action: clearSelection

```js
// type signature
clearSelection: () => void
```

#### action: addToFavorites

```js
// type signature
addToFavorites: (trackId: string) => void
```

#### action: removeFromFavorites

```js
// type signature
removeFromFavorites: (trackId: string) => void
```

#### action: clearFavorites

```js
// type signature
clearFavorites: () => void
```

#### action: setRecentlyUsedCounter

```js
// type signature
setRecentlyUsedCounter: (val: number) => void
```

#### action: setRecentlyUsed

```js
// type signature
setRecentlyUsed: (str: string[]) => void
```

#### action: setFavorites

```js
// type signature
setFavorites: (str: string[]) => void
```

#### action: setFavoritesCounter

```js
// type signature
setFavoritesCounter: (val: number) => void
```

#### action: addToRecentlyUsed

```js
// type signature
addToRecentlyUsed: (id: GridRowId) => void
```

#### action: clearRecentlyUsed

```js
// type signature
clearRecentlyUsed: () => void
```

#### action: setView

```js
// type signature
setView: (view: unknown) => void
```

#### action: toggleCategory

```js
// type signature
toggleCategory: (pathName: string) => void
```

#### action: setCategoryCollapsed

```js
// type signature
setCategoryCollapsed: (pathName: string, status: boolean) => void
```

#### action: expandAllCategories

```js
// type signature
expandAllCategories: () => void
```

#### action: setCollapsedCategories

```js
// type signature
setCollapsedCategories: (str: [string, boolean][]) => void
```

#### action: clearFilterText

```js
// type signature
clearFilterText: () => void
```

#### action: setFilterText

```js
// type signature
setFilterText: (newText: string) => void
```

#### action: collapseSubCategories

```js
// type signature
collapseSubCategories: () => void
```

#### action: collapseTopLevelCategories

```js
// type signature
collapseTopLevelCategories: () => void
```
