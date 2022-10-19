---
id: baselineardisplay
title: BaseLinearDisplay
toplevel: true
---

extends `BaseDisplay`

#### property: height

```js
height: types.optional(
  types.refinement('displayHeight', types.number, n => n >= minDisplayHeight),
  defaultDisplayHeight,
)
```

#### property: blockState

updated via autorun

```js
blockState: types.map(BlockState)
```

#### property: userBpPerPxLimit

```js
userBpPerPxLimit: types.maybe(types.number)
```

#### property: userByteSizeLimit

```js
userByteSizeLimit: types.maybe(types.number)
```

#### getter: blockType

```js
// Type
'dynamicBlocks' | 'staticBlocks'
```

#### getter: blockDefinitions

```js
// Type
any
```

#### getter: renderDelay

how many milliseconds to wait for the display to
"settle" before re-rendering a block

```js
// Type
number
```

#### getter: TooltipComponent

```js
// Type
React.FC<any>
```

#### getter: selectedFeatureId

returns a string feature ID if the globally-selected object
is probably a feature

```js
// Type
string
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead of the blocks,
make this return a react component

```js
// Type
any
```

#### getter: features

a CompositeMap of `featureId -> feature obj` that
just looks in all the block data for that feature

```js
// Type
CompositeMap<unknown, unknown>
```

#### getter: featureUnderMouse

```js
// Type
any
```

#### getter: getFeatureOverlapping

```js
// Type
;(blockKey: string, x: number, y: number) => any
```

#### getter: getFeatureByID

```js
// Type
;(blockKey: string, id: string) => LayoutRecord
```

#### getter: searchFeatureByID

```js
// Type
;(id: string) => LayoutRecord
```

#### getter: currentBytesRequested

```js
// Type
number
```

#### getter: currentFeatureScreenDensity

```js
// Type
number
```

#### property: bpPerPx

bpPerPx corresponds roughly to the zoom level, base-pairs per pixel

```js
view.bpPerPx
```

#### getter: maxFeatureScreenDensity

```js
// Type
any
```

#### getter: estimatedStatsReady

```js
// Type
boolean
```

#### getter: maxAllowableBytes

```js
// Type
number
```

#### action: setMessage

```js
// Type signature
setMessage: (message: string) => void
```

#### action: estimateRegionsStats

```js
// Type signature
estimateRegionsStats: (regions: Region[], opts: { headers?: Record<string, string>; signal?: AbortSignal; filters?: string[]; }) => Promise<{}>
```

#### action: setRegionStatsP

```js
// Type signature
setRegionStatsP: (p?: Promise<Stats>) => void
```

#### action: setRegionStats

```js
// Type signature
setRegionStats: (estimatedRegionStats?: Stats) => void
```

#### action: clearRegionStats

```js
// Type signature
clearRegionStats: () => void
```

#### action: setHeight

```js
// Type signature
setHeight: (displayHeight: number) => number
```

#### action: resizeHeight

```js
// Type signature
resizeHeight: (distance: number) => number
```

#### action: setScrollTop

```js
// Type signature
setScrollTop: (scrollTop: number) => void
```

#### action: updateStatsLimit

```js
// Type signature
updateStatsLimit: (stats: Stats) => void
```

#### action: addBlock

```js
// Type signature
addBlock: (key: string, block: BaseBlock) => void
```

#### action: setCurrBpPerPx

```js
// Type signature
setCurrBpPerPx: (n: number) => void
```

#### action: deleteBlock

```js
// Type signature
deleteBlock: (key: string) => void
```

#### action: selectFeature

```js
// Type signature
selectFeature: (feature: Feature) => void
```

#### action: clearFeatureSelection

```js
// Type signature
clearFeatureSelection: () => void
```

#### action: setFeatureIdUnderMouse

```js
// Type signature
setFeatureIdUnderMouse: (feature: string) => void
```

#### action: reload

```js
// Type signature
reload: () => void
```

#### action: setContextMenuFeature

```js
// Type signature
setContextMenuFeature: (feature?: Feature) => void
```

#### getter: regionTooLarge

region is too large if:

- stats are ready
- region is greater than 20kb (don't warn when zoomed in less than that)
- and bytes is greater than max allowed bytes or density greater than max density

```js
// Type
boolean
```

#### getter: dynamicBlocks

dynamic blocks represent the exact coordinates of the currently
visible genome regions on the screen. they are similar to static
blocks, but statcic blocks can go offscreen while dynamic blocks
represent exactly what is on screen

```js
// Type
BlockSet
```

#### getter: regionTooLargeReason

only shows a message of bytes requested is defined, the feature density
based stats don't produce any helpful message besides to zoom in

```js
// Type
string
```

#### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

#### getter: staticBlocks

static blocks are an important concept jbrowse uses to avoid
re-rendering when you scroll to the side. when you horizontally
scroll to the right, old blocks to the left may be removed, and
new blocks may be instantiated on the right. tracks may use the
static blocks to render their data for the region represented by
the block

```js
// Type
BlockSet
```

#### method: regionCannotBeRenderedText

```js
// Type signature
regionCannotBeRenderedText: (_region: Region) =>
  '' | 'Force load to see features'
```

#### method: regionCannotBeRendered

```js
// Type signature
regionCannotBeRendered: (_region: Region) => Element
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

#### method: contextMenuItems

```js
// Type signature
contextMenuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### property: rpcDriverName

```js
self.rpcDriverName
```

#### method: renderSvg

```js
// Type signature
renderSvg: (opts: ExportSvgOptions & { overrideHeight: number; }) => Promise<Element>
```
