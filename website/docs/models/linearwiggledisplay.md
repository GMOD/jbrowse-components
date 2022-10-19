---
id: linearwiggledisplay
title: LinearWiggleDisplay
toplevel: true
---


Extends `BaseLinearDisplay`
#### property: type


```js

        /**
         * !property
         */
        type: types.literal('LinearWiggleDisplay')
```
#### property: configuration


```js

        /**
         * !property
         */
        configuration: ConfigurationReference(configSchema)
```
#### property: selectedRendering


```js

        /**
         * !property
         */
        selectedRendering: types.optional(types.string, '')
```
#### property: resolution


```js

        /**
         * !property
         */
        resolution: types.optional(types.number, 1)
```
#### property: fill


```js

        /**
         * !property
         */
        fill: types.maybe(types.boolean)
```
#### property: minSize


```js

        /**
         * !property
         */
        minSize: types.maybe(types.number)
```
#### property: color


```js

        /**
         * !property
         */
        color: types.maybe(types.string)
```
#### property: posColor


```js

        /**
         * !property
         */
        posColor: types.maybe(types.string)
```
#### property: negColor


```js

        /**
         * !property
         */
        negColor: types.maybe(types.string)
```
#### property: summaryScoreMode


```js

        /**
         * !property
         */
        summaryScoreMode: types.maybe(types.string)
```
#### property: rendererTypeNameState


```js

        /**
         * !property
         */
        rendererTypeNameState: types.maybe(types.string)
```
#### property: scale


```js

        /**
         * !property
         */
        scale: types.maybe(types.string)
```
#### property: autoscale


```js

        /**
         * !property
         */
        autoscale: types.maybe(types.string)
```
#### property: displayCrossHatches


```js

        /**
         * !property
         */
        displayCrossHatches: types.maybe(types.boolean)
```
#### property: constraints


```js

        /**
         * !property
         */
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
#### property: color


```js

        self.color
```
#### action: setPosColor



```js
// Type signature
setPosColor: (color?: string) => void
```
#### property: posColor


```js

        self.posColor
```
#### action: setNegColor



```js
// Type signature
setNegColor: (color?: string) => void
```
#### property: negColor


```js

        self.negColor
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
#### property: resolution


```js

        self.resolution
```
#### action: setFill



```js
// Type signature
setFill: (fill: number) => void
```
#### property: fill


```js

          self.fill
```
#### property: minSize


```js

          self.minSize
```
#### property: fill


```js

          self.fill
```
#### property: minSize


```js

          self.minSize
```
#### property: fill


```js

          self.fill
```
#### property: minSize


```js

          self.minSize
```
#### action: toggleLogScale



```js
// Type signature
toggleLogScale: () => void
```
#### property: scale


```js
self.scale
```
#### property: scale


```js

          self.scale
```
#### property: scale


```js

          self.scale
```
#### action: setScaleType



```js
// Type signature
setScaleType: (scale?: string) => void
```
#### property: scale


```js

        self.scale
```
#### action: setSummaryScoreMode



```js
// Type signature
setSummaryScoreMode: (val: string) => void
```
#### property: summaryScoreMode


```js

        self.summaryScoreMode
```
#### action: setAutoscale



```js
// Type signature
setAutoscale: (val: string) => void
```
#### property: autoscale


```js

        self.autoscale
```
#### action: setMaxScore



```js
// Type signature
setMaxScore: (val?: number) => void
```
#### property: constraints


```js

        self.constraints
```
#### action: setRendererType



```js
// Type signature
setRendererType: (val: string) => void
```
#### property: rendererTypeNameState


```js

        self.rendererTypeNameState
```
#### action: setMinScore



```js
// Type signature
setMinScore: (val?: number) => void
```
#### property: constraints


```js

        self.constraints
```
#### action: toggleCrossHatches



```js
// Type signature
toggleCrossHatches: () => void
```
#### property: displayCrossHatches


```js

        self.displayCrossHatches
```
#### property: displayCrossHatches


```js
self.displayCrossHatches
```
#### action: setCrossHatches



```js
// Type signature
setCrossHatches: (cross: boolean) => void
```
#### property: displayCrossHatches


```js

        self.displayCrossHatches
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
#### property: rendererTypeNameState


```js
 self.rendererTypeNameState
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
#### property: scale


```js
 self.scale
```
#### getter: maxScore



```js
// Type
any
```
#### property: constraints


```js
 self.constraints
```
#### getter: minScore



```js
// Type
any
```
#### property: constraints


```js
 self.constraints
```
#### getter: rendererConfig



```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```
#### getter: rendererTypeName



```js
// Type
any
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
#### getter: rendererTypeName



```js
// Type
any
```
#### getter: rendererTypeName



```js
// Type
any
```
#### getter: scaleOpts



```js
// Type
{ domain: any; stats: { scoreMin: number; scoreMax: number; }; autoscaleType: any; scaleType: any; inverted: any; }
```
#### getter: scaleType



```js
// Type
any
```
#### getter: canHaveFill



```js
// Type
boolean
```
#### getter: rendererTypeName



```js
// Type
any
```
#### getter: autoscaleType



```js
// Type
any
```
#### property: autoscale


```js
 self.autoscale
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
#### getter: adapterTypeName



```js
// Type
any
```
#### method: renderProps

```js
// Type signature
renderProps: () => any
```
#### property: rpcDriverName


```js
 self.rpcDriverName
```
#### getter: rendererConfig



```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```
#### getter: displayCrossHatchesSetting



```js
// Type
any
```
#### getter: hasResolution



```js
// Type
boolean
```
#### getter: adapterCapabilities



```js
// Type
string[]
```
#### getter: hasGlobalStats



```js
// Type
boolean
```
#### getter: adapterCapabilities



```js
// Type
string[]
```
#### getter: fillSetting



```js
// Type
2 | 0 | 1
```
#### getter: filled



```js
// Type
any
```
#### getter: filled



```js
// Type
any
```
#### property: minSize


```js
 self.minSize
```
#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```
#### getter: hasResolution



```js
// Type
boolean
```
#### action: setResolution



```js
// Type signature
setResolution: (res: number) => void
```
#### property: resolution


```js
self.resolution
```
#### action: setResolution



```js
// Type signature
setResolution: (res: number) => void
```
#### property: resolution


```js
self.resolution
```
#### getter: summaryScoreModeSetting



```js
// Type
any
```
#### action: setSummaryScoreMode



```js
// Type signature
setSummaryScoreMode: (val: string) => void
```
#### getter: canHaveFill



```js
// Type
boolean
```
#### getter: fillSetting



```js
// Type
2 | 0 | 1
```
#### action: setFill



```js
// Type signature
setFill: (fill: number) => void
```
#### getter: scaleType



```js
// Type
any
```
#### action: toggleLogScale



```js
// Type signature
toggleLogScale: () => void
```
#### getter: needsScalebar



```js
// Type
boolean
```
#### getter: displayCrossHatchesSetting



```js
// Type
any
```
#### action: toggleCrossHatches



```js
// Type signature
toggleCrossHatches: () => void
```
#### getter: rendererTypeNameSimple



```js
// Type
any
```
#### action: setRendererType



```js
// Type signature
setRendererType: (val: string) => void
```
#### getter: hasGlobalStats



```js
// Type
boolean
```
#### getter: autoscaleType



```js
// Type
any
```
#### action: setAutoscale



```js
// Type signature
setAutoscale: (val: string) => void
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
#### action: setLoading



```js
// Type signature
setLoading: (aborter: AbortController) => void
```
#### method: renderProps
the react props that are passed to the Renderer when data
is rendered in this display
```js
// Type signature
renderProps: any
```
#### action: updateStats



```js
// Type signature
updateStats: (stats: { scoreMin: number; scoreMax: number; }) => void
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
regionCannotBeRenderedText: (_region: Region) => "" | "Force load to see features"
```
