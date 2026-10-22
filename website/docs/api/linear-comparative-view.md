---
id: linear-comparative-view
title: "@jbrowse/plugin-linear-comparative-view"
description: "JBrowse 2 linear comparative view"
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## multiwayTables

A multi-genome synteny track as the multi-way display stacks it under a
linear genome view, as tables: `lanes`, the anchor first and then each
mate lane in the order a fresh load stacks it, with the contig, zoom and orientation
it picked; `segments`, the stretches of each lane's sequence across the
view, cut where a lane opens a hole for a deletion, each with the px it
spans; `blocks`, each alignment's placement on each lane; `ribbons`, what
each gutter draws in paint order, a trapezoid from a span on its upper
lane to a span on its lower one, with its color and the alpha it
composites at; `alignments`, the records the ribbons draw; `legend`, the
key; and `config`, the display's config with its defaults filled. Positions are genomic on each lane, and px across the view's
`width`, where a lane's own frame puts them.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, anchor: anchorArgs, pins, flips, display, }: MultiWayTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/multiwayTables.ts)

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
`legend` and `ramps`, the key; and `config`, the view's settings with
their defaults filled, `color` and `opacity` as config objects. For a host that draws
them itself, such as R through V8. Positions are genomic, on the axis's
region named by `queryRegion` and `targetRegion`.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, query, target, view }: SyntenyTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/tables.ts)
