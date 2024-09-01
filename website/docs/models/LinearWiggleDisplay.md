---
id: linearwiggledisplay
title: LinearWiggleDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/wiggle/src/LinearWiggleDisplay/models/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/models/model.ts)

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

### LinearWiggleDisplay - Getters

#### getter: TooltipComponent

```js
// type
React.FC
```

#### getter: rendererTypeName

```js
// type
string
```

#### getter: ticks

```js
// type
{ range: number[]; values: number[]; format: (d: NumberValue) => string; position: ScaleLinear<number, number, never> | ScaleQuantize<number, never>; }
```

#### getter: needsScalebar

```js
// type
boolean
```

#### getter: fillSetting

```js
// type
;1 | 0 | 2
```

### LinearWiggleDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; })[]
```

### LinearWiggleDisplay - Actions

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```
