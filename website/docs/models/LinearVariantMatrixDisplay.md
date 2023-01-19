---
id: linearvariantmatrixdisplay
title: LinearVariantMatrixDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[plugins/variants/src/LinearVariantMatrixDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantMatrixDisplay/model.ts)

## Docs

extends `LinearBasicDisplay`

### LinearVariantMatrixDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearVariantMatrixDisplay">
// code
type: types.literal('LinearVariantMatrixDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### LinearVariantMatrixDisplay - Getters

#### getter: blockType

```js
// type
string
```

#### getter: renderDelay

```js
// type
number
```

### LinearVariantMatrixDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

### LinearVariantMatrixDisplay - Actions

#### action: setSamples

```js
// type signature
setSamples: (arg: string[]) => void
```
