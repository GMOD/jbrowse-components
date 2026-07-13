---
id: linearcomparativeview
title: LinearComparativeView
sidebar_label: View -> LinearComparativeView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearComparativeView/model.ts).

## Overview

## Members

| Member                                                 | Kind       | Defined by                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ---------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                     | Properties | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [type](#property-type)                                 | Properties | LinearComparativeView             | Abstract base: never registered or instantiated standalone, always composed into a concrete subclass (e.g. LinearSyntenyView) that overrides `type` with its own literal. Kept as `types.string` rather than a literal so subclass models stay assignable to this base type.                                                                                                                                                                                                 |
| [trackSelectorType](#property-trackselectortype)       | Properties | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showIntraviewLinks](#property-showintraviewlinks)     | Properties | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [linkViews](#property-linkviews)                       | Properties | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [levels](#property-levels)                             | Properties | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [views](#property-views)                               | Properties | LinearComparativeView             | N genome rows, with N-1 synteny `levels` between adjacent pairs. The views/levels invariant is maintained by reconcileLevels().                                                                                                                                                                                                                                                                                                                                              |
| [viewTrackConfigs](#property-viewtrackconfigs)         | Properties | LinearComparativeView             | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere                                                                                                                                                                                                                                                                                                                                    |
| [width](#volatile-width)                               | Volatiles  | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [scrollZoom](#getter-scrollzoom)                       | Getters    | LinearComparativeView             | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere                                                                                                                                                                                                                                                                                                                                                        |
| [initialized](#getter-initialized)                     | Getters    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [assemblyNames](#getter-assemblynames)                 | Getters    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isViewCompact](#method-isviewcompact)                 | Methods    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [headerMenuItems](#method-headermenuitems)             | Methods    | LinearComparativeView             | includes a subset of view menu options because the full list is a little overwhelming. overridden by subclasses                                                                                                                                                                                                                                                                                                                                                              |
| [showMenuItems](#method-showmenuitems)                 | Methods    | LinearComparativeView             | items for the "Show..." submenu in the header. overridden by subclasses to add view-specific toggle options                                                                                                                                                                                                                                                                                                                                                                  |
| [menuItems](#method-menuitems)                         | Methods    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [rubberBandMenuItems](#method-rubberbandmenuitems)     | Methods    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [reconcileLevels](#action-reconcilelevels)             | Actions    | LinearComparativeView             | Reconcile the levels array to the views array: exactly one synteny level per gap between adjacent views (N views -> N-1 levels). Grows or shrinks from the end, preserving existing levels and their tracks. The single source of truth for the views/levels invariant.                                                                                                                                                                                                      |
| [setWidth](#action-setwidth)                           | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setViews](#action-setviews)                           | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [addView](#action-addview)                             | Actions    | LinearComparativeView             | Push a new genome row. The new trailing level starts with no synteny tracks.                                                                                                                                                                                                                                                                                                                                                                                                 |
| [removeLastRow](#action-removelastrow)                 | Actions    | LinearComparativeView             | Drop the bottom genome row and its synteny level. Only terminal removal is supported: a level's `level` index addresses views[level]/[level+1], so removing a middle row would require reindexing every level below it. Growth and shrinkage both happen at the end of the chain.                                                                                                                                                                                            |
| [setLinkViews](#action-setlinkviews)                   | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setScrollZoom](#action-setscrollzoom)                 | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [activateTrackSelector](#action-activatetrackselector) | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [toggleTrack](#action-toggletrack)                     | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showTrack](#action-showtrack)                         | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [hideTrack](#action-hidetrack)                         | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [squareView](#action-squareview)                       | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearView](#action-clearview)                         | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [toggleCompactView](#action-togglecompactview)         | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [compactAllViews](#action-compactallviews)             | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [expandAllViews](#action-expandallviews)               | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [autoScaleLevelHeights](#action-autoscalelevelheights) | Actions    | LinearComparativeView             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [appendRow](#action-appendrow)                         | Actions    | LinearComparativeView             | Append an assembly to the bottom of the stack and optionally show a synteny track on the new level connecting it to the previous bottom row. A synteny dataset is an edge between two adjacent assemblies, so rows are only ever added at the chain's end. The new row is created with a LinearGenomeView `init` — its own afterAttach autorun loads the assembly regions and navigates (whole genome, or `loc` when given), so we don't reimplement that imperatively here. |
| [displayName](#property-displayname)                   | Properties | [BaseViewModel](../baseviewmodel) | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                                                                                                                                                                                                                                                                                                                        |
| [minimized](#property-minimized)                       | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDisplayName](#action-setdisplayname)               | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMinimized](#action-setminimized)                   | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

<details>
<summary>LinearComparativeView - Properties</summary>

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

#### property: views

N genome rows, with N-1 synteny `levels` between adjacent pairs. The
views/levels invariant is maintained by reconcileLevels().

```ts
// type signature
type views = IArrayType<IModelType<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>, { ...; } & ... 18 more ... & { ...; }, _NotCustomized, { ...; }>>
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

<details>
<summary>LinearComparativeView - Properties (other undocumented members)</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
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

#### property: levels

```ts
// type signature
type levels = IArrayType<IAnyModelType>
// code
levels: types.array(LinearSyntenyViewHelper)
```

</details>

<details>
<summary>LinearComparativeView - Volatiles</summary>

#### volatile: width

```ts
// type signature
type width = number | undefined
// code
width: undefined as number | undefined
```

</details>

<details>
<summary>LinearComparativeView - Getters</summary>

#### getter: scrollZoom

scroll-to-zoom is a global, personal preference resolved from the session;
toggling it in any view applies everywhere

```ts
type scrollZoom = boolean
```

</details>

<details>
<summary>LinearComparativeView - Getters (other undocumented members)</summary>

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

</details>

<details>
<summary>LinearComparativeView - Methods</summary>

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

</details>

<details>
<summary>LinearComparativeView - Methods (other undocumented members)</summary>

#### method: isViewCompact

```ts
type isViewCompact = (idx: number) => boolean
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

<details>
<summary>LinearComparativeView - Actions</summary>

#### action: reconcileLevels

Reconcile the levels array to the views array: exactly one synteny level per gap
between adjacent views (N views -> N-1 levels). Grows or shrinks from the end,
preserving existing levels and their tracks. The single source of truth for the
views/levels invariant.

```ts
type reconcileLevels = () => void
```

#### action: addView

Push a new genome row. The new trailing level starts with no synteny tracks.

```ts
type addView = (view: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<...>; }, { ...; }>, { ...; }>>>) => void
```

#### action: removeLastRow

Drop the bottom genome row and its synteny level. Only terminal removal is
supported: a level's `level` index addresses views[level]/[level+1], so removing
a middle row would require reindexing every level below it. Growth and shrinkage
both happen at the end of the chain.

```ts
type removeLastRow = () => void
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

<details>
<summary>LinearComparativeView - Actions (other undocumented members)</summary>

#### action: setWidth

```ts
type setWidth = (newWidth: number) => void
```

#### action: setViews

```ts
type setViews = (views: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<...>; }, { ...; }>, { ...; }>>>[]) => void
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
type toggleTrack = (trackId: string, level?: any) => any
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

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseViewModel</summary>

[BaseViewModel →](../baseviewmodel)

**Properties**

#### property: displayName

displayName is displayed in the header of the view, or assembly names being used
if none is specified

```ts
// type signature
type displayName = IMaybe<ISimpleType<string>>
// code
displayName: types.maybe(types.string)
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

**Actions**

#### action: setDisplayName

```ts
type setDisplayName = (name: string) => void
```

#### action: setMinimized

```ts
type setMinimized = (flag: boolean) => void
```

</details>
