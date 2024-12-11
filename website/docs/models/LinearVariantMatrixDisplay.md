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

- [LinearBasicDisplay](../linearbasicdisplay)

### LinearVariantMatrixDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearVariantMatrixDisplay">
// code
type: types.literal('LinearVariantMatrixDisplay')
```

#### property: layout

```js
// type signature
IOptionalIType<IType<Source[], Source[], Source[]>, [undefined]>
// code
layout: types.optional(types.frozen<Source[]>(), [])
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: mafFilter

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
mafFilter: types.optional(types.number, 0.1)
```

#### property: showSidebarLabelsSetting

```js
// type signature
true
// code
showSidebarLabelsSetting: true
```

### LinearVariantMatrixDisplay - Getters

#### getter: sources

```js
// type
any
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

#### getter: canDisplayLabels

```js
// type
boolean
```

### LinearVariantMatrixDisplay - Methods

#### method: adapterProps

```js
// type signature
adapterProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

### LinearVariantMatrixDisplay - Actions

#### action: setFeatures

```js
// type signature
setFeatures: (f: Feature[]) => void
```

#### action: setLayout

```js
// type signature
setLayout: (layout: Source[]) => void
```

#### action: clearLayout

```js
// type signature
clearLayout: () => void
```

#### action: setSourcesLoading

```js
// type signature
setSourcesLoading: (str: string) => void
```

#### action: setSources

```js
// type signature
setSources: (sources: Source[]) => void
```

#### action: setMafFilter

```js
// type signature
setMafFilter: (arg: number) => void
```

#### action: setShowSidebarLabels

```js
// type signature
setShowSidebarLabels: (arg: boolean) => void
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```
