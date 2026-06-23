---
id: linearcomparativeview
title: LinearComparativeView
sidebar_label: View -> LinearComparativeView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearComparativeView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearComparativeView.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** [id](../baseviewmodel#property-id),
[displayName](../baseviewmodel#property-displayname),
[minimized](../baseviewmodel#property-minimized)

**Volatiles:** [width](../baseviewmodel#volatile-width)

**Getters:** [menuItems](../baseviewmodel#getter-menuitems)

**Actions:** [setDisplayName](../baseviewmodel#action-setdisplayname),
[setWidth](../baseviewmodel#action-setwidth),
[setMinimized](../baseviewmodel#action-setminimized)

<details open>
<summary>LinearComparativeView - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

Abstract base: never registered or instantiated standalone, always composed into
a concrete subclass (e.g. LinearSyntenyView) that overrides `type` with its own
literal. Kept as `types.string` rather than a literal so subclass models stay
assignable to this base type.

```ts
// type signature
type type = ISimpleType<string>
// code
type: types.string
```

#### property: trackSelectorType

```ts
// type signature
type trackSelectorType = IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.stripDefault(types.string, 'hierarchical')
```

#### property: showIntraviewLinks

```ts
// type signature
type showIntraviewLinks = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showIntraviewLinks: types.stripDefault(types.boolean, true)
```

#### property: linkViews

```ts
// type signature
type linkViews = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
linkViews: types.stripDefault(types.boolean, false)
```

#### property: interactiveOverlay

```ts
// type signature
type interactiveOverlay = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
interactiveOverlay: types.stripDefault(types.boolean, false)
```

#### property: levels

```ts
// type signature
type levels = IArrayType<IAnyModelType>
// code
levels: types.array(LinearSyntenyViewHelper)
```

#### property: views

currently this is limited to an array of two

```ts
// type signature
type views = IArrayType<IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; } & ... 17 more ... & { ...; }, _NotCustomized, { ...; }>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```ts
// type signature
type viewTrackConfigs = IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
viewTrackConfigs: types.stripDefault(
  types.array(pluginManager.pluggableConfigSchemaType('track')),
  [],
)
```

</details>

<details open>
<summary>LinearComparativeView - Volatiles</summary>

#### volatile: width

```ts
// type signature
type width = number | undefined
// code
width: undefined as number | undefined
```

</details>

<details open>
<summary>LinearComparativeView - Getters</summary>

#### getter: scrollZoom

scroll-to-zoom is a global, personal preference resolved from the session;
toggling it in any view applies everywhere

```ts
type scrollZoom = boolean
```

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: refNames

```ts
type refNames = (string | undefined)[][]
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

</details>

<details open>
<summary>LinearComparativeView - Methods</summary>

#### method: isViewCompact

```ts
type isViewCompact = (idx: number) => boolean
```

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming. overridden by subclasses

```ts
type headerMenuItems = () => MenuItem[]
```

#### method: showMenuItems

items for the "Show..." submenu in the header. overridden by subclasses to add
view-specific toggle options

```ts
type showMenuItems = () => MenuItem[]
```

#### method: menuItems

```ts
type menuItems = () => MenuItem[]
```

#### method: rubberBandMenuItems

```ts
type rubberBandMenuItems = () => { label: string; onClick: () => void }[]
```

</details>

<details open>
<summary>LinearComparativeView - Actions</summary>

#### action: reconcileLevels

Reconcile the levels array to the views array: exactly one synteny level per gap
between adjacent views (N views -> N-1 levels). Grows or shrinks from the end,
preserving existing levels and their tracks. The single source of truth for the
views/levels invariant.

```ts
type reconcileLevels = () => void
```

#### action: setWidth

```ts
type setWidth = (newWidth: number) => void
```

#### action: setViews

```ts
type setViews = (views: ModelCreationType<ExtractCFromProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<...>, [...]>; }, { ...; }>>>[]) => void
```

#### action: removeView

```ts
type removeView = (view: ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<...>, [...]>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>) => void
```

#### action: addView

Push a new genome row. The new trailing level starts with no synteny tracks.

```ts
type addView = (view: ModelCreationType<ExtractCFromProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<...>, [...]>; }, { ...; }>>>) => void
```

#### action: removeLastRow

Drop the bottom genome row and its synteny level. Only terminal removal is
supported: a level's `level` index addresses views[level]/[level+1], so removing
a middle row would require reindexing every level below it. Growth and shrinkage
both happen at the end of the chain.

```ts
type removeLastRow = () => void
```

#### action: setLinkViews

```ts
type setLinkViews = (arg: boolean) => void
```

#### action: setScrollZoom

```ts
type setScrollZoom = (arg: boolean) => void
```

#### action: activateTrackSelector

```ts
type activateTrackSelector = (level: number) => Widget
```

#### action: toggleTrack

```ts
type toggleTrack = (trackId: string, level?: any) => void
```

#### action: showTrack

```ts
type showTrack = (trackId: string, level?: any, initialSnapshot?: any) => void
```

#### action: hideTrack

```ts
type hideTrack = (trackId: string, level?: any) => void
```

#### action: squareView

```ts
type squareView = () => void
```

#### action: clearView

```ts
type clearView = () => void
```

#### action: toggleCompactView

```ts
type toggleCompactView = (idx: number) => void
```

#### action: compactAllViews

```ts
type compactAllViews = () => void
```

#### action: expandAllViews

```ts
type expandAllViews = () => void
```

#### action: autoScaleLevelHeights

```ts
type autoScaleLevelHeights = () => void
```

#### action: appendRow

Append an assembly to the bottom of the stack and optionally show a synteny
track on the new level connecting it to the previous bottom row. A synteny
dataset is an edge between two adjacent assemblies, so rows are only ever added
at the chain's end.

The new row is created with a LinearGenomeView `init` — its own afterAttach
autorun loads the assembly regions and navigates (whole genome, or `loc` when
given), so we don't reimplement that imperatively here.

```ts
type appendRow = ({
  assembly,
  loc,
  syntenyTrackId,
}: {
  assembly: string
  loc?: string | undefined
  syntenyTrackId?: string | undefined
}) => void
```

</details>
