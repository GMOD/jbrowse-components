---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
toplevel: true
---

extends `BaseDisplay`

#### property: PileupDisplay

refers to LinearPileupDisplay sub-display model

```js
PileupDisplay: types.maybe(
  pluginManager.getDisplayType('LinearPileupDisplay').stateModel,
)
```

#### property: SNPCoverageDisplay

refers to LinearSNPCoverageDisplay sub-display model

```js
SNPCoverageDisplay: types.maybe(
  pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
)
```

#### property: snpCovHeight

```js
snpCovHeight: 45
```

#### property: type

```js
type: types.literal('LinearAlignmentsDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### property: height

```js
height: 250
```

#### property: showCoverage

```js
showCoverage: true
```

#### property: showPileup

```js
showPileup: true
```

#### property: userFeatureScreenDensity

```js
userFeatureScreenDensity: types.maybe(types.number)
```

#### action: toggleCoverage

```js
// Type signature
toggleCoverage: () => void
```

#### action: togglePileup

```js
// Type signature
togglePileup: () => void
```

#### action: setScrollTop

```js
// Type signature
setScrollTop: (scrollTop: number) => void
```

#### action: setSNPCoverageHeight

```js
// Type signature
setSNPCoverageHeight: (n: number) => void
```

#### getter: pileupDisplayConfig

```js
// Type
any
```

#### method: getFeatureByID

```js
// Type signature
getFeatureByID: (blockKey: string, id: string) => any
```

#### method: searchFeatureByID

```js
// Type signature
searchFeatureByID: (id: string) => any
```

#### getter: features

```js
// Type
any
```

#### getter: DisplayBlurb

```js
// Type
any
```

#### getter: sortedBy

```js
// Type
any
```

#### getter: sortedByPosition

```js
// Type
any
```

#### getter: sortedByRefName

```js
// Type
any
```

#### getter: snpCoverageDisplayConfig

```js
// Type
any
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

#### action: setSNPCoverageDisplay

```js
// Type signature
setSNPCoverageDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setUserFeatureScreenDensity

```js
// Type signature
setUserFeatureScreenDensity: (limit: number) => void
```

#### action: setPileupDisplay

```js
// Type signature
setPileupDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setHeight

```js
// Type signature
setHeight: (displayHeight: number) => number
```

#### action: resizeHeight

```js
// Type signature
resizeHeight: (distance: number) => number
```

#### action: renderSvg

```js
// Type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<Element>
```
