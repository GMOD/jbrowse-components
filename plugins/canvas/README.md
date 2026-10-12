# @jbrowse/plugin-canvas

JBrowse 2 plugin for canvas features

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### featureTables

A region's features as the feature display (`LinearBasicDisplay`) fetches,
shapes, lays out and colors them, as tables: each top-level feature on the row
the display's layout gives it, the boxes, intron lines, chevrons and strand
arrows its glyph draws, its transcripts, the labels the display shows beside it
at this zoom, and the color key, a ramp's as `ramps` (`rampKeyOf`). For a host
that draws them itself, such as R through V8. The adapters must be registered on
`pluginManager`.

Coordinates are 0-based genomic; every `y`, `top` and height is in the display's
px, down from the track's top, and `feature` is a 0-based index into `features`.
The layout is the display's under its `heightMode` and `height`: `fit` (the
default) runs the display's fit ladder, so the labels, isoforms and row heights
the browser gives up to fit the track are given up here too, and `grow` places
every feature at full size.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, region, display, bpPerPx, colorByCDS, byteLimit, }: FeatureTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/tables.ts)

<!-- API_DOCS_END -->
