# @jbrowse/plugin-linear-comparative-view

JBrowse 2 linear comparative view

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### isLinearSyntenyView

Whether a session's view is a synteny view, for a host that finds it in
`session.views` to draw it with `SyntenyStack`.

```js
// type signature
(view: unknown) => view is LinearSyntenyView
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/isLinearSyntenyView.ts)

### multiwayTables

A multi-genome synteny track as the multi-way display stacks it under a linear
genome view, as tables: `lanes`, the anchor first and then each mate lane in the
order a fresh load stacks it, with the contig, zoom and orientation it picked;
`segments`, the stretches of each lane's sequence across the view, cut where a
lane opens a hole for a deletion, each with the px it spans; `blocks`, each
alignment's placement on each lane; `ribbons`, what each gutter draws in paint
order, a trapezoid from a span on its upper lane to a span on its lower one,
with its color and the alpha it composites at; `alignments`, the records the
ribbons draw; `legend`, the key; and `config`, the display's config with its
defaults filled. Positions are genomic on each lane, and px across the view's
`width`, where a lane's own frame puts them. Heights are px down from the
stack's top as the display lays it out over `display.height`: `height` is the
whole stack, each lane's `yTop` and `yBottom` bound its gene boxes, and each
ribbon's bound its gutter, the height its `thin` flag and fade are measured at.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, anchor: anchorArgs, pins, hidden, display, }: MultiWayTablesArgs) => Promise<{ height: number; tickInterval: number; rowsVsAnchor: boolean; config: Record<…>; legend: {…}; legendTitle: string; ramps: {…}[]; ribbons: {…}; alignments: {…}; blocks: {…}; lanes: {…}; segments: { lane: number[]; chrom: string[]; start: number[]; end: number[]; x1: number[]; x2: number[]; }; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/multiwayTables.ts)

### SyntenyLevel

One ribbon band between two rows of a synteny view: the shared ribbon canvas,
with each synteny display's own tooltip, context menu and fetch status over it.
`children` draw over the band too.

The band takes its height from the level, not from what is drawn in it: the
canvas is absolutely positioned, and a level with no synteny track is legal. The
overlays come from `linearSyntenyDisplays`, the list the canvas uploads geometry
for, so a painted ribbon always has an overlay to hover.

```js
// type signature
({ level, children, }: { level: LinearSyntenyViewHelper; children?: ReactNode; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyViewHelper/SyntenyLevel.tsx)

### SyntenyStack

A synteny view drawn without its Material UI chrome: each row, with a ribbon
band between neighbours, or the view's status until it is ready. The
bring-your-own counterpart of `TrackStack` from `@jbrowse/display-ui/embed`.

Each row is an ordinary linear genome view, drawn by `renderRow`, which defaults
to a `TrackStack`:

```tsx
<SyntenyStack
  view={view}
  renderRow={row => <TrackStack view={row}>{row.assemblyNames[0]}</TrackStack>}
/>
```

```js
// type signature
({ view, renderRow, style, }: { view: LinearSyntenyView; renderRow?: ((row: LinearGenomeView, index: number) => ReactNode) | undefined; style?: CSSProperties | undefined; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/SyntenyStack.tsx)

### syntenyTables

A pair of rows of a linear synteny view as the display fetches, lays out and
colors it, as tables: `alignments`, each alignment block the two rows share,
with its span on each, its strand, name and measurements, in the color the
view's `encoding.color` paints it; `ribbons`, what the band draws between the
rows in paint order, each a trapezoid from a span on the query row to a span on
the target row (`match` for the block, `insertion`, `deletion` and `skip` for
the CIGAR ops wide enough to draw, `marker` for a location tick), with its color
and the alpha it composites at, and whether it draws as a centerline;
`offscreen`, the blocks whose mate lies on a contig the other row is not
showing, in the color the strip along that row's edge paints them,
`offscreenContigs`, the count and aligned bp of each such contig and the line
its hover prints, and `offscreenStrip`, the marks and labels the strips along
the band's edges paint, in px; `legend` and `ramps`, the key; and `config`, the
view's settings with their defaults filled, `encoding.color` and
`encoding.opacity` as config objects. For a host that draws them itself, such as
R through V8. Positions are genomic, on the axis's region named by `queryRegion`
and `targetRegion`; a ribbon's `queryX1`/`queryX2` and `targetX1`/`targetX2` are
its feet in px across the row's `width`, the regions end to end with no gap,
each foot clamped to its region, X1 joining X1 along one edge and X2 joining X2.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, query, target, view: written }: SyntenyTablesArgs) => Promise<{ config: {…}; alpha: number; assemblyNames: string[]; legend: {…}; legendTitle: string; ramps: {…}[]; alignments: {…}; ribbons: {…}; offscreen: {…}; offscreenContigs: {…}; offscreenStrip: { marks: { x: number[]; y: number[]; width: number[]; height: number[]; color: string[]; alpha: number[]; axis: ("query" | "target")[]; }; labels: { label: string[]; x: number[]; y: number[]; color: string[]; alpha: number[]; halo: string[]; axis: ("query" | "target")[]; }; fontPx: number; }; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/tables.ts)

<!-- API_DOCS_END -->
