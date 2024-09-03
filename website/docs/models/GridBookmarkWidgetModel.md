---
id: gridbookmarkwidgetmodel
title: GridBookmarkWidgetModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/grid-bookmark/src/GridBookmarkWidget/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/grid-bookmark/src/GridBookmarkWidget/model.ts)

### GridBookmarkWidgetModel - Properties

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
ISimpleType<"GridBookmarkWidget">
// code
type: types.literal('GridBookmarkWidget')
```

#### property: bookmarks

removed by postProcessSnapshot, only loaded from localStorage

```js
// type signature
IOptionalIType<IArrayType<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; } & { ...; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>, [...]>
// code
bookmarks: types.optional(types.array(LabeledRegionModel), () =>
        JSON.parse(localStorageGetItem(localStorageKeyF()) || '[]'),
      )
```

### GridBookmarkWidgetModel - Getters

#### getter: bookmarkAssemblies

```js
// type
any[]
```

#### getter: validAssemblies

```js
// type
Set<unknown>
```

#### getter: areBookmarksHighlightedOnAllOpenViews

```js
// type
boolean
```

#### getter: areBookmarksHighlightLabelsOnAllOpenViews

```js
// type
boolean
```

#### getter: bookmarksWithValidAssemblies

```js
// type
({ refName: string; start: number; end: number; reversed: boolean; assemblyName: string; label: string; highlight: string; } & NonEmptyObject & { setRefName(newRefName: string): void; } & { ...; } & IStateTreeNode<...>)[]
```

#### getter: sharedBookmarksModel

```js
// type
{ sharedBookmarks: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; } & { ...; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; } & NonEmptyObject & IStateTreeNod...
```

#### getter: allBookmarksModel

```js
// type
{ sharedBookmarks: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; } & { ...; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; } & NonEmptyObject & IStateTreeNod...
```

#### getter: selectedAssemblies

```js
// type
any[]
```

### GridBookmarkWidgetModel - Actions

#### action: setSelectedAssemblies

```js
// type signature
setSelectedAssemblies: (assemblies?: string[]) => void
```

#### action: importBookmarks

```js
// type signature
importBookmarks: (regions: Region[]) => void
```

#### action: addBookmark

```js
// type signature
addBookmark: (region: Region) => void
```

#### action: removeBookmark

```js
// type signature
removeBookmark: (index: number) => void
```

#### action: updateBookmarkLabel

```js
// type signature
updateBookmarkLabel: (bookmark: IExtendedLabeledRegionModel, label: string) => void
```

#### action: updateBookmarkHighlight

```js
// type signature
updateBookmarkHighlight: (bookmark: IExtendedLabeledRegionModel, color: string) => void
```

#### action: updateBulkBookmarkHighlights

```js
// type signature
updateBulkBookmarkHighlights: (color: string) => void
```

#### action: setSelectedBookmarks

```js
// type signature
setSelectedBookmarks: (bookmarks: IExtendedLabeledRegionModel[]) => void
```

#### action: setBookmarkedRegions

```js
// type signature
setBookmarkedRegions: (regions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; } & { ...; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>) => void
```

#### action: setHighlightToggle

```js
// type signature
setHighlightToggle: (toggle: boolean) => void
```

#### action: setLabelToggle

```js
// type signature
setLabelToggle: (toggle: boolean) => void
```

#### action: clearAllBookmarks

```js
// type signature
clearAllBookmarks: () => void
```

#### action: clearSelectedBookmarks

```js
// type signature
clearSelectedBookmarks: () => void
```
