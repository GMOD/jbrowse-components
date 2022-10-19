---
id: baselineardisplay
title: BaseLinearDisplay
toplevel: true
---


extends `BaseDisplay`
#### property: height


```js

      /**
       * !property
       */
      height: types.optional(
        types.refinement(
          'displayHeight',
          types.number,
          n => n >= minDisplayHeight,
        ),
        defaultDisplayHeight,
      )
```
#### property: blockState


```js

      /**
       * !property
       * updated via autorun
       */
      blockState: types.map(BlockState)
```
#### property: userBpPerPxLimit


```js

      /**
       * !property
       */
      userBpPerPxLimit: types.maybe(types.number)
```
#### property: userByteSizeLimit


```js

      /**
       * !property
       */
      userByteSizeLimit: types.maybe(types.number)
```
#### getter: blockType



```js
// Type
"dynamicBlocks" | "staticBlocks"
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
#### property: blockState


```js
 self.blockState
```
#### getter: featureUnderMouse



```js
// Type
any
```
#### getter: getFeatureOverlapping



```js
// Type
(blockKey: string, x: number, y: number) => any
```
#### property: blockState


```js
 self.blockState
```
#### getter: getFeatureByID



```js
// Type
(blockKey: string, id: string) => LayoutRecord
```
#### property: blockState


```js
 self.blockState
```
#### getter: searchFeatureByID



```js
// Type
(id: string) => LayoutRecord
```
#### property: blockState


```js

      self.blockState
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
#### property: userByteSizeLimit


```js

        self.userByteSizeLimit
```
#### action: setMessage



```js
// Type signature
setMessage: (message: string) => void
```
#### getter: blockDefinitions



```js
// Type
any
```
#### property: blockState


```js
self.blockState
```
#### property: blockState


```js

          self.blockState
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
#### property: height


```js

        self.height
```
#### property: height


```js

        self.height
```
#### property: height


```js
 self.height
```
#### action: resizeHeight



```js
// Type signature
resizeHeight: (distance: number) => number
```
#### property: height


```js
 self.height
```
#### property: height


```js
self.height
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
#### property: userByteSizeLimit


```js

        self.userByteSizeLimit
```
#### property: userBpPerPxLimit


```js

        self.userBpPerPxLimit
```
#### property: bpPerPx


```js
 view.bpPerPx
```
#### action: addBlock



```js
// Type signature
addBlock: (key: string, block: BaseBlock) => void
```
#### property: blockState


```js

      self.blockState
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
#### property: blockState


```js

      self.blockState
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
#### property: blockState


```js
self.blockState
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
#### getter: estimatedStatsReady



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
#### property: userBpPerPxLimit


```js
 self.userBpPerPxLimit
```
#### property: bpPerPx


```js
 view.bpPerPx
```
#### property: userBpPerPxLimit


```js
 self.userBpPerPxLimit
```
#### getter: currentFeatureScreenDensity



```js
// Type
number
```
#### getter: maxFeatureScreenDensity



```js
// Type
any
```
#### getter: currentBytesRequested



```js
// Type
number
```
#### getter: maxAllowableBytes



```js
// Type
number
```
#### getter: regionTooLargeReason


only shows a message of bytes requested is defined, the feature density
based stats don't produce any helpful message besides to zoom in
```js
// Type
string
```
#### getter: currentBytesRequested



```js
// Type
number
```
#### getter: maxAllowableBytes



```js
// Type
number
```
#### action: reload



```js
// Type signature
reload: () => Promise<void>
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
#### action: estimateRegionsStats



```js
// Type signature
estimateRegionsStats: (regions: Region[], opts: { headers?: Record<string, string>; signal?: AbortSignal; filters?: string[]; }) => Promise<{}>
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
#### action: setRegionStats



```js
// Type signature
setRegionStats: (estimatedRegionStats?: Stats) => void
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
#### action: setCurrBpPerPx



```js
// Type signature
setCurrBpPerPx: (n: number) => void
```
#### property: bpPerPx


```js
view.bpPerPx
```
#### property: bpPerPx


```js
view.bpPerPx
```
#### action: clearRegionStats



```js
// Type signature
clearRegionStats: () => void
```
#### action: setCurrBpPerPx



```js
// Type signature
setCurrBpPerPx: (n: number) => void
```
#### property: bpPerPx


```js
view.bpPerPx
```
#### action: estimateRegionsStats



```js
// Type signature
estimateRegionsStats: (regions: Region[], opts: { headers?: Record<string, string>; signal?: AbortSignal; filters?: string[]; }) => Promise<{}>
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
#### action: setError



```js
// Type signature
setError: (error?: unknown) => void
```
#### method: regionCannotBeRenderedText

```js
// Type signature
regionCannotBeRenderedText: (_region: Region) => "" | "Force load to see features"
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
#### action: selectFeature



```js
// Type signature
selectFeature: (feature: Feature) => void
```
#### method: renderProps

```js
// Type signature
renderProps: () => any
```
#### property: bpPerPx


```js
 view.bpPerPx
```
#### property: rpcDriverName


```js
 self.rpcDriverName
```
#### action: clearFeatureSelection



```js
// Type signature
clearFeatureSelection: () => void
```
#### getter: features


a CompositeMap of `featureId -> feature obj` that
just looks in all the block data for that feature
```js
// Type
CompositeMap<unknown, unknown>
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
#### action: clearFeatureSelection



```js
// Type signature
clearFeatureSelection: () => void
```
#### action: setContextMenuFeature



```js
// Type signature
setContextMenuFeature: (feature?: Feature) => void
```
#### getter: features


a CompositeMap of `featureId -> feature obj` that
just looks in all the block data for that feature
```js
// Type
CompositeMap<unknown, unknown>
```
#### action: setFeatureIdUnderMouse



```js
// Type signature
setFeatureIdUnderMouse: (feature: string) => void
```
#### action: setFeatureIdUnderMouse



```js
// Type signature
setFeatureIdUnderMouse: (feature: string) => void
```
#### action: setContextMenuFeature



```js
// Type signature
setContextMenuFeature: (feature?: Feature) => void
```
#### action: clearFeatureSelection



```js
// Type signature
clearFeatureSelection: () => void
```
#### method: renderSvg

```js
// Type signature
renderSvg: (opts: ExportSvgOptions & { overrideHeight: number; }) => Promise<Element>
```
#### method: regionCannotBeRenderedText

```js
// Type signature
regionCannotBeRenderedText: (_region: Region) => "" | "Force load to see features"
```
#### method: regionCannotBeRendered

```js
// Type signature
regionCannotBeRendered: any
```
