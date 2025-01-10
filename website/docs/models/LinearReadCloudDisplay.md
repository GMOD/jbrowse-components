---
id: linearreadclouddisplay
title: LinearReadCloudDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
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
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: filterBySetting

```js
// type signature
IType<FilterBy, FilterBy, FilterBy>
// code
filterBySetting: types.frozen<FilterBy | undefined>()
```

#### property: colorBySetting

```js
// type signature
IType<ColorBy, ColorBy, ColorBy>
// code
colorBySetting: types.frozen<ColorBy | undefined>()
```

#### property: drawSingletons

```js
// type signature
true
// code
drawSingletons: true
```

### LinearReadCloudDisplay - Getters

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

### LinearReadCloudDisplay - Methods

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; })[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<React.ReactNode>
```

### LinearReadCloudDisplay - Actions

#### action: setDrawSingletons

```js
// type signature
setDrawSingletons: (f: boolean) => void
```

#### action: setLastDrawnOffsetPx

```js
// type signature
setLastDrawnOffsetPx: (n: number) => void
```

#### action: setLastDrawnBpPerPx

```js
// type signature
setLastDrawnBpPerPx: (n: number) => void
```

#### action: setLoading

```js
// type signature
setLoading: (f: boolean) => void
```

#### action: reload

```js
// type signature
reload: () => void
```

#### action: setRef

internal, a reference to a HTMLCanvas because we use a autorun to draw the
canvas

```js
// type signature
setRef: (ref: HTMLCanvasElement) => void
```

#### action: setChainData

```js
// type signature
setChainData: (args: ChainData) => void
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filter: FilterBy) => void
```
