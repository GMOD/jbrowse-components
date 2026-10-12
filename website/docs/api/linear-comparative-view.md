---
id: linear-comparative-view
title: linear-comparative-view
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## syntenyTables

A pair of rows of a linear synteny view as the display fetches, lays out
and colors it, as tables: `alignments`, each alignment block the two rows
share, with its span on each, its strand, name and measurements, in the
color the view's `color` paints it; `ribbons`, what the band draws between
the rows in paint order, each a trapezoid from a span on the query row to
a span on the target row (`match` for the block, `insertion`, `deletion`
and `skip` for the CIGAR ops wide enough to draw, `marker` for a location
tick), with its color and the alpha it composites at, and whether it draws
as a centerline; `offscreen`, the blocks whose mate lies on a contig the
other row is not showing, in the color the strip along that row's edge
paints them, `offscreenContigs`, the count and aligned bp of each such
contig and the line its hover prints, and `offscreenStrip`, the marks and
labels the strips along the band's edges paint, in px;
and `legend` and `ramps`, the key. For a host that draws
them itself, such as R through V8. Positions are genomic, on the axis's
region named by `queryRegion` and `targetRegion`.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, query, target, view }: SyntenyTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/tables.ts)
