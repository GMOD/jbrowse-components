---
id: linearwiggledisplay
title: LinearWiggleDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearWiggleDisplay.md)

## Docs

extends

- [SharedWiggleMixin](../sharedwigglemixin)

### LinearWiggleDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearWiggleDisplay">
// code
type: types.literal('LinearWiggleDisplay')
```

#### property: invertedSetting

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
invertedSetting: types.maybe(types.boolean)
```

### LinearWiggleDisplay - Getters

#### getter: TooltipComponent

```js
// type
React.ComponentType<any>
```

#### getter: rendererTypeName

```js
// type
string
```

#### getter: quantitativeStatsRelevantToCurrentZoom

unused currently

```js
// type
boolean
```

#### getter: graphType

```js
// type
boolean
```

#### getter: inverted

```js
// type
boolean
```

#### getter: ticks

```js
// type
{ range: number[]; values: number[]; format: (d: NumberValue) => string; position: ScaleLinear<number, number, never> | ScaleQuantize<number, never>; }
```

#### getter: fillSetting

```js
// type
;0 | 1 | 2
```

#### getter: quantitativeStatsReady

```js
// type
boolean
```

### LinearWiggleDisplay - Methods

#### method: adapterProps

```js
// type signature
adapterProps: () => any
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | ... 4 more ... | { ...; })[]
```

### LinearWiggleDisplay - Actions

#### action: setInverted

```js
// type signature
setInverted: (arg: boolean) => void
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```
