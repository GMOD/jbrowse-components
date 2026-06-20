---
id: breakpointsplitview
title: BreakpointSplitView
sidebar_label: View -> BreakpointSplitView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BreakpointSplitView.md)

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
<summary>BreakpointSplitView - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'BreakpointSplitView'>
// code
type: types.literal('BreakpointSplitView')
```

#### property: height

```ts
// type signature
type height = IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.stripDefault(types.number, defaultHeight)
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
interactiveOverlay: types.stripDefault(types.boolean, true)
```

#### property: showHeader

```ts
// type signature
type showHeader = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showHeader: types.stripDefault(types.boolean, true)
```

#### property: views

```ts
// type signature
type views = IArrayType<IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; } & ... 17 more ... & { ...; }, _NotCustomized, { ...; }>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### property: init

declarative child panels (loc/assembly/tracks) resolved into `views` once the
view has a width; used for initializing from a session snapshot. Transient —
stripped by postProcessSnapshot.

```ts
// type signature
type init = IType<
  BreakpointSplitViewInitView[] | undefined,
  BreakpointSplitViewInitView[] | undefined,
  BreakpointSplitViewInitView[] | undefined
>
// code
init: types.frozen<BreakpointSplitViewInitView[] | undefined>()
```

</details>

<details open>
<summary>BreakpointSplitView - Volatiles</summary>

#### volatile: width

```ts
// type signature
type width = number
// code
width: 800
```

#### volatile: matchedTrackFeatures

```ts
// type signature
type matchedTrackFeatures = {}
// code
matchedTrackFeatures: {
}
```

</details>

<details open>
<summary>BreakpointSplitView - Getters</summary>

#### getter: hasSomethingToShow

```ts
type hasSomethingToShow = boolean
```

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: showImportForm

```ts
type showImportForm = boolean
```

#### getter: assembly

```ts
type assembly = (ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; loadingP: Promise<void> | undefined; ... 7 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>) | undefined
```

#### getter: matchedTracks

Find all track ids that match across multiple views, or return just the single
view's track if only a single row is used

```ts
type matchedTracks =
  | (IMSTArray<IAnyType> & IStateTreeNode<IArrayType<IAnyType>>)
  | { configuration: { trackId: string } }[]
```

#### getter: overlayMatches

Zero-arg cached getter: classifies each matched track, pairs its features, looks
up layout rectangles, and returns a Map keyed by trackId. Mobx caches this
across renders and only invalidates when the underlying feature or layout reads
change — so horizontal/vertical scrolling and track resizing do NOT trigger
re-pairing or re-lookup.

```ts
type overlayMatches = Map<string, OverlayMatch>
```

</details>

<details open>
<summary>BreakpointSplitView - Methods</summary>

#### method: exportSvg

creates an svg export and save using FileSaver

```ts
type exportSvg = (opts?: ExportSvgOptions) => Promise<void>
```

#### method: getMatchedTracks

Get tracks with a given trackId across multiple views. Callers that index the
result by view level (getTrackOverlayData, getMatchedFeaturesInLayout) rely on
it staying aligned with `views` — which holds only because overlays are driven
by `overlayMatches`, whose trackIds come from `matchedTracks` (the intersect
across all views), so the track is present in every view and `filter` drops
nothing. Don't level-index the result for an arbitrary trackId.

```ts
type getMatchedTracks = (trackConfigId: string) => any[]
```

#### method: getTrackOverlayData

Per-render precompute for an overlay track. Gathers scroll top, display height,
coverage offset, and view offsetPx per level, then returns getX/getY closures
for converting feature layout records to SVG coordinates.

`yOffsetsOverride` — SVG export: fixed track tops, scrollTops zeroed.
`domYOffsets` — live rendering: DOM-measured track tops (relative to the overlay
SVG), scrollTops still read from model.

```ts
type getTrackOverlayData = (
  trackId: string,
  yOffsetsOverride?: number[] | undefined,
  domYOffsets?: number[] | undefined,
) => {
  tracks: any[]
  yOffsets: any[]
  heights: any[]
  getX: (level: number, refName: string, coord: number) => number | undefined
  getY: (level: number, c: LayoutRecord) => any
}
```

#### method: getMatchedFeaturesInLayout

```ts
type getMatchedFeaturesInLayout = (
  trackConfigId: string,
  features: Feature[][],
) => {
  feature: Feature
  layout: LayoutRecord
  level: number
  clipLengthAtStartOfRead: number
}[][]
```

#### method: menuItems

```ts
type menuItems = () => ({ label: string; subMenu: MenuItem[]; } | { label: string; onClick: () => void; icon?: undefined; subMenu?: undefined; } | { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { ...; }; onClick: () => void; subMenu?: undefined; } | { ...; })[]
```

#### method: rubberBandMenuItems

```ts
type rubberBandMenuItems = () => { label: string; onClick: () => void }[]
```

</details>

<details open>
<summary>BreakpointSplitView - Actions</summary>

#### action: setWidth

```ts
type setWidth = (newWidth: number) => void
```

#### action: setInteractiveOverlay

```ts
type setInteractiveOverlay = (arg: boolean) => void
```

#### action: setShowIntraviewLinks

```ts
type setShowIntraviewLinks = (arg: boolean) => void
```

#### action: setLinkViews

```ts
type setLinkViews = (arg: boolean) => void
```

#### action: setShowHeader

```ts
type setShowHeader = (arg: boolean) => void
```

#### action: setMatchedTrackFeatures

```ts
type setMatchedTrackFeatures = (obj: Record<string, Feature[][]>) => void
```

#### action: reverseViewOrder

```ts
type reverseViewOrder = () => void
```

#### action: squareView

```ts
type squareView = () => void
```

#### action: setInit

```ts
type setInit = (init?: BreakpointSplitViewInitView[] | undefined) => void
```

#### action: setViews

```ts
type setViews = (viewInits: BreakpointSplitViewInitView[]) => void
```

</details>
