---
id: linearwiggledisplay
title: LinearWiggleDisplay
toplevel: true
---

Extends `BaseLinearDisplay`

#### property: type

```js
type: types.literal('LinearWiggleDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### property: selectedRendering

```js
selectedRendering: types.optional(types.string, '')
```

#### property: resolution

```js
resolution: types.optional(types.number, 1)
```

#### property: fill

```js
fill: types.maybe(types.boolean)
```

#### property: minSize

```js
minSize: types.maybe(types.number)
```

#### property: color

```js
color: types.maybe(types.string)
```

#### property: posColor

```js
posColor: types.maybe(types.string)
```

#### property: negColor

```js
negColor: types.maybe(types.string)
```

#### property: summaryScoreMode

```js
summaryScoreMode: types.maybe(types.string)
```

#### property: rendererTypeNameState

```js
rendererTypeNameState: types.maybe(types.string)
```

#### property: scale

```js
scale: types.maybe(types.string)
```

#### property: autoscale

```js
autoscale: types.maybe(types.string)
```

#### property: displayCrossHatches

```js
displayCrossHatches: types.maybe(types.boolean)
```

#### property: constraints

```js
constraints: types.optional(
  types.model({
    max: types.maybe(types.number),
    min: types.maybe(types.number),
  }),
  {},
)
```

#### action: updateStats

```js
// Type signature
updateStats: (stats: { scoreMin: number; scoreMax: number; }) => void
```

#### action: setColor

```js
// Type signature
setColor: (color?: string) => void
```

#### action: setPosColor

```js
// Type signature
setPosColor: (color?: string) => void
```

#### action: setNegColor

```js
// Type signature
setNegColor: (color?: string) => void
```

#### action: setLoading

```js
// Type signature
setLoading: (aborter: AbortController) => void
```

#### action: setResolution

```js
// Type signature
setResolution: (res: number) => void
```

#### action: setFill

```js
// Type signature
setFill: (fill: number) => void
```

#### action: toggleLogScale

```js
// Type signature
toggleLogScale: () => void
```

#### action: setScaleType

```js
// Type signature
setScaleType: (scale?: string) => void
```

#### action: setSummaryScoreMode

```js
// Type signature
setSummaryScoreMode: (val: string) => void
```

#### action: setAutoscale

```js
// Type signature
setAutoscale: (val: string) => void
```

#### action: setMaxScore

```js
// Type signature
setMaxScore: (val?: number) => void
```

#### action: setRendererType

```js
// Type signature
setRendererType: (val: string) => void
```

#### action: setMinScore

```js
// Type signature
setMinScore: (val?: number) => void
```

#### action: toggleCrossHatches

```js
// Type signature
toggleCrossHatches: () => void
```

#### action: setCrossHatches

```js
// Type signature
setCrossHatches: (cross: boolean) => void
```

#### getter: TooltipComponent

```js
// Type
React.FC
```

#### getter: adapterTypeName

```js
// Type
any
```

#### getter: adapterConfig

```js
// Type
any
```

#### getter: rendererTypeNameSimple

```js
// Type
any
```

#### getter: rendererTypeName

```js
// Type
string
```

#### getter: scaleType

```js
// Type
any
```

#### getter: maxScore

```js
// Type
any
```

#### getter: minScore

```js
// Type
any
```

#### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

#### getter: filled

```js
// Type
any
```

#### getter: summaryScoreModeSetting

```js
// Type
any
```

#### getter: domain

```js
// Type
number[]
```

#### getter: needsScalebar

```js
// Type
boolean
```

#### getter: scaleOpts

```js
// Type
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
// Type
boolean
```

#### getter: autoscaleType

```js
// Type
any
```

#### getter: displayCrossHatchesSetting

```js
// Type
any
```

#### getter: ticks

```js
// Type
{ range: number[]; values: number[]; format: (d: NumberValue) => string; position: ScaleLinear<number, number, never> | ScaleQuantize<number, never>; }
```

#### getter: adapterCapabilities

```js
// Type
string[]
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### getter: hasResolution

```js
// Type
boolean
```

#### getter: hasGlobalStats

```js
// Type
boolean
```

#### getter: fillSetting

```js
// Type
;2 | 0 | 1
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```

#### action: reload

re-runs stats and refresh whole display on reload

```js
// Type signature
reload: () => Promise<void>
```

#### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

#### action: renderSvg

```js
// Type signature
renderSvg: (opts: ExportSvgOptions & { overrideHeight: number; }) => Promise<Element>
```

#### method: regionCannotBeRenderedText

```js
// Type signature
regionCannotBeRenderedText: (_region: Region) =>
  '' | 'Force load to see features'
```
