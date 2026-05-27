---
id: breakpointsplitview
title: BreakpointSplitView
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

## Docs

extends

- [BaseViewModel](../baseviewmodel)

### BreakpointSplitView - Properties

#### propertie: type

```js
// type signature
ISimpleType<"BreakpointSplitView">
// code
type: types.literal('BreakpointSplitView')
```

#### propertie: height

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.optional(types.number, defaultHeight)
```

#### propertie: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### propertie: showIntraviewLinks

```js
// type signature
true
// code
showIntraviewLinks: true
```

#### propertie: linkViews

```js
// type signature
false
// code
linkViews: false
```

#### propertie: interactiveOverlay

```js
// type signature
true
// code
interactiveOverlay: true
```

#### propertie: showHeader

```js
// type signature
true
// code
showHeader: true
```

#### propertie: views

```js
// type signature
IArrayType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }, { ...; } & ... 16 more ... & { ...; }, ModelCreationType<...>, ModelSnapshotType<...>>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### propertie: init

used for initializing the view from a session snapshot

```js
// type signature
IType<BreakpointSplitViewInit | undefined, BreakpointSplitViewInit | undefined, BreakpointSplitViewInit | undefined>
// code
init: types.frozen<BreakpointSplitViewInit | undefined>()
```

### BreakpointSplitView - Getters

#### getter: hasSomethingToShow

```js
// type
boolean
```

#### getter: initialized

```js
// type
boolean
```

#### getter: showImportForm

```js
// type
boolean
```

#### getter: assembly

```js
// type
({ configuration: any; } & NonEmptyObject & { error: unknown; loadingP: Promise<void> | undefined; volatileRegions: BasicRegion[] | undefined; refNameAliases: RefNameAliases | undefined; canonicalToSeqAdapterRefNames: Record<...> | undefined; cytobands: Feature[] | undefined; lowerCaseRefNameAliases: RefNameAliases ...
```

#### getter: matchedTracks

Find all track ids that match across multiple views, or return just the single
view's track if only a single row is used

```js
// type
(IMSTArray<IAnyType> & IStateTreeNode<IArrayType<IAnyType>>) | { configuration: { trackId: string; }; }[]
```

#### getter: overlayMatches

Zero-arg cached getter: classifies each matched track, pairs its features, looks
up layout rectangles, and returns a Map keyed by trackId. Mobx caches this
across renders and only invalidates when the underlying feature or layout reads
change — so horizontal/vertical scrolling and track resizing do NOT trigger
re-pairing or re-lookup.

```js
// type
Map<string, OverlayMatch>
```

### BreakpointSplitView - Methods

#### method: exportSvg

creates an svg export and save using FileSaver

```js
// type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
```

#### method: getMatchedTracks

Get tracks with a given trackId across multiple views

```js
// type signature
getMatchedTracks: (trackConfigId: string) => any[]
```

#### method: getTrackFeatures

Get a composite map of featureId-\>feature map for a track across multiple views

```js
// type signature
getTrackFeatures: (trackConfigId: string) => Map<string, Feature>
```

#### method: getTrackOverlayData

Per-render precompute for an overlay track. Gathers scroll top, display height,
coverage offset, and view offsetPx per level, then returns getX/getY closures
for converting feature layout records to SVG coordinates.

`yOffsetsOverride` — SVG export: fixed track tops, scrollTops zeroed.
`domYOffsets` — live rendering: DOM-measured track tops (relative to the overlay
SVG), scrollTops still read from model.

```js
// type signature
getTrackOverlayData: (trackId: string, yOffsetsOverride?: number[] | undefined, domYOffsets?: number[] | undefined) => { tracks: any[]; yOffsets: any[]; heights: any[]; getX: (level: number, refName: string, coord: number) => number | undefined; getY: (level: number, c: LayoutRecord) => any; }
```

#### method: menuItems

```js
// type signature
menuItems: () => ({ label: string; subMenu: MenuItem[]; } | { label: string; onClick: () => void; icon?: undefined; subMenu?: undefined; } | { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { ...; }; onClick: () => void; subMenu?: undefined; } | { ...; })[]
```

#### method: rubberBandMenuItems

```js
// type signature
rubberBandMenuItems: () => { label: string; onClick: () => void; }[]
```

### BreakpointSplitView - Actions

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: setInteractiveOverlay

```js
// type signature
setInteractiveOverlay: (arg: boolean) => void
```

#### action: setShowIntraviewLinks

```js
// type signature
setShowIntraviewLinks: (arg: boolean) => void
```

#### action: setLinkViews

```js
// type signature
setLinkViews: (arg: boolean) => void
```

#### action: setShowHeader

```js
// type signature
setShowHeader: (arg: boolean) => void
```

#### action: setMatchedTrackFeatures

```js
// type signature
setMatchedTrackFeatures: (obj: Record<string, Feature[][]>) => void
```

#### action: reverseViewOrder

```js
// type signature
reverseViewOrder: () => void
```

#### action: squareView

```js
// type signature
squareView: () => void
```

#### action: setInit

```js
// type signature
setInit: (init?: BreakpointSplitViewInit | undefined) => void
```

#### action: setViews

```js
// type signature
setViews: (viewInits: { loc?: string | undefined; assembly: string; tracks?: string[] | undefined; }[]) => void
```
