---
id: linearreadarcsdisplay
title: LinearReadArcsDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[plugins/alignments/src/LinearReadArcsDisplay/model.tsx](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadArcsDisplay/model.tsx)

## Docs

extends `BaseDisplay`, it is not a block based track, hence not
BaseLinearDisplay

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

#### property: jitter

```js
// type signature
IMaybe<ISimpleType<number>>
// code
jitter: types.maybe(types.number)
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

#### property: drawInter

```js
// type signature
true
// code
drawInter: true
```

#### property: drawLongRange

```js
// type signature
true
// code
drawLongRange: true
```

### LinearReadArcsDisplay - Getters

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
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; })[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<React.ReactNode>
```

### LinearReadArcsDisplay - Actions

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

#### action: setColorScheme

```js
// type signature
setColorScheme: (s: { type: string; }) => void
```

#### action: setChainData

```js
// type signature
setChainData: (args: ChainData) => void
```

#### action: setDrawInter

```js
// type signature
setDrawInter: (f: boolean) => void
```

#### action: setDrawLongRange

```js
// type signature
setDrawLongRange: (f: boolean) => void
```

#### action: setLoading

```js
// type signature
setLoading: (f: boolean) => void
```

#### action: setDrawn

used during tests to detect when we can complete a snapshot test

```js
// type signature
setDrawn: (f: boolean) => void
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filter: Filter) => void
```

#### action: setLineWidth

thin, bold, extrabold, etc

```js
// type signature
setLineWidth: (n: number) => void
```

#### action: setJitter

jitter val, helpful to jitter the x direction so you see better evidence when
e.g. 100 long reads map to same x position

```js
// type signature
setJitter: (n: number) => void
```
