---
status: Accepted
summary: "`LinearManhattanDisplay` is the mark display with a default plot: its schema takes `LinearMarkDisplay`'s as its base and redeclares `marks` as a list defaulting to a point per feature at its `score` (`markListSchema`, over a core change that keeps a collection slot's own default), and its model composes the mark model and adds only the LD join. A plot whose encoding names `r2` or `ld_role` joins r² to the index SNP; the join travels as the mark model's `adapterOptions` hook, a fetch input resolved per region by `resolveAdapterOptions`. LD coloring is written into the plot as two point marks, the partners by a threshold color over `r2` and the index alone as a pink diamond over them, rather than implied by a field preset. `scoreField`, `color`, `size`, `ManhattanColor` and the hand-written point display go, with no retired spellings: the display shipped only in v5 betas. The byte gate stays off for Manhattan. The mark display gains a hover ring for points and three key members any plot may write, as ggplot2's scale arguments are: `breaks` (the values a key lists), `descending` (a threshold key highest first) and `missingLabel` (the no-value row's name), with `title` and `labels` on the shape key too; the LD plot's key is built from them, so it reads as LocusZoom's"
---

# ADR-178: Manhattan is the mark display with a default plot

## Status

Accepted (2026-09-26). Colin chose "Manhattan → marks + LD" from the grammar
round's options, then said the display needs no legacy spellings, since it is
new in this repository. Amends
[ADR-107](adr-107-the-quantitative-class-is-authored-in-config.md), which kept
`scoreField` and a field color on Manhattan beside the mark display: the
display users reach for stays, and its plot is now the mark display's.

## Context

The Manhattan display repeated the mark display's point plot by hand: its own
layer request, mark list, hit test, hover, tooltip, legend, point size, SVG
export and component, about a thousand lines. What it had of its own was the LD
join: an index SNP that follows the top hit until pinned, the r² each fetch
joins against it, and the menus that set both. A mark display over a GWAS file
drew the same points, and the Manhattan plot had none of its facets, rows,
transforms or Edit plot.

## Decision

- **The schema is the mark display's, with a default plot.** `configSchema`
  takes `linearMarkDisplayConfigSchemaFactory()` as its base and redeclares
  `marks` through `markListSchema([MANHATTAN_MARK])`. `ConfigurationSchema`
  keeps a collection slot's own `stripDefault` wrapper where it used to wrap
  every collection in an empty default, so a snapshot at the default plot
  leaves `marks` out, as ADR-172 has a track's display defaults stated as schema
  defaults. The mark display's own `marks` is `markListSchema([])`, so the two
  schemas type alike.
- **The model composes the mark model** and adds `indexSnp`, `indexSnpPinned`,
  the top-hit follow and the LD menus. The mark model gained two hooks for it:
  `adapterOptions`, what every region's fetch hands the adapter, carried in
  `rpcProps` so a change refetches, and `resolveAdapterOptions`, which places
  it on one region on the main thread, where the LD file's aliases are. The
  missing-index warning is the adapter's: a fetch's `notices` ride the encoded
  result to the mark model's `dataNotices` and the corner notice, so the model
  infers nothing about the join from how the points are encoded.
- **The top hit is the adapter's, read off the file** (amended 2026-10-08).
  `GWASAdapter` reports each region's highest-scoring SNP in the fetch's
  `facts`, a channel beside `notices` that rides the encoded result to the
  region's stored data, and `topSnp` is the best of them. It is read before
  the join and before every step of the plot, which is the only place nothing
  the plot does can move it: LocusZoom.js picks its LD reference the same way,
  the highest `log_pvalue` of the association data. The model first read the
  top hit off the points the LD-reading marks drew, which the join's own
  `ld_role` filter changes. A plot with the partner mark and no index twin,
  one deletion in Edit plot away from the shipped plot, adopted a SNP, lost it
  to the filter, adopted the runner-up and got the first back, refetching each
  way without end; a plot whose only LD mark plots `r2` drew nothing before a
  join and so never found an index to join. An index SNP a display `filter`
  hides still colors its partners, and a pin overrides it.
- **A plot that names an LD field joins LD.** `joinsLd` is an `ldAdapter` plus
  a mark whose encoding names `r2` or `ld_role`. LocusZoom's plot is two
  points, each behind a `filter` on `ld_role`: every SNP but the index by a
  threshold color over `r2` in LocusZoom's bins, then the index alone on top,
  a `#c951c9` diamond, so the plot says what it draws and Edit plot shows it.
  "Color by LD to index SNP" makes that pair of each point mark placing each
  SNP (`withLd`): the partner keeps its size, steps, zoom gates and shape, its
  own constant or callback color kept beside the r² scale, and every index
  twin draws after the last partner; every other mark stays. Off strips
  exactly those pieces (`withoutLd`), so a round trip leaves the plot, and the
  session delta, as they were; a plot with no such point greys the item out.
  (Amended 2026-09-26: it replaced the whole plot, which reset the demos'
  7 and 8 px points and every Point size to 4 px on a round trip.) A first
  version wrote the color and shape onto every point mark, which painted the
  index the red of r² 1 and wrote nothing on a plot of bars; the index twin
  and the greyed item are the answers to those two. (Amended 2026-10-07: the
  join wrote the statistic as the field `ld`; it writes `r2`, the name the LD
  display's color gives the same statistic. No retired spelling, as below.)
- **The join follows every name the worker reads** (amended 2026-10-08).
  `joinsLd` first asked whether a mark's `y`, `text`, or color, shape or size
  field was exactly `r2` or `ld_role`, so `y: 'jexl:feature.r2 * 10'` or a
  `filter` step on `feature.r2` ran no join and read a field no feature held,
  drawing nothing with no message. It now scans the mark model's
  `plotRequest`, the worker request less the adapter options, for either name
  as a field or as a word of a `jexl:` expression (`namesLd`). The scan cannot
  read `rpcProps`, whose `opts` is derived from `joinsLd`. The menu item keeps
  the narrow rule as `ldColored`, since `withoutLd` strips only the marks the
  item writes. The other two requests a display sends the adapter follow the
  same options: row clustering's matrix carries each region's resolved join,
  and Edit plot lists `r2` and `ld_role` through the mark model's
  `joinedPlotFields` hook, its field scan reading a 20 kb sample no join
  reliably reaches.
- **No field preset for `r2`.** The previous color object painted `{ field:
  'ld' }` as the LocusZoom threshold through a preset only the model knew,
  while the rule list and Edit plot read every field as categorical.
- **The byte gate stays off**, as it was: a genome-wide view of summary
  statistics is the display's case.
- **Two gains for every mark display**: a hovered point lights as a ring, as
  Manhattan's did, and a key takes ggplot2's controls. `breaks` lists only the
  values it names, `descending` lists a threshold's intervals from the
  highest, `missingLabel` names the grey row, and the shape key gains the
  `title` and `labels` the color key has. They are read on the main thread
  when the key is built, so writing one refetches nothing.
- **LocusZoom's key comes from those members**, not from Manhattan: the LD
  color descends and names its missing row "No LD data", and the LD shape
  lists only the index, as "Index SNP", under no heading. Colin chose this
  over a key Manhattan draws itself, which only Manhattan could have had, and
  over shipping the generic two keys.

## Consequences

- A Manhattan plot facets, splits into rows, bins and aggregates like any mark
  display; the add-track workflow writes the LD mark when it is given an LD
  file.
- The r² key and the index SNP's row are two keys where the old legend was
  one. The index's swatch is its pink diamond, since any shape key of a mark
  painted one color draws its shapes in that color, as ggplot2 draws a
  layer's key glyphs; a mark colored by a scale keeps the text color.
- The insertion triangle is the SV-GWAS demo's own `shape` over `svtype`, no
  longer a Manhattan default applied to every file.
- `jbrowse validate` runs the mark rules on any display whose manifest lists
  `marks`, so a Manhattan entry is checked as a mark display is.

## Rejected

- **Retired spellings for `scoreField`, `color` and `size`.** The display
  shipped only in betas. The lifts would also have needed three keys to merge
  into one list entry, which the retired-spelling pass cannot express.
- **A model-level color preset for `r2`.** Two answers to one field's scale:
  the paint would have said threshold and the editor categorical.
- **Inferring the LD join from the encodings** (`ld_role` shape entries, the
  color lanes) for the missing-index notice: it held only for plots shaped
  like `LD_MARKS`. The adapter reports through `BaseOptions.notices` instead.
- **The top hit read after the plot's shared steps**, to follow a display
  `filter`: a display-level filter on `ld_role` would reopen the refetch loop
  the adapter's report closes.
- **Joining whenever the track has an LD file and an index**: every default
  plot would fetch twice and read the LD file to color nothing.
- **An index SNP named by its id** (amended 2026-10-08: `indexSnp` took a SNP
  id beside a `chr:bp`). Both writers, the top hit and the right-click, place
  the index, so an id reached it only from a hand-written session. An id has no
  position to anchor the LD window, so the read fell back to the fetched region
  and found no row naming the index once the view panned off it. `indexSnp` is
  a `chr:bp`, and one that is not joins nothing.
- **The auto index following the top visible SNP under a row focus**: a focus
  would refetch every region, undoing the row table's one-upload promise.
- **A conditional color on the encoding** (Vega-Lite's `condition`) for the
  pink index: layering with a `filter` step used pieces the grammar already
  had.
- **Stashing the pre-LD plot and restoring it on untick**: a hidden second copy
  of the plot, whose one advantage, the point's own color, the `value` kept
  beside the r² scale gives. A `colorByLd` flag deriving the drawn plot fails
  too: Edit plot would show a plot other than the one drawn, and 22 readers of
  `conf.marks` need live config nodes.
- **Coloring a bar-only plot by LD**: no shipped config has one, and the item
  greys out with a pointer to Edit plot instead.
- **A notice for an LD plot whose marks all fail `placesEachSnp`**: only an
  Edit plot `bin` or `x` reaches it, and the adapter's missing-index notice
  already covers the grey plot it leads to.
