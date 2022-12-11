---
id: linearreadclouddisplay
title: LinearReadCloudDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

## Docs

extends `BaseLinearDisplay`

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
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: filterBy

```js
// type signature
IOptionalIType<IModelType<{ flagInclude: IOptionalIType<ISimpleType<number>, [undefined]>; flagExclude: IOptionalIType<ISimpleType<number>, [undefined]>; readName: IMaybe<...>; tagFilter: IMaybe<...>; }, {}, _NotCustomized, _NotCustomized>, [...]>
// code
filterBy: types.optional(FilterModel, {})
```

#### property: colorBy

```js
// type signature
IMaybe<IModelType<{ type: ISimpleType<string>; tag: IMaybe<ISimpleType<string>>; extra: IType<any, any, any>; }, {}, _NotCustomized, _NotCustomized>>
// code
colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
            extra: types.frozen(),
          }),
        )
```

### LinearReadCloudDisplay - Getters

#### getter: ready

```js
// type
boolean
```

### LinearReadCloudDisplay - Methods

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgOptions) => Promise<Element>
```

### LinearReadCloudDisplay - Actions

#### action: setRef

```js
// type signature
setRef: (ref: HTMLCanvasElement) => void
```

#### action: setChainData

```js
// type signature
setChainData: (args: ChainData) => void
```

#### action: setLoading

```js
// type signature
setLoading: (f: boolean) => void
```

#### action: setDrawn

```js
// type signature
setDrawn: (f: boolean) => void
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filter: Filter) => void
```

#### action: setLastDrawnOffsetPx

```js
// type signature
setLastDrawnOffsetPx: (n: number) => void
```
