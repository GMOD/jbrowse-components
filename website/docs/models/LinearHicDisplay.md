---
id: linearhicdisplay
title: LinearHicDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearHicDisplay.md)

## Docs

Non-block-based Hi-C display that renders to a single canvas extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)
- [NonBlockCanvasDisplayMixin](../nonblockcanvasdisplaymixin)

### LinearHicDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearHicDisplay">
// code
type: types.literal('LinearHicDisplay')
```

#### property: configuration

```js
// type signature
any
// code
configuration: ConfigurationReference(configSchema)
```

#### property: resolution

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
resolution: types.optional(types.number, 1)
```

#### property: useLogScale

```js
// type signature
false
// code
useLogScale: false
```

#### property: colorScheme

```js
// type signature
IMaybe<ISimpleType<string>>
// code
colorScheme: types.maybe(types.string)
```

#### property: activeNormalization

```js
// type signature
string
// code
activeNormalization: 'KR'
```

#### property: mode

```js
// type signature
string
// code
mode: 'triangular'
```

#### property: showLegend

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showLegend: types.maybe(types.boolean)
```

### LinearHicDisplay - Getters

#### getter: rendererTypeName

```js
// type
string
```

### LinearHicDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: legendItems

Returns legend items for the Hi-C color scale

```js
// type signature
legendItems: () => LegendItem[]
```

#### method: svgLegendWidth

Returns the width needed for the SVG legend if showLegend is enabled.

```js
// type signature
svgLegendWidth: () => number
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

### LinearHicDisplay - Actions

#### action: setFlatbushData

```js
// type signature
setFlatbushData: (flatbush: ArrayBufferLike, items: HicFlatbushItem[], maxScore: number, yScalar: number) => void
```

#### action: reload

```js
// type signature
reload: () => void
```

#### action: setResolution

```js
// type signature
setResolution: (n: number) => void
```

#### action: setUseLogScale

```js
// type signature
setUseLogScale: (f: boolean) => void
```

#### action: setColorScheme

```js
// type signature
setColorScheme: (f?: string) => void
```

#### action: setActiveNormalization

```js
// type signature
setActiveNormalization: (f: string) => void
```

#### action: setAvailableNormalizations

```js
// type signature
setAvailableNormalizations: (f: string[]) => void
```

#### action: setMode

```js
// type signature
setMode: (arg: string) => void
```

#### action: setShowLegend

```js
// type signature
setShowLegend: (arg: boolean) => void
```
