---
id: breakpointsplitview
title: BreakpointSplitView
sidebar_label: View -> BreakpointSplitView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`breakpoint-split-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`. `init` is an array — one entry per
stacked panel — each declaring the `assembly`, a `loc`, and the `tracks` to
show. The two panels flank a structural-variant breakpoint:

```js
{
  type: 'BreakpointSplitView',
  init: [
    { assembly: 'hg38', loc: 'chr1:1,000,000-1,100,000', tracks: ['alignments'] },
    { assembly: 'hg38', loc: 'chr5:2,000,000-2,100,000', tracks: ['alignments'] },
  ],
}
```

Each `tracks` entry can also be a `{ trackId, displaySnapshot }` object to set
per-panel display options (e.g. a shorter alignments height).

## Overview

## Members

| Member                                                           | Kind       | Defined by                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ---------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                           | Properties | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [height](#property-height)                                       | Properties | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [trackSelectorType](#property-trackselectortype)                 | Properties | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [showIntraviewLinks](#property-showintraviewlinks)               | Properties | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [linkViews](#property-linkviews)                                 | Properties | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [interactiveOverlay](#property-interactiveoverlay)               | Properties | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [showHeader](#property-showheader)                               | Properties | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [views](#property-views)                                         | Properties | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [init](#property-init)                                           | Properties | BreakpointSplitView               | declarative child panels (loc/assembly/tracks) resolved into `views` once the view has a width; used for initializing from a session snapshot. Transient — stripped by postProcessSnapshot.                                                                                                                                                                                                                                                                          |
| [width](#volatile-width)                                         | Volatiles  | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [matchedTrackFeatures](#volatile-matchedtrackfeatures)           | Volatiles  | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [hasSomethingToShow](#getter-hassomethingtoshow)                 | Getters    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [initialized](#getter-initialized)                               | Getters    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [showImportForm](#getter-showimportform)                         | Getters    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [assembly](#getter-assembly)                                     | Getters    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [matchedTracks](#getter-matchedtracks)                           | Getters    | BreakpointSplitView               | Find all track ids that match across multiple views, or return just the single view's track if only a single row is used                                                                                                                                                                                                                                                                                                                                             |
| [overlayMatches](#getter-overlaymatches)                         | Getters    | BreakpointSplitView               | Zero-arg cached getter: classifies each matched track, pairs its features, looks up layout rectangles, and returns a Map keyed by trackId. Mobx caches this across renders and only invalidates when the underlying feature or layout reads change — so horizontal/vertical scrolling and track resizing do NOT trigger re-pairing or re-lookup.                                                                                                                     |
| [exportSvg](#method-exportsvg)                                   | Methods    | BreakpointSplitView               | creates an svg export and save using FileSaver                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [getMatchedTracks](#method-getmatchedtracks)                     | Methods    | BreakpointSplitView               | Get tracks with a given trackId across multiple views. Callers that index the result by view level (getTrackOverlayData, getMatchedFeaturesInLayout) rely on it staying aligned with `views` — which holds only because overlays are driven by `overlayMatches`, whose trackIds come from `matchedTracks` (the intersect across all views), so the track is present in every view and `filter` drops nothing. Don't level-index the result for an arbitrary trackId. |
| [getTrackOverlayData](#method-gettrackoverlaydata)               | Methods    | BreakpointSplitView               | Per-render precompute for an overlay track. Gathers scroll top, display height, coverage offset, and view offsetPx per level, then returns getX/getY closures for converting feature layout records to SVG coordinates. `yOffsetsOverride` — SVG export: fixed track tops, scrollTops zeroed. `domYOffsets` — live rendering: DOM-measured track tops (relative to the overlay SVG), scrollTops still read from model.                                               |
| [getMatchedFeaturesInLayout](#method-getmatchedfeaturesinlayout) | Methods    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [menuItems](#method-menuitems)                                   | Methods    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [rubberBandMenuItems](#method-rubberbandmenuitems)               | Methods    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setWidth](#action-setwidth)                                     | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setInteractiveOverlay](#action-setinteractiveoverlay)           | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setShowIntraviewLinks](#action-setshowintraviewlinks)           | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setLinkViews](#action-setlinkviews)                             | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setShowHeader](#action-setshowheader)                           | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setMatchedTrackFeatures](#action-setmatchedtrackfeatures)       | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [reverseViewOrder](#action-reversevieworder)                     | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [squareView](#action-squareview)                                 | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setInit](#action-setinit)                                       | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setViews](#action-setviews)                                     | Actions    | BreakpointSplitView               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [id](#property-id)                                               | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [displayName](#property-displayname)                             | Properties | [BaseViewModel](../baseviewmodel) | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                                                                                                                                                                                                                                                                                                                |
| [minimized](#property-minimized)                                 | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setDisplayName](#action-setdisplayname)                         | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setMinimized](#action-setminimized)                             | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

<details>
<summary>BreakpointSplitView - Properties</summary>

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

<details>
<summary>BreakpointSplitView - Properties (other undocumented members)</summary>

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
type views = IArrayType<IModelType<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>, { ...; } & ... 18 more ... & { ...; }, _NotCustomized, { ...; }>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```

</details>

<details>
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

<details>
<summary>BreakpointSplitView - Getters</summary>

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

<details>
<summary>BreakpointSplitView - Getters (other undocumented members)</summary>

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

</details>

<details>
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
  getY: (level: number, c: LayoutRecord) => number
}
```

</details>

<details>
<summary>BreakpointSplitView - Methods (other undocumented members)</summary>

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

<details>
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

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseViewModel</summary>

[BaseViewModel →](../baseviewmodel)

**Properties**

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

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
