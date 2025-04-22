---
id: multilinearvariantdisplay
title: MultiLinearVariantDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/MultiLinearVariantDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultiLinearVariantDisplay.md)

## Docs

extends

- [MultiVariantBaseModel](../linearbaredisplay)

### MultiLinearVariantDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"MultiLinearVariantDisplay">
// code
type: types.literal('MultiLinearVariantDisplay')
```

#### property: rowHeightSetting

used only if autoHeight is false

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
rowHeightSetting: types.optional(types.number, 11)
```

#### property: minorAlleleFrequencyFilter

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minorAlleleFrequencyFilter: types.optional(types.number, 0)
```

### MultiLinearVariantDisplay - Getters

#### getter: rendererTypeName

```js
// type
string
```

### MultiLinearVariantDisplay - Actions

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```
