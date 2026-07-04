---
id: gridbookmarkwidgetmodel
title: GridBookmarkWidgetModel
sidebar_label: Widget -> GridBookmarkWidgetModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`grid-bookmark` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/grid-bookmark/src/GridBookmarkWidget/model.ts).

## Overview

<details open>
<summary>GridBookmarkWidgetModel - Properties</summary>

#### property: bookmarks

loaded from localStorage when not present in snapshot; sharedBookmarks from a
shared URL are merged in via preProcessSnapshot

```ts
// type signature
type bookmarks = IOptionalIType<IArrayType<IModelType<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>, [...]>
// code
bookmarks: types.optional(types.array(LabeledRegionModel), () =>
        JSON.parse(localStorageGetItem(localStorageKeyF()) || '[]'),
      )
```

</details>

<details>
<summary>GridBookmarkWidgetModel - Properties (other undocumented members)</summary>

#### property: label

```ts
// type signature
type label = IOptionalIType<ISimpleType<string>, [undefined]>
// code
label: types.optional(types.string, '')
```

#### property: highlight

```ts
// type signature
type highlight = IOptionalIType<ISimpleType<string>, [undefined]>
// code
highlight: types.optional(types.string, DEFAULT_HIGHLIGHT)
```

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
type type = ISimpleType<'GridBookmarkWidget'>
// code
type: types.literal('GridBookmarkWidget')
```

</details>

<details open>
<summary>GridBookmarkWidgetModel - Volatiles</summary>

#### volatile: selectedAssembliesPre

undefined = "all valid assemblies"; an array = explicit filter

```ts
// type signature
type selectedAssembliesPre = string[] | undefined
// code
selectedAssembliesPre: undefined as string[] | undefined
```

#### volatile: gridView

which grid tab is visible: bookmarks or highlights

```ts
// type signature
type gridView = string
// code
gridView: 'bookmarks'
```

</details>

<details>
<summary>GridBookmarkWidgetModel - Volatiles (other undocumented members)</summary>

#### volatile: selectedBookmarks

```ts
// type signature
type selectedBookmarks = IExtendedLabeledRegionModel[]
// code
selectedBookmarks: [] as IExtendedLabeledRegionModel[]
```

</details>

<details>
<summary>GridBookmarkWidgetModel - Getters</summary>

#### getter: bookmarkAssemblies

```ts
type bookmarkAssemblies = string[]
```

#### getter: validAssemblies

```ts
type validAssemblies = Set<string>
```

#### getter: areBookmarksHighlightedOnAllOpenViews

```ts
type areBookmarksHighlightedOnAllOpenViews = boolean
```

#### getter: areBookmarksHighlightLabelsOnAllOpenViews

```ts
type areBookmarksHighlightLabelsOnAllOpenViews = boolean
```

#### getter: bookmarksWithValidAssemblies

```ts
type bookmarksWithValidAssemblies = (ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & { ...; } & { ...; } & IStateTreeNode<...>)[]
```

#### getter: selectedAssemblies

```ts
type selectedAssemblies = string[]
```

</details>

<details>
<summary>GridBookmarkWidgetModel - Actions</summary>

#### action: setLabel

```ts
type setLabel = (label: string) => void
```

#### action: setHighlight

```ts
type setHighlight = (color: string) => void
```

#### action: setSelectedAssemblies

```ts
type setSelectedAssemblies = (assemblies?: string[] | undefined) => void
```

#### action: setGridView

```ts
type setGridView = (arg: 'bookmarks' | 'highlights') => void
```

#### action: importBookmarks

```ts
type importBookmarks = (regions: Region[]) => void
```

#### action: addBookmark

```ts
type addBookmark = (region: Region) => void
```

#### action: updateBookmarkLabel

```ts
type updateBookmarkLabel = (
  bookmark: IExtendedLabeledRegionModel,
  label: string,
) => void
```

#### action: updateBookmarkHighlight

```ts
type updateBookmarkHighlight = (
  bookmark: IExtendedLabeledRegionModel,
  color: string,
) => void
```

#### action: updateBulkBookmarkHighlights

```ts
type updateBulkBookmarkHighlights = (color: string) => void
```

#### action: setSelectedBookmarks

```ts
type setSelectedBookmarks = (bookmarks: IExtendedLabeledRegionModel[]) => void
```

#### action: setBookmarkedRegions

```ts
type setBookmarkedRegions = (regions: IMSTArray<IModelType<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>) => void
```

#### action: setBookmarkHighlightsVisible

```ts
type setBookmarkHighlightsVisible = (arg: boolean) => void
```

#### action: setBookmarkLabelsVisible

```ts
type setBookmarkLabelsVisible = (arg: boolean) => void
```

#### action: clearBookmarksForLoadedAssemblies

```ts
type clearBookmarksForLoadedAssemblies = () => void
```

#### action: clearSelectedBookmarks

```ts
type clearSelectedBookmarks = () => void
```

#### action: removeBookmarkObject

```ts
type removeBookmarkObject = (arg: ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & { ...; } & { ...; } & IStateTreeNode<...>) => void
```

</details>
