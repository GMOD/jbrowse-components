---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

extends `BaseDisplay`

### LinearAlignmentsDisplay - Properties

#### property: PileupDisplay

refers to LinearPileupDisplay sub-display model

```js
// type signature
IMaybe<IAnyModelType>
// code
PileupDisplay: types.maybe(
          pluginManager.getDisplayType('LinearPileupDisplay').stateModel,
        )
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

#### property: height

```js
// type signature
number
// code
height: 250
```

#### property: showCoverage

```js
// type signature
true
// code
showCoverage: true
```

#### property: showPileup

```js
// type signature
true
// code
showPileup: true
```

#### property: userFeatureScreenDensity

```js
// type signature
IMaybe<ISimpleType<number>>
// code
userFeatureScreenDensity: types.maybe(types.number)
```

### LinearAlignmentsDisplay - Getters

#### getter: pileupDisplayConfig

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

#### getter: sortedByPosition

```js
// type
any
```

#### getter: sortedByRefName

```js
// type
any
```

#### getter: snpCoverageDisplayConfig

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

#### action: toggleCoverage

```js
// type signature
toggleCoverage: () => void
```

#### action: togglePileup

```js
// type signature
togglePileup: () => void
```

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
setSNPCoverageDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setUserFeatureScreenDensity

```js
// type signature
setUserFeatureScreenDensity: (limit: number) => void
```

#### action: setPileupDisplay

```js
// type signature
setPileupDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setHeight

```js
// type signature
setHeight: (displayHeight: number) => number
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
