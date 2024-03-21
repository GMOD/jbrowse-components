---
id: linearreadclouddisplay
title: LinearReadCloudDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/alignments/src/LinearReadCloudDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadCloudDisplay/model.ts)

it is not a block based track, hence not BaseLinearDisplay extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)

### LinearReadCloudDisplay - Properties

#### property: colorBy

```js
// type signature
IMaybe<IModelType<{ extra: IType<any, any, any>; tag: IMaybe<ISimpleType<string>>; type: ISimpleType<string>; }, {}, _NotCustomized, _NotCustomized>>
// code
colorBy: types.maybe(
          types.model({
            extra: types.frozen(),
            tag: types.maybe(types.string),
            type: types.string,
          }),
        )
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: drawSingletons

```js
// type signature
true
// code
drawSingletons: true
```

#### property: filterBy

```js
// type signature
IOptionalIType<IModelType<{ flagExclude: IOptionalIType<ISimpleType<number>, [undefined]>; flagInclude: IOptionalIType<ISimpleType<number>, [undefined]>; readName: IMaybe<...>; tagFilter: IMaybe<...>; }, {}, _NotCustomized, _NotCustomized>, [...]>
// code
filterBy: types.optional(FilterModel, {})
```

#### property: type

```js
// type signature
ISimpleType<"LinearReadCloudDisplay">
// code
type: types.literal('LinearReadCloudDisplay')
```

### LinearReadCloudDisplay - Methods

#### method: renderSvg

```js
// type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<React.ReactNode>
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### LinearReadCloudDisplay - Actions

#### action: reload

```js
// type signature
reload: () => void
```

#### action: setChainData

```js
// type signature
setChainData: (args: ChainData) => void
```

#### action: setDrawSingletons

```js
// type signature
setDrawSingletons: (f: boolean) => void
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filter: IFilter) => void
```

#### action: setLastDrawnBpPerPx

```js
// type signature
setLastDrawnBpPerPx: (n: number) => void
```

#### action: setLastDrawnOffsetPx

```js
// type signature
setLastDrawnOffsetPx: (n: number) => void
```

#### action: setLoading

```js
// type signature
setLoading: (f: boolean) => void
```

#### action: setRef

internal, a reference to a HTMLCanvas because we use a autorun to draw the
canvas

```js
// type signature
setRef: (ref: HTMLCanvasElement) => void
```
