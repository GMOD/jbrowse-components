---
id: sharedwigglemixin
title: SharedWiggleMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/wiggle/src/shared/modelShared.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/modelShared.ts)

### SharedWiggleMixin - Properties

#### property: autoscale

```js
// type signature
IMaybe<ISimpleType<string>>
// code
autoscale: types.maybe(types.string)
```

#### property: color

```js
// type signature
IMaybe<ISimpleType<string>>
// code
color: types.maybe(types.string)
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
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

#### property: displayCrossHatches

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
displayCrossHatches: types.maybe(types.boolean)
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

#### property: negColor

```js
// type signature
IMaybe<ISimpleType<string>>
// code
negColor: types.maybe(types.string)
```

#### property: posColor

```js
// type signature
IMaybe<ISimpleType<string>>
// code
posColor: types.maybe(types.string)
```

#### property: resolution

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
resolution: types.optional(types.number, 1)
```

#### property: rendererTypeNameState

```js
// type signature
IMaybe<ISimpleType<string>>
// code
rendererTypeNameState: types.maybe(types.string)
```

#### property: selectedRendering

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
selectedRendering: types.optional(types.string, '')
```

#### property: scale

```js
// type signature
IMaybe<ISimpleType<string>>
// code
scale: types.maybe(types.string)
```

#### property: summaryScoreMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
summaryScoreMode: types.maybe(types.string)
```

### SharedWiggleMixin - Getters

#### getter: adapterTypeName

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

#### getter: rendererTypeNameSimple

```js
// type
any
```

#### getter: scaleType

```js
// type
any
```

#### getter: adapterCapabilities

```js
// type
string[]
```

#### getter: autoscaleType

```js
// type
any
```

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: domain

```js
// type
number[]
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

#### getter: filled

```js
// type
boolean
```

#### getter: hasGlobalStats

```js
// type
boolean
```

#### getter: hasResolution

```js
// type
boolean
```

#### getter: scaleOpts

```js
// type
{ autoscaleType: any; domain: number[]; inverted: any; scaleType: any; stats: { scoreMin: number; scoreMax: number; }; }
```

#### getter: summaryScoreModeSetting

```js
// type
string
```

### SharedWiggleMixin - Methods

#### method: scoreTrackMenuItems

```js
// type signature
scoreTrackMenuItems: () => ({ label: string; subMenu: { label: string; onClick: () => void; }[]; onClick?: undefined; } | { label: string; subMenu: { checked: boolean; label: string; onClick: () => void; type: string; }[]; onClick?: undefined; } | { ...; })[]
```

### SharedWiggleMixin - Actions

#### action: selectFeature

this overrides the BaseLinearDisplayModel to avoid popping up a feature detail
display, but still sets the feature selection on the model so listeners can
detect a click

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: setAutoscale

```js
// type signature
setAutoscale: (val: string) => void
```

#### action: setColor

```js
// type signature
setColor: (color?: string) => void
```

#### action: setCrossHatches

```js
// type signature
setCrossHatches: (cross: boolean) => void
```

#### action: setFill

```js
// type signature
setFill: (fill: number) => void
```

#### action: setLoading

```js
// type signature
setLoading: (aborter: AbortController) => void
```

#### action: setMaxScore

```js
// type signature
setMaxScore: (val?: number) => void
```

#### action: setMinScore

```js
// type signature
setMinScore: (val?: number) => void
```

#### action: setNegColor

```js
// type signature
setNegColor: (color?: string) => void
```

#### action: setPosColor

```js
// type signature
setPosColor: (color?: string) => void
```

#### action: setRendererType

```js
// type signature
setRendererType: (val: string) => void
```

#### action: updateQuantitativeStats

```js
// type signature
updateQuantitativeStats: (stats: { scoreMin: number; scoreMax: number; }) => void
```

#### action: setResolution

```js
// type signature
setResolution: (res: number) => void
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

#### action: toggleCrossHatches

```js
// type signature
toggleCrossHatches: () => void
```

#### action: toggleLogScale

```js
// type signature
toggleLogScale: () => void
```

#### action: reload

```js
// type signature
reload: () => Promise<void>
```
