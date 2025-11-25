---
id: multivariantbasemodel
title: MultiVariantBaseModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/shared/MultiVariantBaseModel.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultiVariantBaseModel.md)

## Docs

extends

- [LinearBareDisplay](../linearbaredisplay)

### MultiVariantBaseModel - Properties

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

#### property: minorAlleleFrequencyFilter

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minorAlleleFrequencyFilter: types.optional(types.number, 0)
```

#### property: showSidebarLabelsSetting

```js
// type signature
true
// code
showSidebarLabelsSetting: true
```

#### property: showTree

```js
// type signature
true
// code
showTree: true
```

#### property: renderingMode

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
renderingMode: types.optional(types.string, 'alleleCount')
```

#### property: rowHeightSetting

used only if autoHeight is false

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
rowHeightSetting: types.optional(types.number, 8)
```

#### property: autoHeight

used only if autoHeight is false

```js
// type signature
true
// code
autoHeight: true
```

#### property: lengthCutoffFilter

```js
// type signature
number
// code
lengthCutoffFilter: Number.MAX_SAFE_INTEGER
```

#### property: jexlFilters

```js
// type signature
IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFilters: types.maybe(types.array(types.string))
```

#### property: referenceDrawingMode

```js
// type signature
string
// code
referenceDrawingMode: 'skip'
```

#### property: clusterTree

```js
// type signature
IMaybe<ISimpleType<string>>
// code
clusterTree: types.maybe(types.string)
```

#### property: treeAreaWidth

```js
// type signature
number
// code
treeAreaWidth: 80
```

### MultiVariantBaseModel - Getters

#### getter: activeFilters

```js
// type
any
```

#### getter: preSources

```js
// type
Source[]
```

#### getter: sources

```js
// type
any[]
```

#### getter: root

```js
// type
any
```

#### getter: sourceMap

```js
// type
any
```

#### getter: rowHeight

```js
// type
number
```

#### getter: totalHeight

```js
// type
number
```

#### getter: hierarchy

```js
// type
any
```

#### getter: canDisplayLabels

```js
// type
boolean
```

#### getter: totalHeight

```js
// type
number
```

#### getter: featuresReady

```js
// type
boolean
```

### MultiVariantBaseModel - Methods

#### method: adapterProps

```js
// type signature
adapterProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | ... 6 more ... | { ...; })[]
```

#### method: getPortableSettings

```js
// type signature
getPortableSettings: () => { rowHeightSetting: number; minorAlleleFrequencyFilter: number; showSidebarLabelsSetting: boolean; showTree: boolean; renderingMode: string; autoHeight: boolean; lengthCutoffFilter: number; ... 5 more ...; height: number; }
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

### MultiVariantBaseModel - Actions

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (f?: string[]) => void
```

#### action: setRowHeight

```js
// type signature
setRowHeight: (arg: number) => void
```

#### action: setHoveredGenotype

```js
// type signature
setHoveredGenotype: (arg?: { genotype: string; name: string; }) => void
```

#### action: setHoveredTreeNode

```js
// type signature
setHoveredTreeNode: (node: any) => void
```

#### action: setTreeCanvasRef

```js
// type signature
setTreeCanvasRef: (ref: HTMLCanvasElement) => void
```

#### action: setMouseoverCanvasRef

```js
// type signature
setMouseoverCanvasRef: (ref: HTMLCanvasElement) => void
```

#### action: setTreeAreaWidth

```js
// type signature
setTreeAreaWidth: (width: number) => void
```

#### action: setFeatures

```js
// type signature
setFeatures: (f: Feature[]) => void
```

#### action: setLayout

```js
// type signature
setLayout: (layout: Source[], clearTree?: boolean) => void
```

#### action: clearLayout

```js
// type signature
clearLayout: () => void
```

#### action: setClusterTree

```js
// type signature
setClusterTree: (tree?: string) => void
```

#### action: setSourcesLoading

```js
// type signature
setSourcesLoading: (str: string) => void
```

#### action: setSimplifiedFeaturesLoading

```js
// type signature
setSimplifiedFeaturesLoading: (str: string) => void
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

#### action: setShowTree

```js
// type signature
setShowTree: (arg: boolean) => void
```

#### action: setPhasedMode

```js
// type signature
setPhasedMode: (arg: string) => void
```

#### action: setAutoHeight

```js
// type signature
setAutoHeight: (arg: boolean) => void
```

#### action: setHasPhased

```js
// type signature
setHasPhased: (arg: boolean) => void
```

#### action: setSampleInfo

```js
// type signature
setSampleInfo: (arg: Record<string, SampleInfo>) => void
```

#### action: setReferenceDrawingMode

```js
// type signature
setReferenceDrawingMode: (arg: string) => void
```
