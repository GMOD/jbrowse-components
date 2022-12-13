---
id: linearreadarcsdisplay
title: LinearReadArcsDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Docs

extends `BaseLinearDisplay`

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

#### property: lineWidth

```js
// type signature
IMaybe<ISimpleType<number>>
// code
lineWidth: types.maybe(types.number)
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

### LinearReadArcsDisplay - Getters

#### getter: ready

```js
// type
boolean
```

### LinearReadArcsDisplay - Methods

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

### LinearReadArcsDisplay - Actions

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

#### action: setLineWidth

```js
// type signature
setLineWidth: (n: number) => void
```
