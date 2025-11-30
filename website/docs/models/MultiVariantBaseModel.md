---
id: multivariantbasemodel
title: MultiVariantBaseModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
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
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showSidebarLabelsSetting: types.optional(types.boolean, true)
```

#### property: showTree

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showTree: types.optional(types.boolean, true)
```

#### property: renderingMode

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
renderingMode: types.optional(types.string, 'alleleCount')
```

#### property: rowHeightMode

Controls row height: 'auto' calculates from available height, or a number
specifies manual pixel height per row

```js
// type signature
IOptionalIType<ITypeUnion<number | "auto", number | "auto", number | "auto">, [undefined]>
// code
rowHeightMode: types.optional(
          types.union(types.literal('auto'), types.number),
          'auto',
        )
```

#### property: lengthCutoffFilter

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
lengthCutoffFilter: types.optional(
          types.number,
          Number.MAX_SAFE_INTEGER,
        )
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
IOptionalIType<ISimpleType<string>, [undefined]>
// code
referenceDrawingMode: types.optional(types.string, 'skip')
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
IOptionalIType<ISimpleType<number>, [undefined]>
// code
treeAreaWidth: types.optional(types.number, 80)
```

#### property: lineZoneHeight

Height reserved for elements above the main display (e.g., connecting lines in
matrix view)

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
lineZoneHeight: types.optional(types.number, 0)
```

### MultiVariantBaseModel - Getters

#### getter: autoHeight

```js
// type
boolean
```

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

#### getter: availableHeight

Available height for rows (total height minus lineZoneHeight)

```js
// type
number
```

#### getter: nrow

```js
// type
number
```

#### getter: totalHeight

```js
// type
any
```

#### getter: rowHeight

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

#### method: renderingProps

props for the renderer's React "Rendering" component - client-side only, never
sent to the worker

```js
// type signature
renderingProps: () => { displayModel: { id: string; type: string; rpcDriverName: string; } & NonEmptyObject & { rendererTypeName: string; error: unknown; message: string; } & IStateTreeNode<IModelType<{ id: IOptionalIType<ISimpleType<string>, [...]>; type: ISimpleType<...>; rpcDriverName: IMaybe<...>; }, { ...; }, _NotCustomized, _...
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | ... 6 more ... | { ...; })[]
```

#### method: getPortableSettings

```js
// type signature
getPortableSettings: () => { minorAlleleFrequencyFilter: number; showSidebarLabelsSetting: boolean; showTree: boolean; renderingMode: string; lengthCutoffFilter: number; jexlFilters: IMSTArray<ISimpleType<string>> & IStateTreeNode<...>; ... 4 more ...; height: number; }
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
setRowHeight: (arg: number | "auto") => void
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

Toggle auto height mode. When turning off, uses default of 10px per row.

```js
// type signature
setAutoHeight: (auto: boolean) => void
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
