---
id: linearwiggledisplay
title: LinearWiggleDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/wiggle/src/LinearWiggleDisplay/models/model.tsx](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/models/model.tsx)

Extends `BaseLinearDisplay`

### LinearWiggleDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearWiggleDisplay">
// code
type: types.literal('LinearWiggleDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

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

### LinearWiggleDisplay - Getters

#### getter: TooltipComponent

```js
// type
React.FC
```

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

#### getter: rendererTypeName

```js
// type
string
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

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: filled

```js
// type
any
```

#### getter: summaryScoreModeSetting

```js
// type
any
```

#### getter: domain

```js
// type
number[]
```

#### getter: needsScalebar

```js
// type
boolean
```

#### getter: scaleOpts

```js
// type
{
  domain: any
  stats: {
    scoreMin: number
    scoreMax: number
  }
  autoscaleType: any
  scaleType: any
  inverted: any
}
```

#### getter: canHaveFill

```js
// type
boolean
```

#### getter: autoscaleType

```js
// type
any
```

#### getter: displayCrossHatchesSetting

```js
// type
any
```

#### getter: ticks

```js
// type
{ range: number[]; values: number[]; format: (d: NumberValue) => string; position: ScaleLinear<number, number, never> | ScaleQuantize<number, never>; }
```

#### getter: adapterCapabilities

```js
// type
string[]
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

#### getter: fillSetting

```js
// type
;1 | 0 | 2
```

### LinearWiggleDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; })[]
```

### LinearWiggleDisplay - Actions

#### action: updateQuantitativeStats

```js
// type signature
updateQuantitativeStats: (stats: { scoreMin: number; scoreMax: number; }) => void
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

#### action: setLoading

```js
// type signature
setLoading: (aborter: AbortController) => void
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

re-runs stats and refresh whole display on reload

```js
// type signature
reload: () => Promise<void>
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgOptions & { overrideHeight: number; theme: ThemeOptions; }) => Promise<Element>
```
