---
id: linearsnpcoveragedisplay
title: LinearSNPCoverageDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearSNPCoverageDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearSNPCoverageDisplay.md)

## Docs

extends

- [LinearWiggleDisplay](../linearwiggledisplay)

### LinearSNPCoverageDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearSNPCoverageDisplay">
// code
type: types.literal('LinearSNPCoverageDisplay')
```

#### property: showInterbaseCounts

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showInterbaseCounts: types.maybe(types.boolean)
```

#### property: showInterbaseIndicators

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showInterbaseIndicators: types.maybe(types.boolean)
```

#### property: showArcs

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showArcs: types.maybe(types.boolean)
```

#### property: minArcScore

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minArcScore: types.optional(types.number, 0)
```

#### property: filterBySetting

```js
// type signature
IType<FilterBy, FilterBy, FilterBy>
// code
filterBySetting: types.frozen<FilterBy | undefined>()
```

#### property: colorBySetting

```js
// type signature
IType<ColorBy, ColorBy, ColorBy>
// code
colorBySetting: types.frozen<ColorBy | undefined>()
```

#### property: jexlFilters

```js
// type signature
IOptionalIType<IArrayType<ISimpleType<string>>, [undefined]>
// code
jexlFilters: types.optional(types.array(types.string), [])
```

### LinearSNPCoverageDisplay - Getters

#### getter: colorBy

```js
// type
any
```

#### getter: filterBy

```js
// type
any
```

#### getter: modificationThreshold

```js
// type
any
```

#### getter: rendererConfig

```js
// type
{
  showInterbaseCounts: any
  showInterbaseIndicators: any
  showArcs: any
}
```

#### getter: showArcsSetting

```js
// type
any
```

#### getter: skipFeatures

Collect all skip features from rendered blocks for cross-region arc drawing Uses
a Map to deduplicate features that appear in multiple blocks Only computed when
showArcsSetting is true for performance Filters out arcs with score below
minArcScore

```js
// type
Feature[]
```

#### getter: showInterbaseCountsSetting

```js
// type
any
```

#### getter: showInterbaseIndicatorsSetting

```js
// type
any
```

#### getter: autorunReady

```js
// type
boolean
```

#### getter: renderReady

```js
// type
;() => boolean
```

#### getter: TooltipComponent

```js
// type
LazyExoticComponent<(props: { model: { featureUnderMouse?: Feature; mouseoverExtraInformation?: string; visibleModifications: Map<string, { color: string; base: string; strand: string; }>; simplexModifications?: Set<string>; }; height: number; offsetMouseCoord: [...]; clientMouseCoord: [...]; clientRect?: DOMRect; }...
```

#### getter: adapterConfig

```js
// type
{
  type: string
  subadapter: any
  sequenceAdapter: unknown
}
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

#### getter: filters

```js
// type
any
```

### LinearSNPCoverageDisplay - Methods

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
renderingProps: () => { displayModel: { [x: string]: any; heightPreConfig: number; userBpPerPxLimit: number; userByteSizeLimit: number; blockState: IMSTMap<IModelType<{ key: ISimpleType<string>; region: IType<...>; reloadFlag: IType<...>; isLeftEndOfDisplayedRegion: IType<...>; isRightEndOfDisplayedRegion: IType<...>; }, { ...; } &...
```

#### method: renderSvg

Custom renderSvg that includes sashimi arcs

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => any[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => any[]
```

#### method: legendItems

Returns legend items for SNP coverage display

```js
// type signature
legendItems: (theme: Theme) => LegendItem[]
```

### LinearSNPCoverageDisplay - Actions

#### action: setConfig

```js
// type signature
setConfig: (configuration: AnyConfigurationModel) => void
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filter: FilterBy) => void
```

#### action: setColorScheme

```js
// type signature
setColorScheme: (colorBy?: ColorBy) => void
```

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (filters: string[]) => void
```

#### action: setShowInterbaseIndicators

```js
// type signature
setShowInterbaseIndicators: (arg: boolean) => void
```

#### action: setShowInterbaseCounts

```js
// type signature
setShowInterbaseCounts: (arg: boolean) => void
```

#### action: setShowArcs

```js
// type signature
setShowArcs: (arg: boolean) => void
```

#### action: setMinArcScore

```js
// type signature
setMinArcScore: (arg: number) => void
```
