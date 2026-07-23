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

| Member                                                           | Kind       | Defined by                        | Description                                                                                                                                    |
| ---------------------------------------------------------------- | ---------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                           | Properties | BreakpointSplitView               |                                                                                                                                                |
| [height](#property-height)                                       | Properties | BreakpointSplitView               |                                                                                                                                                |
| [showIntraviewLinks](#property-showintraviewlinks)               | Properties | BreakpointSplitView               |                                                                                                                                                |
| [linkViews](#property-linkviews)                                 | Properties | BreakpointSplitView               |                                                                                                                                                |
| [interactiveOverlay](#property-interactiveoverlay)               | Properties | BreakpointSplitView               |                                                                                                                                                |
| [showHeader](#property-showheader)                               | Properties | BreakpointSplitView               |                                                                                                                                                |
| [views](#property-views)                                         | Properties | BreakpointSplitView               |                                                                                                                                                |
| [init](#property-init)                                           | Properties | BreakpointSplitView               | declarative child panels (loc/assembly/tracks) resolved into `views` once the view has a width; used for initializing from a session snapshot. |
| [width](#volatile-width)                                         | Volatiles  | BreakpointSplitView               |                                                                                                                                                |
| [matchedTrackFeatures](#volatile-matchedtrackfeatures)           | Volatiles  | BreakpointSplitView               |                                                                                                                                                |
| [scrollZoom](#getter-scrollzoom)                                 | Getters    | BreakpointSplitView               | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere                          |
| [hasSomethingToShow](#getter-hassomethingtoshow)                 | Getters    | BreakpointSplitView               |                                                                                                                                                |
| [initialized](#getter-initialized)                               | Getters    | BreakpointSplitView               |                                                                                                                                                |
| [showImportForm](#getter-showimportform)                         | Getters    | BreakpointSplitView               |                                                                                                                                                |
| [assembly](#getter-assembly)                                     | Getters    | BreakpointSplitView               |                                                                                                                                                |
| [matchedTracks](#getter-matchedtracks)                           | Getters    | BreakpointSplitView               | Find all track ids that match across multiple views, or return just the single view's track if only a single row is used                       |
| [matchedTrackChunks](#getter-matchedtrackchunks)                 | Getters    | BreakpointSplitView               | Classifies each matched track and pairs its features, keyed by trackId.                                                                        |
| [overlayMatches](#getter-overlaymatches)                         | Getters    | BreakpointSplitView               | Zero-arg cached getter: resolves each matched chunk's features to layout rectangles, returning a Map keyed by trackId.                         |
| [exportSvg](#method-exportsvg)                                   | Methods    | BreakpointSplitView               | creates an svg export and save using FileSaver                                                                                                 |
| [getMatchedTracks](#method-getmatchedtracks)                     | Methods    | BreakpointSplitView               | Get tracks with a given trackId across multiple views.                                                                                         |
| [getTrackOverlayData](#method-gettrackoverlaydata)               | Methods    | BreakpointSplitView               | Per-render precompute for an overlay track.                                                                                                    |
| [getMatchedFeaturesInLayout](#method-getmatchedfeaturesinlayout) | Methods    | BreakpointSplitView               |                                                                                                                                                |
| [menuItems](#method-menuitems)                                   | Methods    | BreakpointSplitView               |                                                                                                                                                |
| [rubberBandMenuItems](#method-rubberbandmenuitems)               | Methods    | BreakpointSplitView               |                                                                                                                                                |
| [setWidth](#action-setwidth)                                     | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [setInteractiveOverlay](#action-setinteractiveoverlay)           | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [setShowIntraviewLinks](#action-setshowintraviewlinks)           | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [setLinkViews](#action-setlinkviews)                             | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [setScrollZoom](#action-setscrollzoom)                           | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [setShowHeader](#action-setshowheader)                           | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [setMatchedTrackFeatures](#action-setmatchedtrackfeatures)       | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [reverseViewOrder](#action-reversevieworder)                     | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [squareView](#action-squareview)                                 | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [setInit](#action-setinit)                                       | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [setViews](#action-setviews)                                     | Actions    | BreakpointSplitView               |                                                                                                                                                |
| [id](#property-id)                                               | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                |
| [displayName](#property-displayname)                             | Properties | [BaseViewModel](../baseviewmodel) | displayName is displayed in the header of the view, or assembly names being used if none is specified                                          |
| [minimized](#property-minimized)                                 | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                |
| [setDisplayName](#action-setdisplayname)                         | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                |
| [setMinimized](#action-setminimized)                             | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                |

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

| Member                                                           | Type                                                                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="property-type">type</span>                             | `ISimpleType<"BreakpointSplitView">`                                                                                                   |
| <span id="property-height">height</span>                         | `IOptionalIType<ISimpleType<number>, [undefined]>`                                                                                     |
| <span id="property-showintraviewlinks">showIntraviewLinks</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                                                                                    |
| <span id="property-linkviews">linkViews</span>                   | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                                                                                    |
| <span id="property-interactiveoverlay">interactiveOverlay</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                                                                                    |
| <span id="property-showheader">showHeader</span>                 | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                                                                                    |
| <span id="property-views">views</span>                           | `IArrayType<IModelType<_OverrideProps<_OverrideProps<…>, { ...; }>, { ...; } & ... 19 more ... & { ...; }, _NotCustomized, { ...; }>>` |

</details>

<details>
<summary>BreakpointSplitView - Volatiles</summary>

| Member                                                               | Type     |
| -------------------------------------------------------------------- | -------- |
| <span id="volatile-width">width</span>                               | `number` |
| <span id="volatile-matchedtrackfeatures">matchedTrackFeatures</span> | `{}`     |

</details>

<details>
<summary>BreakpointSplitView - Getters</summary>

#### getter: scrollZoom

scroll-to-zoom is a global, personal preference resolved from the session;
toggling it in any view applies everywhere

```ts
type scrollZoom = boolean
```

#### getter: matchedTracks

Find all track ids that match across multiple views, or return just the single
view's track if only a single row is used

```ts
type matchedTracks = OverlayTrack[]
```

#### getter: matchedTrackChunks

Classifies each matched track and pairs its features, keyed by trackId.
Everything here is a function of the fetched features alone, so it is
deliberately kept out of `overlayMatches`, which additionally reads each track's
layout: the layout reads invalidate on a track resize or a compactness change,
and fusing the two would re-run this whole pass — including the SA-chain parse,
the expensive part — on every drag frame.

```ts
type matchedTrackChunks = Map<string, MatchedChunks>
```

#### getter: overlayMatches

Zero-arg cached getter: resolves each matched chunk's features to layout
rectangles, returning a Map keyed by trackId. Mobx caches this across renders
and only invalidates when the underlying feature or layout reads change — so
scrolling within already-loaded data does NOT trigger a re-lookup.

```ts
type overlayMatches = Map<string, OverlayMatch>
```

</details>

<details>
<summary>BreakpointSplitView - Getters (other undocumented members)</summary>

| Member                                                         | Type                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| <span id="getter-hassomethingtoshow">hasSomethingToShow</span> | `boolean`                                                                              |
| <span id="getter-initialized">initialized</span>               | `boolean`                                                                              |
| <span id="getter-showimportform">showImportForm</span>         | `boolean`                                                                              |
| <span id="getter-assembly">assembly</span>                     | `(ModelInstanceTypeProps<…> & {…} & ... 12 more ... & IStateTreeNode<…>) \| undefined` |

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
type getMatchedTracks = (trackConfigId: string) => OverlayTrack[]
```

#### method: getTrackOverlayData

Per-render precompute for an overlay track. Resolves an OverlayLevel of geometry
per view level, then returns getX/getY closures for converting feature layout
records to SVG coordinates.

`yOffsetsOverride` — SVG export: fixed track tops, scrollTops zeroed.
`domYOffsets` — live rendering: DOM-measured track tops (relative to the overlay
SVG), scrollTops still read from model.

```ts
type getTrackOverlayData = (trackId: string, yOffsetsOverride?: number[] | undefined, domYOffsets?: number[] | undefined) => {…}
```

</details>

<details>
<summary>BreakpointSplitView - Methods (other undocumented members)</summary>

| Member                                                                         | Type                                                                                                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-getmatchedfeaturesinlayout">getMatchedFeaturesInLayout</span> | `(trackConfigId: string, features: Feature[][]) => { feature: Feature; layout: LayoutRecord; level: number; clipLengthAtStartOfRead: number; }[][]` |
| <span id="method-menuitems">menuItems</span>                                   | `() => ({…} \| {…} \| { label: string; icon: OverridableComponent<…> & { ...; }; onClick: () => void; subMenu?: undefined; } \| { ...; })[]`        |
| <span id="method-rubberbandmenuitems">rubberBandMenuItems</span>               | `() => { label: string; onClick: () => void; }[]`                                                                                                   |

</details>

<details>
<summary>BreakpointSplitView - Actions</summary>

| Member                                                                   | Type                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| <span id="action-setwidth">setWidth</span>                               | `(newWidth: number) => void`                                  |
| <span id="action-setinteractiveoverlay">setInteractiveOverlay</span>     | `(arg: boolean) => void`                                      |
| <span id="action-setshowintraviewlinks">setShowIntraviewLinks</span>     | `(arg: boolean) => void`                                      |
| <span id="action-setlinkviews">setLinkViews</span>                       | `(arg: boolean) => void`                                      |
| <span id="action-setscrollzoom">setScrollZoom</span>                     | `(arg: boolean) => void`                                      |
| <span id="action-setshowheader">setShowHeader</span>                     | `(arg: boolean) => void`                                      |
| <span id="action-setmatchedtrackfeatures">setMatchedTrackFeatures</span> | `(obj: Record<string, Feature[][]>) => void`                  |
| <span id="action-reversevieworder">reverseViewOrder</span>               | `() => void`                                                  |
| <span id="action-squareview">squareView</span>                           | `() => void`                                                  |
| <span id="action-setinit">setInit</span>                                 | `(init?: BreakpointSplitViewInitView[] \| undefined) => void` |
| <span id="action-setviews">setViews</span>                               | `(viewInits: BreakpointSplitViewInitView[]) => void`          |

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
| <span id="property-id">id</span>               | `IOptionalIType<ISimpleType<string>, [undefined]>`  |
| <span id="property-minimized">minimized</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

**Actions**

| Member                                                 | Type                      |
| ------------------------------------------------------ | ------------------------- |
| <span id="action-setdisplayname">setDisplayName</span> | `(name: string) => void`  |
| <span id="action-setminimized">setMinimized</span>     | `(flag: boolean) => void` |

</details>
