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

| Member                                                               | Kind       | Defined by              | Description                                                                                                                   |
| -------------------------------------------------------------------- | ---------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [label](#property-label)                                             | Properties | GridBookmarkWidgetModel |                                                                                                                               |
| [highlight](#property-highlight)                                     | Properties | GridBookmarkWidgetModel |                                                                                                                               |
| [id](#property-id)                                                   | Properties | GridBookmarkWidgetModel |                                                                                                                               |
| [type](#property-type)                                               | Properties | GridBookmarkWidgetModel |                                                                                                                               |
| [bookmarks](#property-bookmarks)                                     | Properties | GridBookmarkWidgetModel | loaded from localStorage when not present in snapshot; sharedBookmarks from a shared URL are merged in via preProcessSnapshot |
| [selectedBookmarks](#volatile-selectedbookmarks)                     | Volatiles  | GridBookmarkWidgetModel |                                                                                                                               |
| [gridView](#volatile-gridview)                                       | Volatiles  | GridBookmarkWidgetModel | which grid tab is visible: bookmarks or highlights                                                                            |
| [assembliesInViews](#getter-assembliesinviews)                       | Getters    | GridBookmarkWidgetModel | assemblies currently displayed in any open view; the grids only show bookmarks/highlights belonging to these                  |
| [visibleBookmarks](#getter-visiblebookmarks)                         | Getters    | GridBookmarkWidgetModel | bookmarks belonging to an assembly currently open in a view                                                                   |
| [setLabel](#action-setlabel)                                         | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [setHighlight](#action-sethighlight)                                 | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [setGridView](#action-setgridview)                                   | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [importBookmarks](#action-importbookmarks)                           | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [addBookmark](#action-addbookmark)                                   | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [updateBookmarkLabel](#action-updatebookmarklabel)                   | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [updateBookmarkHighlight](#action-updatebookmarkhighlight)           | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [updateBulkBookmarkHighlights](#action-updatebulkbookmarkhighlights) | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [setSelectedBookmarks](#action-setselectedbookmarks)                 | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [setBookmarkedRegions](#action-setbookmarkedregions)                 | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [clearSelectedBookmarks](#action-clearselectedbookmarks)             | Actions    | GridBookmarkWidgetModel |                                                                                                                               |
| [removeBookmarkObject](#action-removebookmarkobject)                 | Actions    | GridBookmarkWidgetModel |                                                                                                                               |

<details>
<summary>GridBookmarkWidgetModel - Properties</summary>

#### property: bookmarks

loaded from localStorage when not present in snapshot; sharedBookmarks from a
shared URL are merged in via preProcessSnapshot

```ts
// type signature
type bookmarks = IOptionalIType<IArrayType<IModelType<_OverrideProps<_OverrideProps<…>, { ...; }>, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>, [...]>
// code
bookmarks: types.optional(types.array(LabeledRegionModel), () =>
        localStorageGetJSON(localStorageKeyF(), []),
      )
```

</details>

<details>
<summary>GridBookmarkWidgetModel - Properties (other undocumented members)</summary>

| Member                                         | Type                                               |
| ---------------------------------------------- | -------------------------------------------------- |
| <span id="property-label">label</span>         | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-highlight">highlight</span> | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-id">id</span>               | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-type">type</span>           | `ISimpleType<"GridBookmarkWidget">`                |

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

| Member                                                         | Type                            |
| -------------------------------------------------------------- | ------------------------------- |
| <span id="volatile-selectedbookmarks">selectedBookmarks</span> | `IExtendedLabeledRegionModel[]` |

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
type visibleBookmarks = (ModelInstanceTypeProps<_OverrideProps<_OverrideProps<…>, { ...; }>> & { ...; } & { ...; } & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>GridBookmarkWidgetModel - Actions</summary>

| Member                                                                             | Type                                                                                                                             |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-setlabel">setLabel</span>                                         | `(label: string) => void`                                                                                                        |
| <span id="action-sethighlight">setHighlight</span>                                 | `(color: string) => void`                                                                                                        |
| <span id="action-setgridview">setGridView</span>                                   | `(arg: "bookmarks" \| "highlights" \| "both") => void`                                                                           |
| <span id="action-importbookmarks">importBookmarks</span>                           | `(regions: Region[]) => void`                                                                                                    |
| <span id="action-addbookmark">addBookmark</span>                                   | `(region: Region) => void`                                                                                                       |
| <span id="action-updatebookmarklabel">updateBookmarkLabel</span>                   | `(bookmark: IExtendedLabeledRegionModel, label: string) => void`                                                                 |
| <span id="action-updatebookmarkhighlight">updateBookmarkHighlight</span>           | `(bookmark: IExtendedLabeledRegionModel, color: string) => void`                                                                 |
| <span id="action-updatebulkbookmarkhighlights">updateBulkBookmarkHighlights</span> | `(color: string) => void`                                                                                                        |
| <span id="action-setselectedbookmarks">setSelectedBookmarks</span>                 | `(bookmarks: IExtendedLabeledRegionModel[]) => void`                                                                             |
| <span id="action-setbookmarkedregions">setBookmarkedRegions</span>                 | `(regions: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<…>, { ...; }>>>[]) => void`                         |
| <span id="action-clearselectedbookmarks">clearSelectedBookmarks</span>             | `() => void`                                                                                                                     |
| <span id="action-removebookmarkobject">removeBookmarkObject</span>                 | `(arg: ModelInstanceTypeProps<_OverrideProps<_OverrideProps<…>, { ...; }>> & { ...; } & { ...; } & IStateTreeNode<...>) => void` |

</details>
