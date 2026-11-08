# @jbrowse/plugin-wiggle

JBrowse 2 wiggle adapters, tracks, etc.

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### staticWiggleSvg

A quantitative track's display as its SVG export draws it, with no session: the
fetch the display issues over `frame`, then the display's own views on the
wiggle static host, then its export body in the display shell. The frame's
regions are the assembly's, as a view's are; `renameRegions` puts them in the
file's names for the fetch. The adapters must be registered on `pluginManager`.

```js
// type signature
(pluginManager: PluginManager, args: StaticWiggleSvgArgs) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | AwaitedReactNode>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/staticSvg.tsx)

### wiggleScoreMatrix

The matrix the multi-row wiggle display's "Cluster rows" clusters, over
`regions` at `bpPerPx` as `wiggleTables` reads them (`getScoreMatrix`): `rows`,
a source each, named as `wiggleTables`' `sources` names them and in its order;
`columns`, a pixel each, the regions end to end, with its `region`'s index, the
0-based `start` of the base at its left edge, and its `name`, that base 1-based
after the region's contig as the call names it (`ctgA:1001`); and `values`,
row-major, each pixel's mean of the summary the display plots over the bins
covering it, placed where a log or symlog axis draws it, NaN where no bin covers
it.

```js
// type signature
(pluginManager: PluginManager, args: WiggleTablesArgs) => Promise<{ rows: string[]; columns: { region: number[]; start: number[]; name: string[]; }; values: Float32Array<ArrayBuffer>; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/tables.ts)

### wiggleTables

A region, or several, of a quantitative track as the wiggle display fetches,
scales and colors it, as tables: `bins`, each source's scores as the worker
ships them at this zoom (the bin's score, and its min and max where the file
summarizes); `summaryField`, which of them the display plots (`score`,
`minScore` or `maxScore`); `marks`, the layers the display's encoder builds from
them in paint order (the plotted summary, and under a min-max extent the tinted
max and min bands, or a line's min-to-max `band`), each mark in the color it
paints and reaching down to `low`, the band's min or the origin bars grow from,
and on a bar `clipSide`, 1 where its score passes the domain's top and -1 its
bottom, where the display paints `clipStrip` (its `color`, `px` tall) across the
row's edge, else 0; `scoreScale`, the score axis the display autoscales to under
`encoding.y`, its `domain`, `type` and `symlogConstant`; `rules`, the reference
lines it draws, none where it rules no band, as a density plot does not;
`ramps`, the color bar its key shows where one ramp paints every row
(`rampKeyOf`); `legend` and `legendTitle`, the categorical key beside it
(`colorKeyTables`): the threshold bands and the row color key, the subtracks of
an overlay or a `rows.color` field's values; and `warnings`, the samples file's.
For a host that draws them itself, such as R through V8. The adapters must be
registered on `pluginManager` (`registerWiggleAdapters`).

```js
// type signature
(pluginManager: PluginManager, args: WiggleTablesArgs) => Promise<{ bins: {…}; marks: {…}; sources: {…}; rules: {…}; ramps: {…}[]; legend: { label: string[]; color: string[]; section: string[]; }; legendTitle: string; scoreScale: { domain: [number, number]; type: "linear" | "log" | "symlog"; symlogConstant: number; }; clipStrip: { color: string; px: number; }; summaryField: "maxScore" | "minScore" | "score"; mark: "bar" | "line" | "point" | "rect"; interpolate: "linear" | "step"; origin: number; rowLayout: boolean; height: number; config: Record<string, unknown>; warnings: string[]; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/tables.ts)

<!-- API_DOCS_END -->
