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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                             | Signature                                          |
| ---------------------------------- | -------------------------------------------------- |
| [`label`](#property-label)         | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| [`highlight`](#property-highlight) | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| [`id`](#property-id)               | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| [`type`](#property-type)           | `ISimpleType<"GridBookmarkWidget">`                |

</details>

<details>
<summary>GridBookmarkWidgetModel - Properties (all signatures)</summary>

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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                       |
| -------------------------------------------------- | ------------------------------- |
| [`selectedBookmarks`](#volatile-selectedbookmarks) | `IExtendedLabeledRegionModel[]` |

</details>

<details>
<summary>GridBookmarkWidgetModel - Volatiles (all signatures)</summary>

#### volatile: selectedBookmarks

```ts
// type signature
type selectedBookmarks = IExtendedLabeledRegionModel[]
// code
selectedBookmarks: [] as IExtendedLabeledRegionModel[]
```

</details>

<details open>
<summary>GridBookmarkWidgetModel - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                                           | Signature                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`bookmarkAssemblies`](#getter-bookmarkassemblies)                                               | `string[]`                                                                                                                                                                                                                                                                   |
| [`validAssemblies`](#getter-validassemblies)                                                     | `Set<string>`                                                                                                                                                                                                                                                                |
| [`areBookmarksHighlightedOnAllOpenViews`](#getter-arebookmarkshighlightedonallopenviews)         | `boolean`                                                                                                                                                                                                                                                                    |
| [`areBookmarksHighlightLabelsOnAllOpenViews`](#getter-arebookmarkshighlightlabelsonallopenviews) | `boolean`                                                                                                                                                                                                                                                                    |
| [`bookmarksWithValidAssemblies`](#getter-bookmarkswithvalidassemblies)                           | `(ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & { ...; } & { ...; } & IStateTreeNode<...>)[]` |
| [`selectedAssemblies`](#getter-selectedassemblies)                                               | `string[]`                                                                                                                                                                                                                                                                   |

</details>

<details>
<summary>GridBookmarkWidgetModel - Getters (all signatures)</summary>

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

<details open>
<summary>GridBookmarkWidgetModel - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                           | Signature                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`setLabel`](#action-setlabel)                                                   | `(label: string) => void`                                                                                                                                                                                                                                                                           |
| [`setHighlight`](#action-sethighlight)                                           | `(color: string) => void`                                                                                                                                                                                                                                                                           |
| [`setSelectedAssemblies`](#action-setselectedassemblies)                         | `(assemblies?: string[] \| undefined) => void`                                                                                                                                                                                                                                                      |
| [`setGridView`](#action-setgridview)                                             | `(arg: "bookmarks" \| "highlights") => void`                                                                                                                                                                                                                                                        |
| [`importBookmarks`](#action-importbookmarks)                                     | `(regions: Region[]) => void`                                                                                                                                                                                                                                                                       |
| [`addBookmark`](#action-addbookmark)                                             | `(region: Region) => void`                                                                                                                                                                                                                                                                          |
| [`updateBookmarkLabel`](#action-updatebookmarklabel)                             | `(bookmark: IExtendedLabeledRegionModel, label: string) => void`                                                                                                                                                                                                                                    |
| [`updateBookmarkHighlight`](#action-updatebookmarkhighlight)                     | `(bookmark: IExtendedLabeledRegionModel, color: string) => void`                                                                                                                                                                                                                                    |
| [`updateBulkBookmarkHighlights`](#action-updatebulkbookmarkhighlights)           | `(color: string) => void`                                                                                                                                                                                                                                                                           |
| [`setSelectedBookmarks`](#action-setselectedbookmarks)                           | `(bookmarks: IExtendedLabeledRegionModel[]) => void`                                                                                                                                                                                                                                                |
| [`setBookmarkedRegions`](#action-setbookmarkedregions)                           | `(regions: IMSTArray<IModelType<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>) => void` |
| [`setBookmarkHighlightsVisible`](#action-setbookmarkhighlightsvisible)           | `(arg: boolean) => void`                                                                                                                                                                                                                                                                            |
| [`setBookmarkLabelsVisible`](#action-setbookmarklabelsvisible)                   | `(arg: boolean) => void`                                                                                                                                                                                                                                                                            |
| [`clearBookmarksForLoadedAssemblies`](#action-clearbookmarksforloadedassemblies) | `() => void`                                                                                                                                                                                                                                                                                        |
| [`clearSelectedBookmarks`](#action-clearselectedbookmarks)                       | `() => void`                                                                                                                                                                                                                                                                                        |
| [`removeBookmarkObject`](#action-removebookmarkobject)                           | `(arg: ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & { ...; } & { ...; } & IStateTreeNode<...>) => void`             |

</details>

<details>
<summary>GridBookmarkWidgetModel - Actions (all signatures)</summary>

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
