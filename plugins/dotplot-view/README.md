# @jbrowse/plugin-dotplot-view

JBrowse 2 dotplot view

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### dotplotTables

A dotplot as the display fetches, lays out and colors it, as tables:
`alignments`, each block with its span on each axis, its strand, name and
measurements, in the color the view's `color` paints it; `segments`, the lines
the plot draws in paint order, one per block, or one per CIGAR step where a
block is wide enough on screen for its CIGAR to show, each from (`xStart`,
`yStart`) to (`xEnd`, `yEnd`) in genomic coordinates on the axis's region named
by `xRegion` and `yRegion`; `legend`, the key; and `config`, the view's settings
with their defaults filled, `color` and `opacity` as config objects. `skipped`
counts the blocks neither axis places. For a host that draws them itself, such
as R through V8.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, x, y, view }: DotplotTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/tables.ts)

<!-- API_DOCS_END -->
