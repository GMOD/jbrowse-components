---
id: sharedldmodel
title: SharedLDModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/shared.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SharedLDModel.md)

## Docs

Shared state model for LD displays extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [NonBlockCanvasDisplayMixin](../nonblockcanvasdisplaymixin)

### SharedLDModel - Properties

#### property: configuration

```js
// type signature
any
// code
configuration: ConfigurationReference(configSchema)
```

#### property: minorAlleleFrequencyFilterSetting

When undefined, falls back to config value

```js
// type signature
IMaybe<ISimpleType<number>>
// code
minorAlleleFrequencyFilterSetting: types.maybe(types.number)
```

#### property: lengthCutoffFilterSetting

When undefined, falls back to config value

```js
// type signature
IMaybe<ISimpleType<number>>
// code
lengthCutoffFilterSetting: types.maybe(types.number)
```

#### property: lineZoneHeightSetting

When undefined, falls back to config value Height of the zone for connecting
lines at the top

```js
// type signature
IMaybe<ISimpleType<number>>
// code
lineZoneHeightSetting: types.maybe(types.number)
```

#### property: ldMetricSetting

When undefined, falls back to config value LD metric to compute: 'r2' (squared
correlation) or 'dprime' (normalized D)

```js
// type signature
IMaybe<ISimpleType<string>>
// code
ldMetricSetting: types.maybe(types.string)
```

#### property: colorSchemeSetting

When undefined, falls back to config value

```js
// type signature
IMaybe<ISimpleType<string>>
// code
colorSchemeSetting: types.maybe(types.string)
```

#### property: showLegendSetting

When undefined, falls back to config value

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showLegendSetting: types.maybe(types.boolean)
```

#### property: showLDTriangleSetting

When undefined, falls back to config value Whether to show the LD triangle
heatmap

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showLDTriangleSetting: types.maybe(types.boolean)
```

#### property: showRecombinationSetting

When undefined, falls back to config value Whether to show the recombination
rate track

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showRecombinationSetting: types.maybe(types.boolean)
```

#### property: recombinationZoneHeightSetting

When undefined, falls back to config value Height of the recombination track
zone at the top

```js
// type signature
IMaybe<ISimpleType<number>>
// code
recombinationZoneHeightSetting: types.maybe(types.number)
```

#### property: fitToHeightSetting

When undefined, falls back to config value When true, squash the LD triangle to
fit the display height

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
fitToHeightSetting: types.maybe(types.boolean)
```

#### property: hweFilterThresholdSetting

When undefined, falls back to config value HWE filter p-value threshold
(variants with HWE p < this are excluded) Set to 0 to disable HWE filtering

```js
// type signature
IMaybe<ISimpleType<number>>
// code
hweFilterThresholdSetting: types.maybe(types.number)
```

#### property: callRateFilterSetting

When undefined, falls back to config value Call rate filter threshold (0-1).
Variants with fewer than this proportion of non-missing genotypes are excluded.

```js
// type signature
IMaybe<ISimpleType<number>>
// code
callRateFilterSetting: types.maybe(types.number)
```

#### property: showVerticalGuidesSetting

When undefined, falls back to config value Whether to show vertical guides at
the connected genome positions on hover

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showVerticalGuidesSetting: types.maybe(types.boolean)
```

#### property: showLabelsSetting

When undefined, falls back to config value Whether to show variant labels above
the tick marks

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showLabelsSetting: types.maybe(types.boolean)
```

#### property: tickHeightSetting

When undefined, falls back to config value Height of the vertical tick marks at
the genomic position

```js
// type signature
IMaybe<ISimpleType<number>>
// code
tickHeightSetting: types.maybe(types.number)
```

#### property: useGenomicPositionsSetting

When undefined, falls back to config value When true, draw cells sized according
to genomic distance between SNPs rather than uniform squares

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
useGenomicPositionsSetting: types.maybe(types.boolean)
```

#### property: signedLDSetting

When undefined, falls back to config value When true, show signed LD values (-1
to 1) instead of absolute values

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
signedLDSetting: types.maybe(types.boolean)
```

#### property: jexlFiltersSetting

When undefined, falls back to config value JEXL filter expressions to apply to
variants

```js
// type signature
IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFiltersSetting: types.maybe(types.array(types.string))
```

### SharedLDModel - Getters

#### getter: blockType

```js
// type
string
```

#### getter: prefersOffset

```js
// type
boolean
```

#### getter: rendererTypeName

```js
// type
string
```

#### getter: rendererConfig

```js
// type
any
```

#### getter: regionTooLarge

```js
// type
boolean
```

#### getter: minorAlleleFrequencyFilter

Returns the effective minor allele frequency filter, falling back to config

```js
// type
any
```

#### getter: lengthCutoffFilter

Returns the effective length cutoff filter, falling back to config

```js
// type
any
```

#### getter: lineZoneHeight

Returns the effective line zone height, falling back to config

```js
// type
any
```

#### getter: ldMetric

Returns the effective LD metric, falling back to config

```js
// type
any
```

#### getter: colorScheme

Returns the effective color scheme, falling back to config

```js
// type
any
```

#### getter: showLegend

Returns the effective show legend setting, falling back to config

```js
// type
any
```

#### getter: showLDTriangle

Returns the effective show LD triangle setting, falling back to config

```js
// type
any
```

#### getter: showRecombination

Returns the effective show recombination setting, falling back to config

```js
// type
any
```

#### getter: recombinationZoneHeight

Returns the effective recombination zone height, falling back to config

```js
// type
any
```

#### getter: fitToHeight

Returns the effective fit to height setting, falling back to config

```js
// type
any
```

#### getter: hweFilterThreshold

Returns the effective HWE filter threshold, falling back to config

```js
// type
any
```

#### getter: callRateFilter

Returns the effective call rate filter threshold, falling back to config

```js
// type
any
```

#### getter: showVerticalGuides

Returns the effective show vertical guides setting, falling back to config

```js
// type
any
```

#### getter: showLabels

Returns the effective show labels setting, falling back to config

```js
// type
any
```

#### getter: tickHeight

Returns the effective tick height, falling back to config

```js
// type
any
```

#### getter: useGenomicPositions

Returns the effective use genomic positions setting, falling back to config

```js
// type
any
```

#### getter: signedLD

Returns the effective signed LD setting, falling back to config

```js
// type
any
```

#### getter: jexlFilters

Returns the effective jexl filters, falling back to config

```js
// type
any
```

#### getter: isPrecomputedLD

Returns true if this display uses pre-computed LD data (PLINK, ldmat) rather
than computing LD from VCF genotypes

```js
// type
boolean
```

#### getter: ldCanvasHeight

Effective height for the LD canvas (total height minus line zone) Note:
Recombination track is overlaid on the line zone, not in a separate zone

```js
// type
number
```

### SharedLDModel - Methods

#### method: regionCannotBeRendered

```js
// type signature
regionCannotBeRendered: () => any
```

#### method: filterMenuItems

```js
// type signature
filterMenuItems: () => { label: string; onClick: () => void; }[]
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

### SharedLDModel - Actions

#### action: setFlatbushData

```js
// type signature
setFlatbushData: (flatbush: ArrayBufferLike, items: LDFlatbushItem[], snps: { id: string; refName: string; start: number; end: number; }[], maxScore: number, yScalar: number, cellWidth: number) => void
```

#### action: setLineZoneHeight

```js
// type signature
setLineZoneHeight: (n: number) => void
```

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```

#### action: reload

```js
// type signature
reload: () => void
```

#### action: setMafFilter

```js
// type signature
setMafFilter: (arg: number) => void
```

#### action: setLengthCutoffFilter

```js
// type signature
setLengthCutoffFilter: (arg: number) => void
```

#### action: setLDMetric

```js
// type signature
setLDMetric: (metric: string) => void
```

#### action: setColorScheme

```js
// type signature
setColorScheme: (scheme: string) => void
```

#### action: setShowLegend

```js
// type signature
setShowLegend: (show: boolean) => void
```

#### action: setShowLDTriangle

```js
// type signature
setShowLDTriangle: (show: boolean) => void
```

#### action: setShowRecombination

```js
// type signature
setShowRecombination: (show: boolean) => void
```

#### action: setRecombinationZoneHeight

```js
// type signature
setRecombinationZoneHeight: (n: number) => void
```

#### action: setFitToHeight

```js
// type signature
setFitToHeight: (value: boolean) => void
```

#### action: setHweFilter

```js
// type signature
setHweFilter: (threshold: number) => void
```

#### action: setCallRateFilter

```js
// type signature
setCallRateFilter: (threshold: number) => void
```

#### action: setFilterStats

```js
// type signature
setFilterStats: (stats: FilterStats) => void
```

#### action: setRecombination

```js
// type signature
setRecombination: (data: { values: number[]; positions: number[]; }) => void
```

#### action: setShowVerticalGuides

```js
// type signature
setShowVerticalGuides: (show: boolean) => void
```

#### action: setShowLabels

```js
// type signature
setShowLabels: (show: boolean) => void
```

#### action: setTickHeight

```js
// type signature
setTickHeight: (height: number) => void
```

#### action: setUseGenomicPositions

```js
// type signature
setUseGenomicPositions: (value: boolean) => void
```

#### action: setSignedLD

```js
// type signature
setSignedLD: (value: boolean) => void
```

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (filters: string[]) => void
```
