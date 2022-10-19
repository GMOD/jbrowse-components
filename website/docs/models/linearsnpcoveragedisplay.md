---
id: linearsnpcoveragedisplay
title: LinearSNPCoverageDisplay
toplevel: true
---


extends `LinearWiggleDisplay`
#### property: type


```js

        /**
         * !property
         */
        type: types.literal('LinearSNPCoverageDisplay')
```
#### property: drawInterbaseCounts


```js

        /**
         * !property
         */
        drawInterbaseCounts: types.maybe(types.boolean)
```
#### property: drawIndicators


```js

        /**
         * !property
         */
        drawIndicators: types.maybe(types.boolean)
```
#### property: drawArcs


```js

        /**
         * !property
         */
        drawArcs: types.maybe(types.boolean)
```
#### property: filterBy


```js

        /**
         * !property
         */
        filterBy: types.optional(
          types.model({
            flagInclude: types.optional(types.number, 0),
            flagExclude: types.optional(types.number, 1540),
            readName: types.maybe(types.string),
            tagFilter: types.maybe(
              types.model({ tag: types.string, value: types.string }),
            ),
          }),
          {},
        )
```
#### property: colorBy


```js

        /**
         * !property
         */
        colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
          }),
        )
```
#### action: setConfig



```js
// Type signature
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```
#### property: configuration


```js

        self.configuration
```
#### action: setFilterBy



```js
// Type signature
setFilterBy: (filter: { flagInclude: number; flagExclude: number; readName?: string; tagFilter?: { tag: string; value: string; }; }) => void
```
#### property: filterBy


```js

        self.filterBy
```
#### action: setColorBy



```js
// Type signature
setColorBy: (colorBy?: { type: string; tag?: string; }) => void
```
#### property: colorBy


```js

        self.colorBy
```
#### action: updateModificationColorMap



```js
// Type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
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
#### property: drawInterbaseCounts


```js

                self.drawInterbaseCounts
```
#### property: drawIndicators


```js
 self.drawIndicators
```
#### property: drawArcs


```js
 self.drawArcs
```
#### getter: drawArcsSetting



```js
// Type
any
```
#### property: drawArcs


```js

            self.drawArcs
```
#### getter: drawInterbaseCountsSetting



```js
// Type
any
```
#### property: drawInterbaseCounts


```js

            self.drawInterbaseCounts
```
#### getter: drawIndicatorsSetting



```js
// Type
any
```
#### property: drawIndicators


```js

            self.drawIndicators
```
#### getter: modificationsReady



```js
// Type
boolean
```
#### property: colorBy


```js
 self.colorBy
```
#### method: renderProps

```js
// Type signature
renderProps: () => any
```
#### action: toggleDrawIndicators



```js
// Type signature
toggleDrawIndicators: () => void
```
#### property: drawIndicators


```js

        self.drawIndicators
```
#### getter: drawIndicatorsSetting



```js
// Type
any
```
#### action: toggleDrawInterbaseCounts



```js
// Type signature
toggleDrawInterbaseCounts: () => void
```
#### property: drawInterbaseCounts


```js

        self.drawInterbaseCounts
```
#### getter: drawInterbaseCountsSetting



```js
// Type
any
```
#### action: toggleDrawArcs



```js
// Type signature
toggleDrawArcs: () => void
```
#### property: drawArcs


```js

        self.drawArcs
```
#### getter: drawArcsSetting



```js
// Type
any
```
#### getter: estimatedStatsReady



```js
// Type
boolean
```
#### getter: regionTooLarge


region is too large if:
- stats are ready
- region is greater than 20kb (don't warn when zoomed in less than that)
- and bytes is greater than max allowed bytes or density greater than max density
```js
// Type
boolean
```
#### getter: parentTrack



```js
// Type
any
```
#### action: updateModificationColorMap



```js
// Type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```
#### action: setError



```js
// Type signature
setError: (error?: unknown) => void
```
#### getter: TooltipComponent



```js
// Type
any
```
#### getter: adapterConfig



```js
// Type
{ type: string; subadapter: any; }
```
#### getter: parentTrack



```js
// Type
any
```
#### getter: rendererTypeName



```js
// Type
string
```
#### getter: needsScalebar



```js
// Type
boolean
```
#### method: contextMenuItems

```js
// Type signature
contextMenuItems: () => any[]
```
#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```
#### getter: drawIndicatorsSetting



```js
// Type
any
```
#### action: toggleDrawIndicators



```js
// Type signature
toggleDrawIndicators: () => void
```
#### getter: drawInterbaseCountsSetting



```js
// Type
any
```
#### action: toggleDrawInterbaseCounts



```js
// Type signature
toggleDrawInterbaseCounts: () => void
```
#### getter: drawArcsSetting



```js
// Type
any
```
#### action: toggleDrawArcs



```js
// Type signature
toggleDrawArcs: () => void
```
