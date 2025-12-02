---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultiLinearWiggleDisplay.md)

## Docs

extends

- [SharedWiggleMixin](../sharedwigglemixin)

### MultiLinearWiggleDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"MultiLinearWiggleDisplay">
// code
type: types.literal('MultiLinearWiggleDisplay')
```

#### property: layout

```js
// type signature
IOptionalIType<IType<Source[], Source[], Source[]>, [undefined]>
// code
layout: types.optional(types.frozen<Source[]>(), [])
```

#### property: showSidebar

```js
// type signature
true
// code
showSidebar: true
```

### MultiLinearWiggleDisplay - Getters

#### getter: featureUnderMouse

```js
// type
Feature
```

#### getter: TooltipComponent

```js
// type
React.ComponentType<any>
```

#### getter: rendererTypeName

```js
// type
string
```

#### getter: graphType

```js
// type
boolean
```

#### getter: needsFullHeightScalebar

```js
// type
boolean
```

#### getter: isMultiRow

```js
// type
boolean
```

#### getter: needsCustomLegend

can be used to give it a "color scale" like a R heatmap, not implemented like
this yet but flag can be used for this

```js
// type
boolean
```

#### getter: canHaveFill

```js
// type
boolean
```

#### getter: renderColorBoxes

the multirowxy and multiline don't need to use colors on the legend boxes since
their track is drawn with the color. sort of a stylistic choice

```js
// type
boolean
```

#### getter: prefersOffset

positions multi-row below the tracklabel even if using overlap tracklabels for
everything else

```js
// type
any
```

#### getter: sourcesWithoutLayout

```js
// type
{ color: any; baseUri?: string; name: string; source: string; group?: string; }[]
```

#### getter: sources

```js
// type
{ color: any; baseUri?: string; name: string; source: string; group?: string; }[]
```

#### getter: quantitativeStatsReady

```js
// type
boolean
```

#### getter: rowHeight

```js
// type
number
```

#### getter: rowHeightTooSmallForScalebar

```js
// type
boolean
```

#### getter: useMinimalTicks

```js
// type
any
```

#### getter: ticks

```js
// type
{ range: number[]; values: number[]; format: (d: NumberValue) => string; position: ScaleLinear<number, number, never> | ScaleQuantize<number, never>; }
```

#### getter: colors

```js
// type
string[]
```

#### getter: quantitativeStatsRelevantToCurrentZoom

unused currently

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

#### getter: fillSetting

```js
// type
;0 | 1 | 2
```

### MultiLinearWiggleDisplay - Methods

#### method: adapterProps

```js
// type signature
adapterProps: () => any
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: renderingProps

```js
// type signature
renderingProps: () => { displayModel: { id: string; type: "MultiLinearWiggleDisplay"; rpcDriverName: string; heightPreConfig: number; userBpPerPxLimit: number; userByteSizeLimit: number; blockState: IMSTMap<IModelType<...>> & IStateTreeNode<...>; ... 16 more ...; showSidebar: boolean; } & ... 35 more ... & IStateTreeNode<...>; onMo...
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; })[]
```

### MultiLinearWiggleDisplay - Actions

#### action: setShowSidebar

```js
// type signature
setShowSidebar: (arg: boolean) => void
```

#### action: setSourcesLoading

```js
// type signature
setSourcesLoading: (str: string) => void
```

#### action: setLayout

```js
// type signature
setLayout: (layout: Source[]) => void
```

#### action: clearLayout

```js
// type signature
clearLayout: () => void
```

#### action: setSources

```js
// type signature
setSources: (sources: Source[]) => void
```

#### action: setFeatureUnderMouse

```js
// type signature
setFeatureUnderMouse: (f?: Feature) => void
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```
