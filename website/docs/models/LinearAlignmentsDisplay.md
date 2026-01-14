---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearAlignmentsDisplay.md)

## Docs

extends

- [BaseDisplay](../basedisplay)
- [LinearAlignmentsDisplayMixin](../linearalignmentsdisplaymixin)

### LinearAlignmentsDisplay - Getters

#### getter: height

```js
// type
any
```

#### getter: featureIdUnderMouse

```js
// type
any
```

#### getter: showLegend

Returns true if PileupDisplay has legend shown

```js
// type
any
```

#### getter: pileupConf

```js
// type
any
```

#### getter: features

```js
// type
any
```

#### getter: DisplayBlurb

```js
// type
any
```

#### getter: sortedBy

```js
// type
any
```

#### getter: coverageConf

```js
// type
any
```

### LinearAlignmentsDisplay - Methods

#### method: svgLegendWidth

Returns the width needed for the SVG legend from subdisplays. Used by SVG export
to add extra width for the legend area.

```js
// type signature
svgLegendWidth: (theme?: unknown) => number
```

#### method: getFeatureByID

```js
// type signature
getFeatureByID: (blockKey: string, id: string) => any
```

#### method: searchFeatureByID

```js
// type signature
searchFeatureByID: (id: string) => any
```

#### method: notReady

```js
// type signature
notReady: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### LinearAlignmentsDisplay - Actions

#### action: setScrollTop

```js
// type signature
setScrollTop: (scrollTop: number) => void
```

#### action: setSNPCoverageHeight

```js
// type signature
setSNPCoverageHeight: (n: number) => void
```

#### action: setShowLegend

Toggle legend visibility on the PileupDisplay sub-display

```js
// type signature
setShowLegend: (s: boolean) => void
```

#### action: setSNPCoverageDisplay

```js
// type signature
setSNPCoverageDisplay: (configuration: AnyConfigurationModel) => void
```

#### action: setFeatureDensityStatsLimit

```js
// type signature
setFeatureDensityStatsLimit: (stats?: FeatureDensityStats) => void
```

#### action: setPileupDisplay

```js
// type signature
setPileupDisplay: (configuration: AnyConfigurationModel) => void
```

#### action: setHeight

```js
// type signature
setHeight: (n: number) => number
```

#### action: setLowerPanelType

```js
// type signature
setLowerPanelType: (type: string) => void
```

#### action: resizeHeight

```js
// type signature
resizeHeight: (distance: number) => number
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```
