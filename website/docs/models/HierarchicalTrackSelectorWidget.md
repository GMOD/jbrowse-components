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

#### property: collapsed

```js
// type signature
IMapType<ISimpleType<boolean>>
// code
collapsed: types.map(types.boolean)
```

#### property: faceted

```js
// type signature
IOptionalIType<IModelType<{ filterText: IOptionalIType<ISimpleType<string>, [undefined]>; panelWidth: IOptionalIType<ISimpleType<number>, [undefined]>; showFilters: IOptionalIType<...>; showOptions: IOptionalIType<...>; showSparse: IOptionalIType<...>; }, { ...; } & ... 4 more ... & { ...; }, _NotCustomized, _NotCus...
// code
faceted: types.optional(facetedStateTreeF(), {})
```

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: initialized

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
initialized: types.maybe(types.boolean)
```

#### property: sortCategories

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
sortCategories: types.maybe(types.boolean)
```

#### property: sortTrackNames

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
sortTrackNames: types.maybe(types.boolean)
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

### HierarchicalTrackSelectorWidget - Getters

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

#### getter: selectionSet

```js
// type
Set<{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>>
```

#### getter: shownTrackIds

```js
// type
Set<string>
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: activeSortCategories

```js
// type
any
```

#### getter: activeSortTrackNames

```js
// type
any
```

#### getter: allTrackConfigurationTrackIdSet

```js
// type
Map<unknown, unknown>
```

#### getter: allTrackConfigurations

```js
// type
any[]
```

#### getter: configAndSessionTrackConfigurations

filter out tracks that don't match the current assembly/display types

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

#### getter: favoritesLocalStorageKey

```js
// type
string
```

#### getter: recentlyUsedLocalStorageKey

```js
// type
string
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
{ group: any; menuItems: any[]; noCategories: boolean; tracks: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]; }[]
```

#### getter: hierarchy

```js
// type
{ children: { children: TreeNode[]; id: any; isOpenByDefault: boolean; menuItems: any[]; name: any; type: "category"; }[]; id: string; isOpenByDefault: boolean; name: string; type: "category"; }
```

#### getter: hasAnySubcategories

```js
// type
boolean
```

### HierarchicalTrackSelectorWidget - Methods

#### method: getRefSeqTrackConf

```js
// type signature
getRefSeqTrackConf: (assemblyName: string) => { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
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

#### method: isSelected

```js
// type signature
isSelected: (track: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => boolean
```

### HierarchicalTrackSelectorWidget - Actions

#### action: addToFavorites

```js
// type signature
addToFavorites: (trackId: string) => void
```

#### action: addToRecentlyUsed

```js
// type signature
addToRecentlyUsed: (id: string) => void
```

#### action: addToSelection

```js
// type signature
addToSelection: (elt: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]) => void
```

#### action: clearFavorites

```js
// type signature
clearFavorites: () => void
```

#### action: clearFilterText

```js
// type signature
clearFilterText: () => void
```

#### action: clearRecentlyUsed

```js
// type signature
clearRecentlyUsed: () => void
```

#### action: clearSelection

```js
// type signature
clearSelection: () => void
```

#### action: expandAllCategories

```js
// type signature
expandAllCategories: () => void
```

#### action: removeFromFavorites

```js
// type signature
removeFromFavorites: (trackId: string) => void
```

#### action: setSortCategories

```js
// type signature
setSortCategories: (val: boolean) => void
```

#### action: removeFromSelection

```js
// type signature
removeFromSelection: (elt: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]) => void
```

#### action: setSortTrackNames

```js
// type signature
setSortTrackNames: (val: boolean) => void
```

#### action: setCategoryCollapsed

```js
// type signature
setCategoryCollapsed: (pathName: string, status: boolean) => void
```

#### action: setSelection

```js
// type signature
setSelection: (elt: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]) => void
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

#### action: setFilterText

```js
// type signature
setFilterText: (newText: string) => void
```

#### action: setRecentlyUsed

```js
// type signature
setRecentlyUsed: (str: string[]) => void
```

#### action: setRecentlyUsedCounter

```js
// type signature
setRecentlyUsedCounter: (val: number) => void
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
