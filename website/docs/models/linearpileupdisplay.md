---
id: linearpileupdisplay
title: LinearPileupDisplay
toplevel: true
---

#### property: type

```js
type: types.literal('LinearPileupDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### property: showSoftClipping

```js
showSoftClipping: false
```

#### property: featureHeight

```js
featureHeight: types.maybe(types.number)
```

#### property: noSpacing

```js
noSpacing: types.maybe(types.boolean)
```

#### property: fadeLikelihood

```js
fadeLikelihood: types.maybe(types.boolean)
```

#### property: trackMaxHeight

```js
trackMaxHeight: types.maybe(types.number)
```

#### property: mismatchAlpha

```js
mismatchAlpha: types.maybe(types.boolean)
```

#### property: sortedBy

```js
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

#### action: setFeatureHeight

```js
// Type signature
setFeatureHeight: (n: number) => void
```

#### action: setNoSpacing

```js
// Type signature
setNoSpacing: (flag: boolean) => void
```

#### action: setColorScheme

```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
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

#### action: setCurrBpPerPx

```js
// Type signature
setCurrBpPerPx: (n: number) => void
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

#### action: toggleMismatchAlpha

```js
// Type signature
toggleMismatchAlpha: () => void
```

#### action: setConfig

```js
// Type signature
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setSortedBy

```js
// Type signature
setSortedBy: (type: string, tag?: string) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```js
// Type signature
reload: any
```

#### getter: maxHeight

```js
// Type
any
```

#### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: featureHeightSetting

```js
// Type
any
```

#### getter: mismatchAlphaSetting

```js
// Type
any
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

#### getter: DisplayBlurb

```js
// Type
any
```

#### property: bpPerPx

bpPerPx corresponds roughly to the zoom level, base-pairs per pixel

```js
view.bpPerPx
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

#### getter: dynamicBlocks

dynamic blocks represent the exact coordinates of the currently
visible genome regions on the screen. they are similar to static
blocks, but statcic blocks can go offscreen while dynamic blocks
represent exactly what is on screen

```js
// Type
BlockSet
```
