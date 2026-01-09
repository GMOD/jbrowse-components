---
id: gridbookmarkwidgetmodel
title: GridBookmarkWidgetModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/grid-bookmark/src/GridBookmarkWidget/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/GridBookmarkWidgetModel.md)

## Docs

### GridBookmarkWidgetModel - Properties

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
ISimpleType<"GridBookmarkWidget">
// code
type: types.literal('GridBookmarkWidget')
```

#### property: bookmarks

removed by postProcessSnapshot, only loaded from localStorage

```js
// type signature
IOptionalIType<IArrayType<IModelType<ModelProperties & { label: IOptionalIType<ISimpleType<string>, [undefined]>; highlight: IOptionalIType<ISimpleType<string>, [...]>; }, { ...; }, _NotCustomized, _NotCustomized>>, [...]>
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
any
```

#### getter: areBookmarksHighlightLabelsOnAllOpenViews

```js
// type
any
```

#### getter: bookmarksWithValidAssemblies

```js
// type
({ [x: string]: any; label: string; highlight: string; } & NonEmptyObject & { setLabel(label: string): void; setHighlight(color: string): void; } & IStateTreeNode<IModelType<ModelProperties & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>)[]
```

#### getter: sharedBookmarksModel

```js
// type
{ sharedBookmarks: IMSTArray<IModelType<ModelProperties & { label: IOptionalIType<ISimpleType<string>, [undefined]>; highlight: IOptionalIType<ISimpleType<string>, [...]>; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; } & NonEmptyObject & IStateTreeNode<...>
```

#### getter: allBookmarksModel

```js
// type
{ sharedBookmarks: IMSTArray<IModelType<ModelProperties & { label: IOptionalIType<ISimpleType<string>, [undefined]>; highlight: IOptionalIType<ISimpleType<string>, [...]>; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; } & NonEmptyObject & IStateTreeNode<...>
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
setBookmarkedRegions: (regions: IMSTArray<IModelType<ModelProperties & { label: IOptionalIType<ISimpleType<string>, [undefined]>; highlight: IOptionalIType<ISimpleType<string>, [...]>; }, { ...; }, _NotCustomized, _NotCustomized>>) => void
```

#### action: setBookmarkHighlightsVisible

```js
// type signature
setBookmarkHighlightsVisible: (arg: boolean) => void
```

#### action: setBookmarkLabelsVisible

```js
// type signature
setBookmarkLabelsVisible: (arg: boolean) => void
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
