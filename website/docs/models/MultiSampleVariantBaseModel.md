---
id: multisamplevariantbasemodel
title: MultiSampleVariantBaseModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/shared/MultiSampleVariantBaseModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultiSampleVariantBaseModel.md)

## Docs

extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)

### MultiSampleVariantBaseModel - Getters

#### getter: featuresVolatile

SimpleFeature instances derived from the simplifiedFeatures list in the most
recent cellData payload. Cached by MobX while cellData is unchanged. Named
`featuresVolatile` for backwards-compat with consumers that originally read it
as a volatile field.

```js
// type
Feature[] | undefined
```

#### getter: hasPhased

```js
// type
boolean
```

#### getter: sampleInfo

```js
// type
Record<string, SampleInfo> | undefined
```

#### getter: renderingMode

Returns the effective rendering mode, falling back to config

```js
// type
string
```

#### getter: minorAlleleFrequencyFilter

Returns the effective minor allele frequency filter, falling back to config

```js
// type
number
```

#### getter: sources

sourcesBase expanded for phased rendering when sampleInfo is available. Sources
already carrying HP (from clustering) pass through unchanged.

```js
// type
ProcessedSource[] | undefined
```

#### getter: editableSources

Layout-merged, phased-expanded view for the Edit Color/Arrangement dialog. Does
NOT apply the subtree filter — submitting the dialog persists every row back to
`layout`, so filtered samples must be present or they would be wiped from layout
on submit.

```js
// type
ProcessedSource[] | undefined
```

#### getter: sourceMap

```js
// type
{ [k: string]: Source; } | undefined
```

#### getter: availableHeight

Available height for rows (total height minus lineZoneHeight)

```js
// type
number
```

#### getter: nrow

```js
// type
number
```

#### getter: autoRowHeight

```js
// type
number
```

#### getter: rowHeight

rowHeightMode === 0 means auto-fit (computed from availableHeight / nrow); any
positive value is a user-pinned height. `resizeHeight` scales pinned values
proportionally so manual + display-resize stay in sync without snap-back
fuzziness.

```js
// type
number
```

#### getter: hierarchy

```js
// type
PositionedHierarchyNode<NewickNode> | undefined
```

#### getter: canDisplayLabels

```js
// type
boolean
```

#### getter: totalHeight

```js
// type
number
```

#### getter: featuresReady

```js
// type
boolean
```

### MultiSampleVariantBaseModel - Methods

#### method: showSubmenuItems

```js
// type signature
showSubmenuItems: () => ({ label: string; type: string; checked: boolean; onClick: () => void; disabled?: undefined; } | { label: string; type: string; checked: boolean; disabled: boolean; onClick: () => void; } | { label: string; onClick: () => void; type?: undefined; checked?: undefined; disabled?: undefined; })[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; } | { ...; })[]
```

#### method: getPortableSettings

```js
// type signature
getPortableSettings: () => { configOverrides: Record<string, unknown> & IStateTreeNode<IOptionalIType<IType<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>, [undefined]>>; ... 5 more ...; height: number; }
```

#### method: legendItems

Returns legend items for rendering colors based on current mode

```js
// type signature
legendItems: () => LegendItem[]
```

### MultiSampleVariantBaseModel - Actions

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (f?: string[] | undefined) => void
```

#### action: setShowLegend

```js
// type signature
setShowLegend: (s: boolean) => void
```

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: setRowHeight

```js
// type signature
setRowHeight: (arg: number) => void
```

#### action: setHoveredGenotype

```js
// type signature
setHoveredGenotype: (arg?: (Record<string, unknown> & { genotype: string; name: string; }) | undefined) => void
```

#### action: setSourcesLoading

```js
// type signature
setSourcesLoading: (token: StopToken) => void
```

#### action: setSources

```js
// type signature
setSources: (sources: Source[]) => void
```

#### action: clearLayout

Restore the configured default arrangement — empties the layout and clears the
cluster tree, then re-applies the `colorBy` palette if one is configured.
Overrides the mixin's `clearLayout` so the user gets the same starting state
they had on initial load.

```js
// type signature
clearLayout: () => void
```

#### action: setMafFilter

```js
// type signature
setMafFilter: (arg: number) => void
```

#### action: setPhasedMode

```js
// type signature
setPhasedMode: (arg: string) => void
```

#### action: setFitToHeight

Toggle auto height mode. When turning off, uses default of 10px per row.

```js
// type signature
setFitToHeight: () => void
```

#### action: resizeHeight

Override resizeHeight to scale row heights proportionally when the display is
vertically resized

```js
// type signature
resizeHeight: (distance: number) => number
```

#### action: setReferenceDrawingMode

```js
// type signature
setReferenceDrawingMode: (arg: string) => void
```
