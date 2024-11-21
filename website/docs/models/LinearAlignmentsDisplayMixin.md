---
id: linearalignmentsdisplaymixin
title: LinearAlignmentsDisplayMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/alignments/src/LinearAlignmentsDisplay/alignmentsModel.tsx](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsModel.tsx)

### LinearAlignmentsDisplayMixin - Properties

#### property: PileupDisplay

refers to LinearPileupDisplay sub-display model

```js
// type signature
IMaybe<IAnyType>
// code
PileupDisplay: types.maybe(
      types.union(
        ...getLowerPanelDisplays(pluginManager).map(f => f.stateModel),
      ),
    )
```

#### property: SNPCoverageDisplay

refers to LinearSNPCoverageDisplay sub-display model

```js
// type signature
IMaybe<IAnyModelType>
// code
SNPCoverageDisplay: types.maybe(
      pluginManager.getDisplayType('LinearSNPCoverageDisplay')!.stateModel,
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
AnyConfigurationSchemaType
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
