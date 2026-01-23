---
id: linearreadclouddisplay
title: LinearReadCloudDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadCloudDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearReadCloudDisplay.md)

## Docs

it is not a block based track, hence not BaseLinearDisplay extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)

### LinearReadCloudDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearReadCloudDisplay">
// code
type: types.literal('LinearReadCloudDisplay')
```

#### property: configuration

```js
// type signature
any
// code
configuration: ConfigurationReference(configSchema)
```

#### property: drawCloud

```js
// type signature
false
// code
drawCloud: false
```

#### property: noSpacing

Whether to remove spacing between stacked features

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
noSpacing: types.maybe(types.boolean)
```

#### property: trackMaxHeight

Maximum height for the layout (prevents infinite stacking)

```js
// type signature
IMaybe<ISimpleType<number>>
// code
trackMaxHeight: types.maybe(types.number)
```

#### property: hideSmallIndelsSetting

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
hideSmallIndelsSetting: types.maybe(types.boolean)
```

#### property: hideMismatchesSetting

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
hideMismatchesSetting: types.maybe(types.boolean)
```

#### property: hideLargeIndelsSetting

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
hideLargeIndelsSetting: types.maybe(types.boolean)
```

#### property: showLegend

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showLegend: types.maybe(types.boolean)
```

#### property: showYScalebar

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showYScalebar: types.optional(types.boolean, true)
```

#### property: showOutline

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showOutline: types.optional(types.boolean, true)
```

### LinearReadCloudDisplay - Getters

#### getter: colorBy

Get the color settings (from override or configuration)

```js
// type
any
```

#### getter: filterBy

Get the filter settings (from override or configuration)

```js
// type
any
```

#### getter: featureHeightSetting

```js
// type
any
```

#### getter: hideSmallIndels

```js
// type
any
```

#### getter: hideMismatches

```js
// type
any
```

#### getter: hideLargeIndels

```js
// type
any
```

#### getter: modificationThreshold

```js
// type
any
```

#### getter: cloudTicks

Calculate ticks for the y-axis scalebar in cloud mode

```js
// type
CloudTicks
```

### LinearReadCloudDisplay - Methods

#### method: legendItems

Returns legend items based on current colorBy setting

```js
// type signature
legendItems: () => LegendItem[]
```

#### method: svgLegendWidth

Returns the width needed for the SVG legend if showLegend is enabled. Used by
SVG export to add extra width for the legend area.

```js
// type signature
svgLegendWidth: () => number
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => any[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>
```

### LinearReadCloudDisplay - Actions

#### action: reload

Reload the display (clears error state)

```js
// type signature
reload: () => void
```

#### action: setNoSpacing

Set whether to remove spacing between features

```js
// type signature
setNoSpacing: (flag?: boolean) => void
```

#### action: setMaxHeight

Set the maximum height for the layout

```js
// type signature
setMaxHeight: (n?: number) => void
```

#### action: setLayoutHeight

Set the current layout height

```js
// type signature
setLayoutHeight: (n: number) => void
```

#### action: setCloudMaxDistance

Set the max distance for cloud mode scale Only updates if value differs by more
than EPSILON to avoid infinite re-renders

```js
// type signature
setCloudMaxDistance: (maxDistance: number) => void
```

#### action: setShowYScalebar

```js
// type signature
setShowYScalebar: (show: boolean) => void
```

#### action: setShowOutline

```js
// type signature
setShowOutline: (show: boolean) => void
```

#### action: selectFeature

```js
// type signature
selectFeature: (chain: ReducedFeature[]) => void
```

#### action: setDrawCloud

```js
// type signature
setDrawCloud: (b: boolean) => void
```

#### action: setSelectedFeatureId

Set the ID of the selected feature for persistent highlighting

```js
// type signature
setSelectedFeatureId: (id: string) => void
```

#### action: setHideSmallIndels

```js
// type signature
setHideSmallIndels: (arg: boolean) => void
```

#### action: setHideMismatches

```js
// type signature
setHideMismatches: (arg: boolean) => void
```

#### action: setHideLargeIndels

```js
// type signature
setHideLargeIndels: (arg: boolean) => void
```

#### action: setShowLegend

```js
// type signature
setShowLegend: (s: boolean) => void
```
