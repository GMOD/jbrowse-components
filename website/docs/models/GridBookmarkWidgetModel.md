---
id: gridbookmarkwidgetmodel
title: GridBookmarkWidgetModel
sidebar_label: Widget -> GridBookmarkWidgetModel
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

## Overview

### GridBookmarkWidgetModel - Properties

#### property: label

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
label: types.optional(types.string, '')
```

#### property: highlight

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
highlight: types.optional(types.string, DEFAULT_HIGHLIGHT)
```

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

loaded from localStorage when not present in snapshot; sharedBookmarks from a
shared URL are merged in via preProcessSnapshot

```js
// type signature
IOptionalIType<IArrayType<IModelType<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>, [...]>
// code
bookmarks: types.optional(types.array(LabeledRegionModel), () =>
        JSON.parse(localStorageGetItem(localStorageKeyF()) || '[]'),
      )
```

### GridBookmarkWidgetModel - Volatiles

#### volatile: selectedBookmarks

```js
// type signature
IExtendedLabeledRegionModel[]
// code
selectedBookmarks: [] as IExtendedLabeledRegionModel[]
```

#### volatile: selectedAssembliesPre

undefined = "all valid assemblies"; an array = explicit filter

```js
// type signature
string[] | undefined
// code
selectedAssembliesPre: undefined as string[] | undefined
```

#### volatile: gridView

which grid tab is visible: bookmarks or highlights

```js
// type signature
string
// code
gridView: 'bookmarks'
```

### GridBookmarkWidgetModel - Getters

#### getter: bookmarkAssemblies

```js
// type
string[]
```

#### getter: validAssemblies

```js
// type
Set<string>
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
(ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & { ...; } & { ...; } & IStateTreeNode<...>)[]
```

#### getter: selectedAssemblies

```js
// type
string[]
```

### GridBookmarkWidgetModel - Actions

#### action: setLabel

```js
// type signature
setLabel: (label: string) => void
```

#### action: setHighlight

```js
// type signature
setHighlight: (color: string) => void
```

#### action: setSelectedAssemblies

```js
// type signature
setSelectedAssemblies: (assemblies?: string[] | undefined) => void
```

#### action: setGridView

```js
// type signature
setGridView: (arg: "bookmarks" | "highlights") => void
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
setBookmarkedRegions: (regions: IMSTArray<IModelType<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>) => void
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

#### action: clearBookmarksForLoadedAssemblies

```js
// type signature
clearBookmarksForLoadedAssemblies: () => void
```

#### action: clearSelectedBookmarks

```js
// type signature
clearSelectedBookmarks: () => void
```

#### action: removeBookmarkObject

```js
// type signature
removeBookmarkObject: (arg: ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & { ...; } & { ...; } & IStateTreeNode<...>) => void
```
