---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[plugins/alignments/src/LinearAlignmentsDisplay/models/model.tsx](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/models/model.tsx)

## Docs

extends `BaseDisplay`

### LinearAlignmentsDisplay - Properties

#### property: PileupDisplay

refers to LinearPileupDisplay sub-display model

```js
// type signature
IMaybe<IAnyType>
// code
PileupDisplay: types.maybe(types.union(...lowerPanelDisplays))
```

#### property: SNPCoverageDisplay

refers to LinearSNPCoverageDisplay sub-display model

```js
// type signature
IMaybe<IAnyModelType>
// code
SNPCoverageDisplay: types.maybe(
      pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
    )
```

#### property: snpCovHeight

```js
// type signature
number
// code
snpCovHeight: 45
```

#### property: type

```js
// type signature
ISimpleType<"LinearAlignmentsDisplay">
// code
type: types.literal('LinearAlignmentsDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: heightPreConfig

```js
// type signature
IMaybe<ISimpleType<number>>
// code
heightPreConfig: types.maybe(types.number)
```

#### property: userFeatureScreenDensity

```js
// type signature
IMaybe<ISimpleType<number>>
// code
userFeatureScreenDensity: types.maybe(types.number)
```

#### property: lowerPanelType

```js
// type signature
string
// code
lowerPanelType: 'LinearPileupDisplay'
```

### LinearAlignmentsDisplay - Getters

#### getter: height

```js
// type
any
```

#### getter: pileupConf

```js
// type
any
```

#### getter: features

```js
// type
any
```

#### getter: DisplayBlurb

```js
// type
any
```

#### getter: sortedBy

```js
// type
any
```

#### getter: coverageConf

```js
// type
any
```

### LinearAlignmentsDisplay - Methods

#### method: getFeatureByID

```js
// type signature
getFeatureByID: (blockKey: string, id: string) => any
```

#### method: searchFeatureByID

```js
// type signature
searchFeatureByID: (id: string) => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### LinearAlignmentsDisplay - Actions

#### action: setScrollTop

```js
// type signature
setScrollTop: (scrollTop: number) => void
```

#### action: setSNPCoverageHeight

```js
// type signature
setSNPCoverageHeight: (n: number) => void
```

#### action: setSNPCoverageDisplay

```js
// type signature
setSNPCoverageDisplay: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setFeatureDensityStatsLimit

```js
// type signature
setFeatureDensityStatsLimit: (stats?: FeatureDensityStats) => void
```

#### action: setPileupDisplay

```js
// type signature
setPileupDisplay: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setHeight

```js
// type signature
setHeight: (n: number) => number
```

#### action: setLowerPanelType

```js
// type signature
setLowerPanelType: (type: string) => void
```

#### action: resizeHeight

```js
// type signature
resizeHeight: (distance: number) => number
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<Element>
```
