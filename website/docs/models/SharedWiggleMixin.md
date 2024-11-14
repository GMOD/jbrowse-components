---
id: sharedwigglemixin
title: SharedWiggleMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/wiggle/src/shared/SharedWiggleMixin.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/SharedWiggleMixin.ts)

### SharedWiggleMixin - Properties

#### property: selectedRendering

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
selectedRendering: types.optional(types.string, '')
```

#### property: resolution

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
resolution: types.optional(types.number, 1)
```

#### property: fill

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
fill: types.maybe(types.boolean)
```

#### property: minSize

```js
// type signature
IMaybe<ISimpleType<number>>
// code
minSize: types.maybe(types.number)
```

#### property: color

```js
// type signature
IMaybe<ISimpleType<string>>
// code
color: types.maybe(types.string)
```

#### property: posColor

```js
// type signature
IMaybe<ISimpleType<string>>
// code
posColor: types.maybe(types.string)
```

#### property: negColor

```js
// type signature
IMaybe<ISimpleType<string>>
// code
negColor: types.maybe(types.string)
```

#### property: summaryScoreMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
summaryScoreMode: types.maybe(types.string)
```

#### property: rendererTypeNameState

```js
// type signature
IMaybe<ISimpleType<string>>
// code
rendererTypeNameState: types.maybe(types.string)
```

#### property: scale

```js
// type signature
IMaybe<ISimpleType<string>>
// code
scale: types.maybe(types.string)
```

#### property: autoscale

```js
// type signature
IMaybe<ISimpleType<string>>
// code
autoscale: types.maybe(types.string)
```

#### property: displayCrossHatches

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
displayCrossHatches: types.maybe(types.boolean)
```

#### property: constraints

```js
// type signature
IOptionalIType<IModelType<{ max: IMaybe<ISimpleType<number>>; min: IMaybe<ISimpleType<number>>; }, {}, _NotCustomized, _NotCustomized>, [...]>
// code
constraints: types.optional(
          types.model({
            max: types.maybe(types.number),
            min: types.maybe(types.number),
          }),
          {},
        )
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

### SharedWiggleMixin - Getters

#### getter: adapterTypeName

```js
// type
any
```

#### getter: rendererTypeNameSimple

```js
// type
any
```

#### getter: filters

subclasses can define these, as snpcoverage track does

```js
// type
any
```

#### getter: scaleType

```js
// type
any
```

#### getter: maxScore

```js
// type
any
```

#### getter: minScore

```js
// type
any
```

#### getter: adapterCapabilities

```js
// type
string[]
```

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>
```

#### getter: autoscaleType

```js
// type
any
```

#### getter: domain

```js
// type
number[]
```

#### getter: filled

```js
// type
boolean
```

#### getter: summaryScoreModeSetting

```js
// type
string
```

#### getter: scaleOpts

```js
// type
{ domain: number[]; stats: { currStatsBpPerPx: number; scoreMin: number; scoreMax: number; }; autoscaleType: any; scaleType: any; inverted: any; }
```

#### getter: canHaveFill

```js
// type
boolean
```

#### getter: displayCrossHatchesSetting

```js
// type
boolean
```

#### getter: hasResolution

```js
// type
boolean
```

#### getter: hasGlobalStats

```js
// type
boolean
```

### SharedWiggleMixin - Methods

#### method: scoreTrackMenuItems

```js
// type signature
scoreTrackMenuItems: () => ({ label: string; subMenu: { label: string; onClick: () => void; }[]; onClick?: undefined; } | { label: string; subMenu: { label: string; type: string; checked: boolean; onClick: () => void; }[]; onClick?: undefined; } | { ...; })[]
```

### SharedWiggleMixin - Actions

#### action: updateQuantitativeStats

```js
// type signature
updateQuantitativeStats: (stats: { currStatsBpPerPx: number; scoreMin: number; scoreMax: number; }) => void
```

#### action: setColor

```js
// type signature
setColor: (color?: string) => void
```

#### action: setPosColor

```js
// type signature
setPosColor: (color?: string) => void
```

#### action: setNegColor

```js
// type signature
setNegColor: (color?: string) => void
```

#### action: setStatsLoading

```js
// type signature
setStatsLoading: (aborter: AbortController) => void
```

#### action: selectFeature

this overrides the BaseLinearDisplayModel to avoid popping up a feature detail
display, but still sets the feature selection on the model so listeners can
detect a click

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: setResolution

```js
// type signature
setResolution: (res: number) => void
```

#### action: setFill

```js
// type signature
setFill: (fill: number) => void
```

#### action: toggleLogScale

```js
// type signature
toggleLogScale: () => void
```

#### action: setScaleType

```js
// type signature
setScaleType: (scale?: string) => void
```

#### action: setSummaryScoreMode

```js
// type signature
setSummaryScoreMode: (val: string) => void
```

#### action: setAutoscale

```js
// type signature
setAutoscale: (val: string) => void
```

#### action: setMaxScore

```js
// type signature
setMaxScore: (val?: number) => void
```

#### action: setRendererType

```js
// type signature
setRendererType: (val: string) => void
```

#### action: setMinScore

```js
// type signature
setMinScore: (val?: number) => void
```

#### action: toggleCrossHatches

```js
// type signature
toggleCrossHatches: () => void
```

#### action: setCrossHatches

```js
// type signature
setCrossHatches: (cross: boolean) => void
```

#### action: reload

```js
// type signature
reload: () => Promise<void>
```
