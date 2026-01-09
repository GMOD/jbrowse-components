---
id: baselineardisplay
title: BaseLinearDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseLinearDisplay.md)

## Docs

BaseLinearDisplay is used as the basis for many linear genome view tracks. It is
block based, and can use 'static blocks' or 'dynamic blocks'

extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)

### BaseLinearDisplay - Properties

#### property: blockState

updated via autorun

```js
// type signature
IMapType<IModelType<{ key: ISimpleType<string>; region: IType<Region, Region, Region>; reloadFlag: IType<number, number, number>; isLeftEndOfDisplayedRegion: IType<boolean, boolean, boolean>; isRightEndOfDisplayedRegion: IType<...>; }, { ...; } & ... 2 more ... & { ...; }, _NotCustomized, _NotCustomized>>
// code
blockState: types.map(BlockState)
```

#### property: configuration

```js
// type signature
any
// code
configuration: ConfigurationReference(configSchema)
```

#### property: showLegend

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showLegend: types.maybe(types.boolean)
```

#### property: showTooltips

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showTooltips: types.maybe(types.boolean)
```

### BaseLinearDisplay - Getters

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead of the blocks, make this
return a react component

```js
// type
any
```

#### getter: blockType

```js
// type
'staticBlocks' | 'dynamicBlocks'
```

#### getter: blockDefinitions

```js
// type
any
```

#### getter: renderDelay

how many milliseconds to wait for the display to "settle" before re-rendering a
block

```js
// type
number
```

#### getter: TooltipComponent

```js
// type
AnyReactComponentType
```

#### getter: selectedFeatureId

returns a string feature ID if the globally-selected object is probably a
feature

```js
// type
any
```

#### getter: featureWidgetType

Override in subclasses to use a different feature widget

```js
// type
{
  type: string
  id: string
}
```

#### getter: showTooltipsEnabled

whether to show tooltips on mouseover, defaults to true

```js
// type
boolean
```

#### getter: features

a CompositeMap of `featureId -> feature obj` that just looks in all the block
data for that feature

```js
// type
any
```

#### getter: featureUnderMouse

```js
// type
any
```

#### getter: layoutFeatures

```js
// type
any
```

#### getter: getFeatureOverlapping

```js
// type
(blockKey: string, x: number, y: number) => string
```

#### getter: getFeatureByID

```js
// type
(blockKey: string, id: string) => LayoutRecord
```

#### getter: searchFeatureByID

```js
// type
(id: string) => LayoutRecord
```

#### getter: floatingLabelData

Deduplicated floating label data, computed and cached by MobX

```js
// type
Map<string, FeatureLabelData>
```

### BaseLinearDisplay - Methods

#### method: legendItems

Override in subclasses to provide legend items for the display

```js
// type signature
legendItems: (_theme?: Theme) => LegendItem[]
```

#### method: svgLegendWidth

Returns the width needed for the SVG legend if showLegend is enabled. Used by
SVG export to add extra width for the legend area.

```js
// type signature
svgLegendWidth: (theme?: Theme) => number
```

#### method: getFeatureById

Finds a feature by ID, checking both top-level features and subfeatures if
parentFeatureId is provided

```js
// type signature
getFeatureById: (featureId: string, parentFeatureId?: string) => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => MenuItem[]
```

#### method: renderingProps

props for the renderer's React "Rendering" component - client-side only, never
sent to the worker. includes displayModel and callbacks

```js
// type signature
renderingProps: () => { displayModel: { [x: string]: any; heightPreConfig: number; userBpPerPxLimit: number; userByteSizeLimit: number; blockState: IMSTMap<IModelType<{ key: ISimpleType<string>; region: IType<...>; reloadFlag: IType<...>; isLeftEndOfDisplayedRegion: IType<...>; isRightEndOfDisplayedRegion: IType<...>; }, { ...; } &...
```

#### method: renderProps

props sent to the worker for server-side rendering

```js
// type signature
renderProps: () => any
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```

### BaseLinearDisplay - Actions

#### action: addBlock

```js
// type signature
addBlock: (key: string, block: BaseBlock) => void
```

#### action: deleteBlock

```js
// type signature
deleteBlock: (key: string) => void
```

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: navToFeature

```js
// type signature
navToFeature: (feature: Feature) => void
```

#### action: clearFeatureSelection

```js
// type signature
clearFeatureSelection: () => void
```

#### action: setFeatureIdUnderMouse

```js
// type signature
setFeatureIdUnderMouse: (feature?: string) => void
```

#### action: setSubfeatureIdUnderMouse

```js
// type signature
setSubfeatureIdUnderMouse: (subfeatureId?: string) => void
```

#### action: setContextMenuFeature

```js
// type signature
setContextMenuFeature: (feature?: Feature) => void
```

#### action: setMouseoverExtraInformation

```js
// type signature
setMouseoverExtraInformation: (extra?: string) => void
```

#### action: setShowLegend

```js
// type signature
setShowLegend: (s: boolean) => void
```

#### action: setShowTooltips

```js
// type signature
setShowTooltips: (arg: boolean) => void
```

#### action: reload

```js
// type signature
reload: () => Promise<void>
```

#### action: selectFeatureById

Select a feature by ID, looking up in features map and subfeatures. Falls back
to RPC if not found locally (e.g., for canvas renderer).

```js
// type signature
selectFeatureById: (featureId: string, parentFeatureId?: string, topLevelFeatureId?: string) => Promise<void>
```

#### action: setContextMenuFeatureById

Set context menu feature by ID, looking up in features map and subfeatures.
Falls back to RPC if not found locally (e.g., for canvas renderer).

```js
// type signature
setContextMenuFeatureById: (featureId: string, parentFeatureId?: string, topLevelFeatureId?: string) => Promise<void>
```
