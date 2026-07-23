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

| Member                                                 | Kind       | Defined by                        | Description                                                                                                                                                               |
| ------------------------------------------------------ | ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                     | Properties | LinearComparativeView             |                                                                                                                                                                           |
| [type](#property-type)                                 | Properties | LinearComparativeView             | Abstract base: never registered or instantiated standalone, always composed into a concrete subclass (e.g. LinearSyntenyView) that overrides `type` with its own literal. |
| [trackSelectorType](#property-trackselectortype)       | Properties | LinearComparativeView             |                                                                                                                                                                           |
| [showIntraviewLinks](#property-showintraviewlinks)     | Properties | LinearComparativeView             |                                                                                                                                                                           |
| [linkViews](#property-linkviews)                       | Properties | LinearComparativeView             |                                                                                                                                                                           |
| [levels](#property-levels)                             | Properties | LinearComparativeView             |                                                                                                                                                                           |
| [views](#property-views)                               | Properties | LinearComparativeView             | N genome rows, with N-1 synteny `levels` between adjacent pairs.                                                                                                          |
| [viewTrackConfigs](#property-viewtrackconfigs)         | Properties | LinearComparativeView             | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere                                 |
| [width](#volatile-width)                               | Volatiles  | LinearComparativeView             |                                                                                                                                                                           |
| [scrollZoom](#getter-scrollzoom)                       | Getters    | LinearComparativeView             | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere                                                     |
| [initialized](#getter-initialized)                     | Getters    | LinearComparativeView             |                                                                                                                                                                           |
| [assemblyNames](#getter-assemblynames)                 | Getters    | LinearComparativeView             |                                                                                                                                                                           |
| [isViewCompact](#method-isviewcompact)                 | Methods    | LinearComparativeView             |                                                                                                                                                                           |
| [headerMenuItems](#method-headermenuitems)             | Methods    | LinearComparativeView             | includes a subset of view menu options because the full list is a little overwhelming.                                                                                    |
| [showMenuItems](#method-showmenuitems)                 | Methods    | LinearComparativeView             | items for the "Show..." submenu in the header.                                                                                                                            |
| [menuItems](#method-menuitems)                         | Methods    | LinearComparativeView             |                                                                                                                                                                           |
| [rubberBandMenuItems](#method-rubberbandmenuitems)     | Methods    | LinearComparativeView             |                                                                                                                                                                           |
| [reconcileLevels](#action-reconcilelevels)             | Actions    | LinearComparativeView             | Reconcile the levels array to the views array: exactly one synteny level per gap between adjacent views (N views -> N-1 levels).                                          |
| [setWidth](#action-setwidth)                           | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [setViews](#action-setviews)                           | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [addView](#action-addview)                             | Actions    | LinearComparativeView             | Push a new genome row.                                                                                                                                                    |
| [removeLastRow](#action-removelastrow)                 | Actions    | LinearComparativeView             | Drop the bottom genome row and its synteny level.                                                                                                                         |
| [setLinkViews](#action-setlinkviews)                   | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [setScrollZoom](#action-setscrollzoom)                 | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [activateTrackSelector](#action-activatetrackselector) | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [toggleTrack](#action-toggletrack)                     | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [showTrack](#action-showtrack)                         | Actions    | LinearComparativeView             | No-op for a level that doesn't exist, matching hideTrack/toggleTrack.                                                                                                     |
| [hideTrack](#action-hidetrack)                         | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [squareView](#action-squareview)                       | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [clearView](#action-clearview)                         | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [toggleCompactView](#action-togglecompactview)         | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [compactAllViews](#action-compactallviews)             | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [expandAllViews](#action-expandallviews)               | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [autoScaleLevelHeights](#action-autoscalelevelheights) | Actions    | LinearComparativeView             |                                                                                                                                                                           |
| [appendRow](#action-appendrow)                         | Actions    | LinearComparativeView             | Append an assembly to the bottom of the stack and optionally show a synteny track on the new level connecting it to the previous bottom row.                              |
| [displayName](#property-displayname)                   | Properties | [BaseViewModel](../baseviewmodel) | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                     |
| [minimized](#property-minimized)                       | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                           |
| [setDisplayName](#action-setdisplayname)               | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                           |
| [setMinimized](#action-setminimized)                   | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                           |

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
type views = IArrayType<IModelType<_OverrideProps<_OverrideProps<…>, { ...; }>, { ...; } & ... 19 more ... & { ...; }, _NotCustomized, { ...; }>>
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

| Member                                                           | Type                                                |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| <span id="property-id">id</span>                                 | `IOptionalIType<ISimpleType<string>, [undefined]>`  |
| <span id="property-trackselectortype">trackSelectorType</span>   | `IOptionalIType<ISimpleType<string>, [undefined]>`  |
| <span id="property-showintraviewlinks">showIntraviewLinks</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| <span id="property-linkviews">linkViews</span>                   | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| <span id="property-levels">levels</span>                         | `IArrayType<IAnyModelType>`                         |

</details>

<details>
<summary>LinearComparativeView - Volatiles</summary>

| Member                                 | Type                  |
| -------------------------------------- | --------------------- |
| <span id="volatile-width">width</span> | `number \| undefined` |

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

| Member                                               | Type       |
| ---------------------------------------------------- | ---------- |
| <span id="getter-initialized">initialized</span>     | `boolean`  |
| <span id="getter-assemblynames">assemblyNames</span> | `string[]` |

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

| Member                                                           | Type                                              |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| <span id="method-isviewcompact">isViewCompact</span>             | `(idx: number) => boolean`                        |
| <span id="method-menuitems">menuItems</span>                     | `() => MenuItem[]`                                |
| <span id="method-rubberbandmenuitems">rubberBandMenuItems</span> | `() => { label: string; onClick: () => void; }[]` |

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
type addView = (view: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<…>, { ...; }>>>) => void
```

#### action: removeLastRow

Drop the bottom genome row and its synteny level. Only terminal removal is
supported: a level's `level` index addresses views[level]/[level+1], so removing
a middle row would require reindexing every level below it. Growth and shrinkage
both happen at the end of the chain.

```ts
type removeLastRow = () => void
```

#### action: showTrack

No-op for a level that doesn't exist, matching hideTrack/toggleTrack.
reconcileLevels already materializes exactly one level per adjacent view pair,
so a missing level means the caller named a gap that has no views (e.g. an
`init.tracks` with more levels than `init.views` has gaps); creating one here
would append a level whose views[level+1] is absent, which renders nothing and
silently breaks the views/levels invariant.

```ts
type showTrack = (trackId: string, level?: any, initialSnapshot?: any) => void
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

| Member                                                               | Type                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| <span id="action-setwidth">setWidth</span>                           | `(newWidth: number) => void`                                                                           |
| <span id="action-setviews">setViews</span>                           | `(views: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<…>, { ...; }>>>[]) => void` |
| <span id="action-setlinkviews">setLinkViews</span>                   | `(arg: boolean) => void`                                                                               |
| <span id="action-setscrollzoom">setScrollZoom</span>                 | `(arg: boolean) => void`                                                                               |
| <span id="action-activatetrackselector">activateTrackSelector</span> | `(level: number) => Widget`                                                                            |
| <span id="action-toggletrack">toggleTrack</span>                     | `(trackId: string, level?: any) => any`                                                                |
| <span id="action-hidetrack">hideTrack</span>                         | `(trackId: string, level?: any) => void`                                                               |
| <span id="action-squareview">squareView</span>                       | `() => void`                                                                                           |
| <span id="action-clearview">clearView</span>                         | `() => void`                                                                                           |
| <span id="action-togglecompactview">toggleCompactView</span>         | `(idx: number) => void`                                                                                |
| <span id="action-compactallviews">compactAllViews</span>             | `() => void`                                                                                           |
| <span id="action-expandallviews">expandAllViews</span>               | `() => void`                                                                                           |
| <span id="action-autoscalelevelheights">autoScaleLevelHeights</span> | `() => void`                                                                                           |

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

| Member                                         | Type                                                |
| ---------------------------------------------- | --------------------------------------------------- |
| <span id="property-minimized">minimized</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

**Actions**

| Member                                                 | Type                      |
| ------------------------------------------------------ | ------------------------- |
| <span id="action-setdisplayname">setDisplayName</span> | `(name: string) => void`  |
| <span id="action-setminimized">setMinimized</span>     | `(flag: boolean) => void` |

</details>
