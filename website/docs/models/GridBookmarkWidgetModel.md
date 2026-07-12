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

## Members

| Member                                                                         | Kind       | Description                                                                                                                   |
| ------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [label](#property-label)                                                       | Properties |                                                                                                                               |
| [highlight](#property-highlight)                                               | Properties |                                                                                                                               |
| [id](#property-id)                                                             | Properties |                                                                                                                               |
| [type](#property-type)                                                         | Properties |                                                                                                                               |
| [bookmarks](#property-bookmarks)                                               | Properties | loaded from localStorage when not present in snapshot; sharedBookmarks from a shared URL are merged in via preProcessSnapshot |
| [selectedBookmarks](#volatile-selectedbookmarks)                               | Volatiles  |                                                                                                                               |
| [gridView](#volatile-gridview)                                                 | Volatiles  | which grid tab is visible: bookmarks or highlights                                                                            |
| [bookmarkAssemblies](#getter-bookmarkassemblies)                               | Getters    |                                                                                                                               |
| [validAssemblies](#getter-validassemblies)                                     | Getters    |                                                                                                                               |
| [assembliesInViews](#getter-assembliesinviews)                                 | Getters    | assemblies currently displayed in any open view; the grids only show bookmarks/highlights belonging to these                  |
| [visibleBookmarks](#getter-visiblebookmarks)                                   | Getters    | bookmarks belonging to an assembly currently open in a view                                                                   |
| [setLabel](#action-setlabel)                                                   | Actions    |                                                                                                                               |
| [setHighlight](#action-sethighlight)                                           | Actions    |                                                                                                                               |
| [setGridView](#action-setgridview)                                             | Actions    |                                                                                                                               |
| [importBookmarks](#action-importbookmarks)                                     | Actions    |                                                                                                                               |
| [addBookmark](#action-addbookmark)                                             | Actions    |                                                                                                                               |
| [updateBookmarkLabel](#action-updatebookmarklabel)                             | Actions    |                                                                                                                               |
| [updateBookmarkHighlight](#action-updatebookmarkhighlight)                     | Actions    |                                                                                                                               |
| [updateBulkBookmarkHighlights](#action-updatebulkbookmarkhighlights)           | Actions    |                                                                                                                               |
| [setSelectedBookmarks](#action-setselectedbookmarks)                           | Actions    |                                                                                                                               |
| [setBookmarkedRegions](#action-setbookmarkedregions)                           | Actions    |                                                                                                                               |
| [clearBookmarksForLoadedAssemblies](#action-clearbookmarksforloadedassemblies) | Actions    |                                                                                                                               |
| [clearSelectedBookmarks](#action-clearselectedbookmarks)                       | Actions    |                                                                                                                               |
| [removeBookmarkObject](#action-removebookmarkobject)                           | Actions    |                                                                                                                               |

<details>
<summary>GridBookmarkWidgetModel - Properties</summary>

#### property: bookmarks

loaded from localStorage when not present in snapshot; sharedBookmarks from a
shared URL are merged in via preProcessSnapshot

```ts
// type signature
type bookmarks = IOptionalIType<IArrayType<IModelType<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>, [...]>
// code
bookmarks: types.optional(types.array(LabeledRegionModel), () =>
        localStorageGetJSON(localStorageKeyF(), []),
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

<details>
<summary>GridBookmarkWidgetModel - Volatiles</summary>

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

#### getter: assembliesInViews

assemblies currently displayed in any open view; the grids only show
bookmarks/highlights belonging to these

```ts
type assembliesInViews = Set<string>
```

#### getter: visibleBookmarks

bookmarks belonging to an assembly currently open in a view

```ts
type visibleBookmarks = (ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & { ...; } & { ...; } & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>GridBookmarkWidgetModel - Getters (other undocumented members)</summary>

#### getter: bookmarkAssemblies

```ts
type bookmarkAssemblies = string[]
```

#### getter: validAssemblies

```ts
type validAssemblies = Set<string>
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

#### action: setGridView

```ts
type setGridView = (arg: 'bookmarks' | 'highlights' | 'both') => void
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
type setBookmarkedRegions = (regions: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>>>[]) => void
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
