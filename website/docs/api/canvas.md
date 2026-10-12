---
id: canvas
title: canvas
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## featureTables

A region's features, or several regions', as the feature display
(`LinearBasicDisplay`) fetches, shapes, lays out and colors them, as
tables: each top-level feature on the
row the display's layout gives it, the boxes, intron lines, chevrons and
strand arrows its glyph draws, its transcripts, the labels the display
shows beside it at this zoom, and the color key, a ramp's as `ramps`
(`rampKeyOf`). For a host that draws them itself, such as R through V8. The
adapters must be registered on `pluginManager`.

Coordinates are 0-based genomic; every `y`, `top` and height is in the
display's px, down from the track's top, `feature` is a 0-based index into
`features`, and `region` the index of the row's region. Regions of one
contig share one layout, as the display packs them, so a feature crossing
them is listed in each on the same row. The layout is the display's under
its `heightMode` and `height`: `fit` (the default) runs the display's fit
ladder, so the labels, isoforms and row heights the browser gives up to fit
the track are given up here too, and `grow` places every feature at full
size. A feature the packer could not place within its 10000 px row ceiling
is left out of every table and counted in `truncated`; the legend keys what
the worker painted, such a feature included, as the browser's key does.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, region, regions, display, bpPerPx, colorByCDS, byteLimit, }: FeatureTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/tables.ts)
