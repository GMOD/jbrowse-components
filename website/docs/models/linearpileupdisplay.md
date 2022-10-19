---
id: linearpileupdisplay
title: LinearPileupDisplay
toplevel: true
---



#### property: type


```js

        /**
         * !property
         */
        type: types.literal('LinearPileupDisplay')
```
#### property: configuration


```js

        /**
         * !property
         */
        configuration: ConfigurationReference(configSchema)
```
#### property: showSoftClipping


```js

        /**
         * !property
         */
        showSoftClipping: false
```
#### property: featureHeight


```js

        /**
         * !property
         */
        featureHeight: types.maybe(types.number)
```
#### property: noSpacing


```js

        /**
         * !property
         */
        noSpacing: types.maybe(types.boolean)
```
#### property: fadeLikelihood


```js

        /**
         * !property
         */
        fadeLikelihood: types.maybe(types.boolean)
```
#### property: trackMaxHeight


```js

        /**
         * !property
         */
        trackMaxHeight: types.maybe(types.number)
```
#### property: mismatchAlpha


```js

        /**
         * !property
         */
        mismatchAlpha: types.maybe(types.boolean)
```
#### property: sortedBy


```js

        /**
         * !property
         */
        sortedBy: types.maybe(
          types.model({
            type: types.string,
            pos: types.number,
            tag: types.maybe(types.string),
            refName: types.string,
            assemblyName: types.string,
          }),
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
            extra: types.frozen(),
          }),
        )
```
#### action: setReady



```js
// Type signature
setReady: (flag: boolean) => void
```
#### action: setMaxHeight



```js
// Type signature
setMaxHeight: (n: number) => void
```
#### property: trackMaxHeight


```js

        self.trackMaxHeight
```
#### action: setFeatureHeight



```js
// Type signature
setFeatureHeight: (n: number) => void
```
#### property: featureHeight


```js

        self.featureHeight
```
#### action: setNoSpacing



```js
// Type signature
setNoSpacing: (flag: boolean) => void
```
#### property: noSpacing


```js

        self.noSpacing
```
#### action: setColorScheme



```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```
#### property: colorBy


```js
 // clear existing mapping
        self.colorBy
```
#### action: updateModificationColorMap



```js
// Type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```
#### action: updateColorTagMap



```js
// Type signature
updateColorTagMap: (uniqueTag: string[]) => void
```
#### action: setFeatureUnderMouse



```js
// Type signature
setFeatureUnderMouse: (feat?: Feature) => void
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
#### action: updateColorTagMap



```js
// Type signature
updateColorTagMap: (uniqueTag: string[]) => void
```
#### action: updateModificationColorMap



```js
// Type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```
#### getter: rendererType


the pluggable element type object for this display's
renderer
```js
// Type
RendererType
```
#### property: id


```js
 view.id
```
#### method: renderProps
the react props that are passed to the Renderer when data
is rendered in this display
```js
// Type signature
renderProps: any
```
#### action: setReady



```js
// Type signature
setReady: (flag: boolean) => void
```
#### action: setCurrBpPerPx



```js
// Type signature
setCurrBpPerPx: (n: number) => void
```
#### action: setReady



```js
// Type signature
setReady: (flag: boolean) => void
```
#### action: setError



```js
// Type signature
setError: (error?: unknown) => void
```
#### getter: featureUnderMouse



```js
// Type
any
```
#### action: setFeatureUnderMouse



```js
// Type signature
setFeatureUnderMouse: (feat?: Feature) => void
```
#### action: setFeatureUnderMouse



```js
// Type signature
setFeatureUnderMouse: (feat?: Feature) => void
```
#### action: selectFeature



```js
// Type signature
selectFeature: (feature: Feature) => void
```
#### action: clearSelected



```js
// Type signature
clearSelected: () => void
```
#### property: sortedBy


```js

        self.sortedBy
```
#### action: copyFeatureToClipboard


uses copy-to-clipboard and generates notification
```js
// Type signature
copyFeatureToClipboard: (feature: Feature) => void
```
#### action: toggleSoftClipping



```js
// Type signature
toggleSoftClipping: () => void
```
#### property: showSoftClipping


```js

        self.showSoftClipping
```
#### property: showSoftClipping


```js
self.showSoftClipping
```
#### action: toggleMismatchAlpha



```js
// Type signature
toggleMismatchAlpha: () => void
```
#### property: mismatchAlpha


```js

        self.mismatchAlpha
```
#### property: mismatchAlpha


```js
self.mismatchAlpha
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
#### action: setSortedBy



```js
// Type signature
setSortedBy: (type: string, tag?: string) => void
```
#### property: sortedBy


```js


        self.sortedBy
```
#### action: reload


base display reload does nothing, see specialized displays for details
```js
// Type signature
reload: any
```
#### action: reload



```js
// Type signature
reload: () => void
```
#### action: clearSelected



```js
// Type signature
clearSelected: () => void
```
#### getter: maxHeight



```js
// Type
any
```
#### property: trackMaxHeight


```js
 self.trackMaxHeight
```
#### property: trackMaxHeight


```js
 self.trackMaxHeight
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
#### property: featureHeight


```js
 self.featureHeight
```
#### property: noSpacing


```js
 self.noSpacing
```
#### property: mismatchAlpha


```js
 self.mismatchAlpha
```
#### getter: featureHeightSetting



```js
// Type
any
```
#### property: featureHeight


```js

          self.featureHeight
```
#### getter: mismatchAlphaSetting



```js
// Type
any
```
#### property: mismatchAlpha


```js
 self.mismatchAlpha
```
#### property: mismatchAlpha


```js
 self.mismatchAlpha
```
#### getter: featureUnderMouse



```js
// Type
Feature
```
#### getter: rendererTypeName



```js
// Type
string
```
#### method: contextMenuItems

```js
// Type signature
contextMenuItems: () => { label: string; icon: any; onClick: () => void; }[]
```
#### action: clearFeatureSelection



```js
// Type signature
clearFeatureSelection: () => void
```
#### action: selectFeature



```js
// Type signature
selectFeature: any
```
#### action: copyFeatureToClipboard


uses copy-to-clipboard and generates notification
```js
// Type signature
copyFeatureToClipboard: (feature: Feature) => void
```
#### getter: DisplayBlurb



```js
// Type
any
```
#### method: renderProps

```js
// Type signature
renderProps: () => any
```
#### property: bpPerPx


```js
 view.bpPerPx
```
#### property: showSoftClipping


```js
 self.showSoftClipping
```
#### getter: rendererConfig



```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```
#### action: clearFeatureSelection



```js
// Type signature
clearFeatureSelection: () => void
```
#### action: selectFeature



```js
// Type signature
selectFeature: any
```
#### action: clearFeatureSelection



```js
// Type signature
clearFeatureSelection: () => void
```
#### action: clearFeatureSelection



```js
// Type signature
clearFeatureSelection: () => void
```
#### action: setContextMenuFeature



```js
// Type signature
setContextMenuFeature: (feature?: Feature) => void
```
#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```
#### property: showSoftClipping


```js
 self.showSoftClipping
```
#### action: toggleSoftClipping



```js
// Type signature
toggleSoftClipping: () => void
```
#### property: showSoftClipping


```js
self.showSoftClipping
```
#### action: clearSelected



```js
// Type signature
clearSelected: () => void
```
#### property: showSoftClipping


```js
 self.showSoftClipping
```
#### action: setSortedBy



```js
// Type signature
setSortedBy: (type: string, tag?: string) => void
```
#### action: clearSelected



```js
// Type signature
clearSelected: () => void
```
#### action: setColorScheme



```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```
#### action: setColorScheme



```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```
#### action: setColorScheme



```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```
#### action: setColorScheme



```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```
#### action: setColorScheme



```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```
#### action: setColorScheme



```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```
#### action: setColorScheme



```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```
#### action: setColorScheme



```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```
#### getter: mismatchAlphaSetting



```js
// Type
any
```
#### action: toggleMismatchAlpha



```js
// Type signature
toggleMismatchAlpha: () => void
```
#### getter: dynamicBlocks


dynamic blocks represent the exact coordinates of the currently
visible genome regions on the screen. they are similar to static
blocks, but statcic blocks can go offscreen while dynamic blocks
represent exactly what is on screen
```js
// Type
BlockSet
```
