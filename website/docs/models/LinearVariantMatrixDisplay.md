---
id: linearvariantmatrixdisplay
title: LinearVariantMatrixDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/MultiLinearVariantMatrixDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearVariantMatrixDisplay.md)

## Docs

extends

- [MultiVariantBaseModel](../multivariantbasemodel)

### LinearVariantMatrixDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearVariantMatrixDisplay">
// code
type: types.literal('LinearVariantMatrixDisplay')
```

#### property: rowHeightSetting

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
rowHeightSetting: types.optional(types.number, 1)
```

#### property: lineZoneHeight

```js
// type signature
number
// code
lineZoneHeight: 20
```

### LinearVariantMatrixDisplay - Getters

#### getter: nrow

```js
// type
number
```

#### getter: blockType

```js
// type
string
```

#### getter: totalHeight

```js
// type
number
```

#### getter: rowHeight

```js
// type
number
```

#### getter: featuresReady

```js
// type
boolean
```

#### getter: canDisplayLabels

```js
// type
boolean
```

### LinearVariantMatrixDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

### LinearVariantMatrixDisplay - Actions

#### action: setLineZoneHeight

```js
// type signature
setLineZoneHeight: (n: number) => number
```

#### action: setLineZoneHeight

```js
// type signature
setLineZoneHeight: (n: number) => number
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```
