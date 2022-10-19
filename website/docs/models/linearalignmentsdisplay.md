---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
toplevel: true
---


extends `BaseDisplay`
#### property: PileupDisplay


```js

        /**
         * !property
         * refers to LinearPileupDisplay sub-display model
         */
        PileupDisplay: types.maybe(
          pluginManager.getDisplayType('LinearPileupDisplay').stateModel,
        )
```
#### property: SNPCoverageDisplay


```js

        /**
         * !property
         * refers to LinearSNPCoverageDisplay sub-display model
         */
        SNPCoverageDisplay: types.maybe(
          pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
        )
```
#### property: snpCovHeight


```js

        /**
         * !property
         */
        snpCovHeight: 45
```
#### property: type


```js

        /**
         * !property
         */
        type: types.literal('LinearAlignmentsDisplay')
```
#### property: configuration


```js

        /**
         * !property
         */
        configuration: ConfigurationReference(configSchema)
```
#### property: height


```js

        /**
         * !property
         */
        height: 250
```
#### property: showCoverage


```js

        /**
         * !property
         */
        showCoverage: true
```
#### property: showPileup


```js

        /**
         * !property
         */
        showPileup: true
```
#### property: userFeatureScreenDensity


```js

        /**
         * !property
         */
        userFeatureScreenDensity: types.maybe(types.number)
```
#### action: toggleCoverage



```js
// Type signature
toggleCoverage: () => void
```
#### property: showCoverage


```js

        self.showCoverage
```
#### property: showCoverage


```js
self.showCoverage
```
#### action: togglePileup



```js
// Type signature
togglePileup: () => void
```
#### property: showPileup


```js

        self.showPileup
```
#### property: showPileup


```js
self.showPileup
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
#### property: snpCovHeight


```js

        self.snpCovHeight
```
#### getter: pileupDisplayConfig



```js
// Type
any
```
#### property: configuration


```js
self.configuration
```
#### method: getFeatureByID

```js
// Type signature
getFeatureByID: (blockKey: string, id: string) => any
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
#### method: searchFeatureByID

```js
// Type signature
searchFeatureByID: (id: string) => any
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
#### getter: features



```js
// Type
any
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
#### getter: DisplayBlurb



```js
// Type
any
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
#### getter: sortedBy



```js
// Type
any
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
#### getter: sortedByPosition



```js
// Type
any
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
#### getter: sortedByRefName



```js
// Type
any
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
#### getter: snpCoverageDisplayConfig



```js
// Type
any
```
#### property: configuration


```js
self.configuration
```
#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
#### property: SNPCoverageDisplay


```js
 self.SNPCoverageDisplay
```
#### action: setSNPCoverageDisplay



```js
// Type signature
setSNPCoverageDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```
#### property: SNPCoverageDisplay


```js

        self.SNPCoverageDisplay
```
#### property: snpCovHeight


```js
 self.snpCovHeight
```
#### action: setUserFeatureScreenDensity



```js
// Type signature
setUserFeatureScreenDensity: (limit: number) => void
```
#### property: PileupDisplay


```js

        self.PileupDisplay
```
#### property: SNPCoverageDisplay


```js

        self.SNPCoverageDisplay
```
#### action: setPileupDisplay



```js
// Type signature
setPileupDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```
#### property: PileupDisplay


```js

        self.PileupDisplay
```
#### action: setHeight



```js
// Type signature
setHeight: (displayHeight: number) => number
```
#### property: height


```js

          self.height
```
#### property: height


```js

          self.height
```
#### property: height


```js
 self.height
```
#### action: resizeHeight



```js
// Type signature
resizeHeight: (distance: number) => number
```
#### property: height


```js
 self.height
```
#### property: height


```js
self.height
```
#### property: SNPCoverageDisplay


```js
self.SNPCoverageDisplay
```
#### action: setSNPCoverageDisplay



```js
// Type signature
setSNPCoverageDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```
#### getter: snpCoverageDisplayConfig



```js
// Type
any
```
#### getter: snpCoverageDisplayConfig



```js
// Type
any
```
#### property: SNPCoverageDisplay


```js
self.SNPCoverageDisplay
```
#### property: SNPCoverageDisplay


```js

              self.SNPCoverageDisplay
```
#### property: snpCovHeight


```js
self.snpCovHeight
```
#### property: SNPCoverageDisplay


```js

              self.SNPCoverageDisplay
```
#### getter: snpCoverageDisplayConfig



```js
// Type
any
```
#### property: PileupDisplay


```js
self.PileupDisplay
```
#### action: setPileupDisplay



```js
// Type signature
setPileupDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```
#### getter: pileupDisplayConfig



```js
// Type
any
```
#### getter: pileupDisplayConfig



```js
// Type
any
```
#### property: PileupDisplay


```js
self.PileupDisplay
```
#### property: PileupDisplay


```js

              self.PileupDisplay
```
#### getter: pileupDisplayConfig



```js
// Type
any
```
#### property: PileupDisplay


```js

              self.PileupDisplay
```
#### property: PileupDisplay


```js
self.PileupDisplay
```
#### property: SNPCoverageDisplay


```js
self.SNPCoverageDisplay
```
#### property: SNPCoverageDisplay


```js

              self.SNPCoverageDisplay
```
#### property: PileupDisplay


```js
self.PileupDisplay
```
#### property: PileupDisplay


```js

              self.PileupDisplay
```
#### property: PileupDisplay


```js
self.PileupDisplay
```
#### property: SNPCoverageDisplay


```js

                self.SNPCoverageDisplay
```
#### property: SNPCoverageDisplay


```js
self.SNPCoverageDisplay
```
#### property: SNPCoverageDisplay


```js

              self.SNPCoverageDisplay
```
#### property: PileupDisplay


```js
self.PileupDisplay
```
#### action: setSNPCoverageHeight



```js
// Type signature
setSNPCoverageHeight: (n: number) => void
```
#### property: SNPCoverageDisplay


```js
self.SNPCoverageDisplay
```
#### action: renderSvg



```js
// Type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<Element>
```
#### property: height


```js
 self.height
```
#### property: SNPCoverageDisplay


```js
 self.SNPCoverageDisplay
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
#### property: SNPCoverageDisplay


```js
 self.SNPCoverageDisplay
```
#### property: SNPCoverageDisplay


```js
self.SNPCoverageDisplay
```
#### property: PileupDisplay


```js
 self.PileupDisplay
```
