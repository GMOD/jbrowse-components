---
id: linearvariantmatrixdisplay
title: LinearVariantMatrixDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
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

#### property: lineZoneHeight

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
lineZoneHeight: types.optional(types.number, 20)
```

### LinearVariantMatrixDisplay - Getters

#### getter: blockType

```js
// type
string
```

#### getter: prefersOffset

positions multi-row below the tracklabel even if using overlap tracklabels

```js
// type
boolean
```

#### getter: featureWidgetType

```js
// type
{
  type: string
  id: string
}
```

### LinearVariantMatrixDisplay - Methods

#### method: renderProps

Override renderProps to pass the correct height for the matrix renderer

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

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```
