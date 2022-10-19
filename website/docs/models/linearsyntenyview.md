---
id: linearsyntenyview
title: LinearSyntenyView
toplevel: true
---

extends the LinearComparativeView base model

#### property: type

```js
type: types.literal('LinearSyntenyView')
```

#### property: drawCurves

```js
drawCurves: false
```

#### action: toggleCurves

```js
// Type signature
toggleCurves: () => void
```

#### method: menuItems

```js
// Type signature
menuItems: () => any[]
```

#### property: id

```js
id: ElementId
```

#### property: type

```js
type: types.string
```

#### property: rpcDriverName

```js
rpcDriverName: types.maybe(types.string)
```

#### getter: RenderingComponent

```js
// Type
React.FC<{ model: { id: string; type: string; rpcDriverName: string; } & NonEmptyObject & { rendererTypeName: string; error: unknown; } & IStateTreeNode<IModelType<{ id: IOptionalIType<ISimpleType<string>, [...]>; type: ISimpleType<...>; rpcDriverName: IMaybe<...>; }, { ...; }, _NotCustomized, _NotCustomized>>; onHo...
```

#### getter: DisplayBlurb

```js
// Type
any
```

#### getter: adapterConfig

```js
// Type
any
```

#### getter: parentTrack

```js
// Type
any
```

#### method: renderProps

the react props that are passed to the Renderer when data
is rendered in this display

```js
// Type signature
renderProps: () => any
```

#### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead,
make this return a react component

```js
// Type
any
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

#### getter: viewMenuActions

```js
// Type
MenuItem[]
```

#### method: regionCannotBeRendered

```js
// Type signature
regionCannotBeRendered: () => any
```

#### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

#### action: setRpcDriverName

```js
// Type signature
setRpcDriverName: (rpcDriverName: string) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```js
// Type signature
reload: () => void
```

#### property: PileupDisplay

refers to LinearPileupDisplay sub-display model

```js
PileupDisplay: types.maybe(
  pluginManager.getDisplayType('LinearPileupDisplay').stateModel,
)
```

#### property: SNPCoverageDisplay

refers to LinearSNPCoverageDisplay sub-display model

```js
SNPCoverageDisplay: types.maybe(
  pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
)
```

#### property: snpCovHeight

```js
snpCovHeight: 45
```

#### property: type

```js
type: types.literal('LinearAlignmentsDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### property: height

```js
height: 250
```

#### property: showCoverage

```js
showCoverage: true
```

#### property: showPileup

```js
showPileup: true
```

#### property: userFeatureScreenDensity

```js
userFeatureScreenDensity: types.maybe(types.number)
```

#### action: toggleCoverage

```js
// Type signature
toggleCoverage: () => void
```

#### action: togglePileup

```js
// Type signature
togglePileup: () => void
```

#### action: setScrollTop

```js
// Type signature
setScrollTop: (scrollTop: number) => void
```

#### action: setSNPCoverageHeight

```js
// Type signature
setSNPCoverageHeight: (n: number) => void
```

#### getter: pileupDisplayConfig

```js
// Type
any
```

#### method: getFeatureByID

```js
// Type signature
getFeatureByID: (blockKey: string, id: string) => any
```

#### method: searchFeatureByID

```js
// Type signature
searchFeatureByID: (id: string) => any
```

#### getter: features

```js
// Type
any
```

#### getter: DisplayBlurb

```js
// Type
any
```

#### getter: sortedBy

```js
// Type
any
```

#### getter: sortedByPosition

```js
// Type
any
```

#### getter: sortedByRefName

```js
// Type
any
```

#### getter: snpCoverageDisplayConfig

```js
// Type
any
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

#### action: setSNPCoverageDisplay

```js
// Type signature
setSNPCoverageDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setUserFeatureScreenDensity

```js
// Type signature
setUserFeatureScreenDensity: (limit: number) => void
```

#### action: setPileupDisplay

```js
// Type signature
setPileupDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
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

#### action: renderSvg

```js
// Type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<Element>
```

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
'staticBlocks' | 'dynamicBlocks'
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

#### getter: regionTooLargeReason

only shows a message of bytes requested is defined, the feature density
based stats don't produce any helpful message besides to zoom in

```js
// Type
string
```

#### action: reload

```js
// Type signature
reload: () => Promise<void>
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

#### method: renderSvg

```js
// Type signature
renderSvg: (opts: ExportSvgOptions & { overrideHeight: number; }) => Promise<Element>
```

#### property: type

```js
type: types.literal('LinearPileupDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### property: showSoftClipping

```js
showSoftClipping: false
```

#### property: featureHeight

```js
featureHeight: types.maybe(types.number)
```

#### property: noSpacing

```js
noSpacing: types.maybe(types.boolean)
```

#### property: fadeLikelihood

```js
fadeLikelihood: types.maybe(types.boolean)
```

#### property: trackMaxHeight

```js
trackMaxHeight: types.maybe(types.number)
```

#### property: mismatchAlpha

```js
mismatchAlpha: types.maybe(types.boolean)
```

#### property: sortedBy

```js
sortedBy: types.maybe(
  types.model({
    type: types.string,
    pos: types.number,
    tag: types.maybe(types.string),
    refName: types.string,
    assemblyName: types.string,
  }),
)
```

#### property: colorBy

```js
colorBy: types.maybe(
  types.model({
    type: types.string,
    tag: types.maybe(types.string),
    extra: types.frozen(),
  }),
)
```

#### action: setReady

```js
// Type signature
setReady: (flag: boolean) => void
```

#### action: setMaxHeight

```js
// Type signature
setMaxHeight: (n: number) => void
```

#### action: setFeatureHeight

```js
// Type signature
setFeatureHeight: (n: number) => void
```

#### action: setNoSpacing

```js
// Type signature
setNoSpacing: (flag: boolean) => void
```

#### action: setColorScheme

```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```

#### action: updateModificationColorMap

```js
// Type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```

#### action: updateColorTagMap

```js
// Type signature
updateColorTagMap: (uniqueTag: string[]) => void
```

#### action: setFeatureUnderMouse

```js
// Type signature
setFeatureUnderMouse: (feat?: Feature) => void
```

#### action: selectFeature

```js
// Type signature
selectFeature: (feature: Feature) => void
```

#### action: clearSelected

```js
// Type signature
clearSelected: () => void
```

#### action: copyFeatureToClipboard

uses copy-to-clipboard and generates notification

```js
// Type signature
copyFeatureToClipboard: (feature: Feature) => void
```

#### action: toggleSoftClipping

```js
// Type signature
toggleSoftClipping: () => void
```

#### action: toggleMismatchAlpha

```js
// Type signature
toggleMismatchAlpha: () => void
```

#### action: setConfig

```js
// Type signature
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setSortedBy

```js
// Type signature
setSortedBy: (type: string, tag?: string) => void
```

#### action: reload

```js
// Type signature
reload: () => void
```

#### getter: maxHeight

```js
// Type
any
```

#### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: featureHeightSetting

```js
// Type
any
```

#### getter: mismatchAlphaSetting

```js
// Type
any
```

#### getter: featureUnderMouse

```js
// Type
Feature
```

#### getter: rendererTypeName

```js
// Type
string
```

#### method: contextMenuItems

```js
// Type signature
contextMenuItems: () => { label: string; icon: any; onClick: () => void; }[]
```

#### getter: DisplayBlurb

```js
// Type
any
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```

#### property: type

```js
type: types.literal('LinearSNPCoverageDisplay')
```

#### property: drawInterbaseCounts

```js
drawInterbaseCounts: types.maybe(types.boolean)
```

#### property: drawIndicators

```js
drawIndicators: types.maybe(types.boolean)
```

#### property: drawArcs

```js
drawArcs: types.maybe(types.boolean)
```

#### property: filterBy

```js
filterBy: types.optional(
  types.model({
    flagInclude: types.optional(types.number, 0),
    flagExclude: types.optional(types.number, 1540),
    readName: types.maybe(types.string),
    tagFilter: types.maybe(
      types.model({ tag: types.string, value: types.string }),
    ),
  }),
  {},
)
```

#### property: colorBy

```js
colorBy: types.maybe(
  types.model({
    type: types.string,
    tag: types.maybe(types.string),
  }),
)
```

#### action: setConfig

```js
// Type signature
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setFilterBy

```js
// Type signature
setFilterBy: (filter: { flagInclude: number; flagExclude: number; readName?: string; tagFilter?: { tag: string; value: string; }; }) => void
```

#### action: setColorBy

```js
// Type signature
setColorBy: (colorBy?: { type: string; tag?: string; }) => void
```

#### action: updateModificationColorMap

```js
// Type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```

#### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: drawArcsSetting

```js
// Type
any
```

#### getter: drawInterbaseCountsSetting

```js
// Type
any
```

#### getter: drawIndicatorsSetting

```js
// Type
any
```

#### getter: modificationsReady

```js
// Type
boolean
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### action: toggleDrawIndicators

```js
// Type signature
toggleDrawIndicators: () => void
```

#### action: toggleDrawInterbaseCounts

```js
// Type signature
toggleDrawInterbaseCounts: () => void
```

#### action: toggleDrawArcs

```js
// Type signature
toggleDrawArcs: () => void
```

#### getter: TooltipComponent

```js
// Type
any
```

#### getter: adapterConfig

```js
// Type
{
  type: string
  subadapter: any
}
```

#### getter: rendererTypeName

```js
// Type
string
```

#### getter: needsScalebar

```js
// Type
boolean
```

#### method: contextMenuItems

```js
// Type signature
contextMenuItems: () => any[]
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```

#### property: type

```js
type: types.literal('LinearWiggleDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### property: selectedRendering

```js
selectedRendering: types.optional(types.string, '')
```

#### property: resolution

```js
resolution: types.optional(types.number, 1)
```

#### property: fill

```js
fill: types.maybe(types.boolean)
```

#### property: minSize

```js
minSize: types.maybe(types.number)
```

#### property: color

```js
color: types.maybe(types.string)
```

#### property: posColor

```js
posColor: types.maybe(types.string)
```

#### property: negColor

```js
negColor: types.maybe(types.string)
```

#### property: summaryScoreMode

```js
summaryScoreMode: types.maybe(types.string)
```

#### property: rendererTypeNameState

```js
rendererTypeNameState: types.maybe(types.string)
```

#### property: scale

```js
scale: types.maybe(types.string)
```

#### property: autoscale

```js
autoscale: types.maybe(types.string)
```

#### property: displayCrossHatches

```js
displayCrossHatches: types.maybe(types.boolean)
```

#### property: constraints

```js
constraints: types.optional(
  types.model({
    max: types.maybe(types.number),
    min: types.maybe(types.number),
  }),
  {},
)
```

#### action: updateStats

```js
// Type signature
updateStats: (stats: { scoreMin: number; scoreMax: number; }) => void
```

#### action: setColor

```js
// Type signature
setColor: (color?: string) => void
```

#### action: setPosColor

```js
// Type signature
setPosColor: (color?: string) => void
```

#### action: setNegColor

```js
// Type signature
setNegColor: (color?: string) => void
```

#### action: setLoading

```js
// Type signature
setLoading: (aborter: AbortController) => void
```

#### action: setResolution

```js
// Type signature
setResolution: (res: number) => void
```

#### action: setFill

```js
// Type signature
setFill: (fill: number) => void
```

#### action: toggleLogScale

```js
// Type signature
toggleLogScale: () => void
```

#### action: setScaleType

```js
// Type signature
setScaleType: (scale?: string) => void
```

#### action: setSummaryScoreMode

```js
// Type signature
setSummaryScoreMode: (val: string) => void
```

#### action: setAutoscale

```js
// Type signature
setAutoscale: (val: string) => void
```

#### action: setMaxScore

```js
// Type signature
setMaxScore: (val?: number) => void
```

#### action: setRendererType

```js
// Type signature
setRendererType: (val: string) => void
```

#### action: setMinScore

```js
// Type signature
setMinScore: (val?: number) => void
```

#### action: toggleCrossHatches

```js
// Type signature
toggleCrossHatches: () => void
```

#### action: setCrossHatches

```js
// Type signature
setCrossHatches: (cross: boolean) => void
```

#### getter: TooltipComponent

```js
// Type
React.FC
```

#### getter: adapterTypeName

```js
// Type
any
```

#### getter: rendererTypeNameSimple

```js
// Type
any
```

#### getter: rendererTypeName

```js
// Type
string
```

#### getter: scaleType

```js
// Type
any
```

#### getter: maxScore

```js
// Type
any
```

#### getter: minScore

```js
// Type
any
```

#### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: filled

```js
// Type
any
```

#### getter: summaryScoreModeSetting

```js
// Type
any
```

#### getter: domain

```js
// Type
number[]
```

#### getter: needsScalebar

```js
// Type
boolean
```

#### getter: scaleOpts

```js
// Type
{
  domain: any
  stats: {
    scoreMin: number
    scoreMax: number
  }
  autoscaleType: any
  scaleType: any
  inverted: any
}
```

#### getter: canHaveFill

```js
// Type
boolean
```

#### getter: autoscaleType

```js
// Type
any
```

#### getter: displayCrossHatchesSetting

```js
// Type
any
```

#### getter: ticks

```js
// Type
{ range: number[]; values: number[]; format: (d: NumberValue) => string; position: ScaleLinear<number, number, never> | ScaleQuantize<number, never>; }
```

#### getter: adapterCapabilities

```js
// Type
string[]
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### getter: hasResolution

```js
// Type
boolean
```

#### getter: hasGlobalStats

```js
// Type
boolean
```

#### getter: fillSetting

```js
// Type
;1 | 2 | 0
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```

#### action: reload

re-runs stats and refresh whole display on reload

```js
// Type signature
reload: () => Promise<void>
```

#### action: renderSvg

```js
// Type signature
renderSvg: (opts: ExportSvgOptions & { overrideHeight: number; }) => Promise<Element>
```
