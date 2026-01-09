---
id: linearreadarcsdisplay
title: LinearReadArcsDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadArcsDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearReadArcsDisplay.md)

## Docs

the arc display is a non-block-based track, so draws to a single canvas and can
connect multiple regions extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)

### LinearReadArcsDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearReadArcsDisplay">
// code
type: types.literal('LinearReadArcsDisplay')
```

#### property: configuration

```js
// type signature
any
// code
configuration: ConfigurationReference(configSchema)
```

#### property: showLegend

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showLegend: types.maybe(types.boolean)
```

### LinearReadArcsDisplay - Getters

#### getter: colorBy

Get the color settings (from override or configuration)

```js
// type
any
```

#### getter: filterBy

Get the filter settings (from override or configuration)

```js
// type
any
```

### LinearReadArcsDisplay - Methods

#### method: legendItems

Returns legend items based on current colorBy setting

```js
// type signature
legendItems: () => LegendItem[]
```

#### method: svgLegendWidth

Returns the width needed for the SVG legend if showLegend is enabled. Used by
SVG export to add extra width for the legend area.

```js
// type signature
svgLegendWidth: () => number
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => any[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>
```

### LinearReadArcsDisplay - Actions

#### action: setShowLegend

```js
// type signature
setShowLegend: (s: boolean) => void
```

#### action: reload

Reload the display (clears error state)

```js
// type signature
reload: () => void
```
