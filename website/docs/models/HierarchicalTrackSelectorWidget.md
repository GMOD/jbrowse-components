---
id: hierarchicaltrackselectorwidget
title: HierarchicalTrackSelectorWidget
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts)

### HierarchicalTrackSelectorWidget - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
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
IMaybe<IReferenceType<IAnyType>>
// code
view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      )
```

#### property: faceted

```js
// type signature
IOptionalIType<IModelType<{ filterText: IOptionalIType<ISimpleType<string>, [undefined]>; showSparse: IOptionalIType<ISimpleType<boolean>, [undefined]>; showFilters: IOptionalIType<...>; showOptions: IOptionalIType<...>; panelWidth: IOptionalIType<...>; }, { ...; } & ... 4 more ... & { ...; }, _NotCustomized, _NotCu...
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
Set<{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>>
```

#### getter: favoritesSet

```js
// type
Set<string>
```

#### getter: recentlyUsedSet

```js
// type
Set<string>
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
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)[]
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
{ group: any; tracks: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ ...; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)[]; noCategories: boolean; menuItems: any[]; }[]
```

#### getter: hierarchy

```js
// type
{ name: string; id: string; isOpenByDefault: boolean; type: "category"; children: { name: any; id: any; type: "category"; isOpenByDefault: boolean; menuItems: any[]; children: TreeNode[]; }[]; }
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
isSelected: (track: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => boolean
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
getRefSeqTrackConf: (assemblyName: string) => { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ ...; } & ... 2 more ... & IStateTreeNode<...>); } & IStateTreeNode<...>
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
setSelection: (elt: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)[]) => void
```

#### action: addToSelection

```js
// type signature
addToSelection: (elt: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)[]) => void
```

#### action: removeFromSelection

```js
// type signature
removeFromSelection: (elt: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)[]) => void
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
addToRecentlyUsed: (id: string) => void
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
