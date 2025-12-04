---
id: linearreadarcsdisplay
title: LinearReadArcsDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadArcsDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearReadArcsDisplay.md)

## Docs

the arc display is a non-block-based track, so draws to a single canvas and can
connect multiple regions extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)

### LinearReadArcsDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearReadArcsDisplay">
// code
type: types.literal('LinearReadArcsDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: lineWidth

Width of the arc lines (thin, bold, extra bold)

```js
// type signature
IMaybe<ISimpleType<number>>
// code
lineWidth: types.maybe(types.number)
```

#### property: jitter

Jitter amount for x-position to better visualize overlapping arcs

```js
// type signature
IMaybe<ISimpleType<number>>
// code
jitter: types.maybe(types.number)
```

#### property: drawInter

Whether to draw inter-region vertical lines

```js
// type signature
true
// code
drawInter: true
```

#### property: drawLongRange

Whether to draw long-range connections

```js
// type signature
true
// code
drawLongRange: true
```

### LinearReadArcsDisplay - Getters

#### getter: colorBy

```js
// type
any
```

#### getter: filterBy

```js
// type
any
```

#### getter: lineWidthSetting

```js
// type
any
```

#### getter: jitterVal

```js
// type
number
```

### LinearReadArcsDisplay - Methods

#### method: renderProps

only used to tell system it's ready for export

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; } | { ...; })[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>
```

### LinearReadArcsDisplay - Actions

#### action: reload

```js
// type signature
reload: () => void
```

#### action: setDrawInter

Toggle drawing of inter-region vertical lines

```js
// type signature
setDrawInter: (f: boolean) => void
```

#### action: setDrawLongRange

Toggle drawing of long-range connections

```js
// type signature
setDrawLongRange: (f: boolean) => void
```

#### action: setLineWidth

Set the line width (thin=1, bold=2, extrabold=5, etc)

```js
// type signature
setLineWidth: (n: number) => void
```

#### action: setJitter

Set jitter amount for x-position Helpful to jitter the x direction so you see
better evidence when e.g. 100 long reads map to same x position

```js
// type signature
setJitter: (n: number) => void
```

#### action: setRenderingImageData

Set the rendering imageData from RPC

```js
// type signature
setRenderingImageData: (imageData: ImageBitmap) => void
```

#### action: setRenderingStopToken

Set the rendering stop token

```js
// type signature
setRenderingStopToken: (token: string) => void
```
