---
status: Accepted
summary: "`LinearManhattanDisplay` is the mark display with a default plot: its schema takes `LinearMarkDisplay`'s as its base and redeclares `marks` as a list defaulting to a point per feature at its `score` (`markListSchema`, over a core change that keeps a collection slot's own default), and its model composes the mark model and adds only the LD join. A plot whose encoding names `ld` or `ld_role` joins r² to the index SNP; the join travels as the mark model's `adapterOptions` hook, a fetch input resolved per region by `resolveAdapterOptions`. LD colouring is written into the plot as two point marks, the partners by a threshold colour over `ld` and the index alone as a pink diamond over them, rather than implied by a field preset. `scoreField`, `color`, `size`, `ManhattanColor` and the hand-written point display go, with no retired spellings: the display shipped only in v5 betas. The byte gate stays off for Manhattan. The mark display gains a hover ring for points and three key members any plot may write, as ggplot2's scale arguments are: `breaks` (the values a key lists), `descending` (a threshold key highest first) and `missingLabel` (the no-value row's name), with `title` and `labels` on the shape key too; the LD plot's key is built from them, so it reads as LocusZoom's"
---

# ADR-178: Manhattan is the mark display with a default plot

## Status

Accepted (2026-09-26). Colin chose "Manhattan → marks + LD" from the grammar
round's options, then said the display needs no legacy spellings, since it is
new in this repository. Amends
[ADR-107](adr-107-the-quantitative-class-is-authored-in-config.md), which kept
`scoreField` and a field colour on Manhattan beside the mark display: the
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
  it on one region on the main thread, where the LD file's aliases are. A third,
  `dataNotices`, carries the missing-index warning to the corner notice.
- **A plot that names an LD field joins LD.** `joinsLd` is an `ldAdapter` plus
  a mark whose encoding names `ld` or `ld_role`. "Color by LD to index SNP"
  replaces the marks with two points, each behind a `filter` on `ld_role`:
  every SNP but the index by a threshold colour over `ld` in LocusZoom's bins,
  then the index alone on top, a `#c951c9` diamond, so the plot says what it
  draws and Edit plot shows it; off returns to the default plot. A first
  version wrote the colour and shape onto every point mark, which painted the
  index the red of r² 1 and wrote nothing on a plot of bars.
- **No field preset for `ld`.** The previous colour object painted `{ field:
  'ld' }` as the LocusZoom threshold through a preset only the model knew,
  while the rule list and Edit plot read every field as categorical.
- **The byte gate stays off**, as it was: a genome-wide view of summary
  statistics is the display's case.
- **Two gains for every mark display**: a hovered point lights as a ring, as
  Manhattan's did, and a key takes ggplot2's controls. `breaks` lists only the
  values it names, `descending` lists a threshold's intervals from the
  highest, `missingLabel` names the grey row, and the shape key gains the
  `title` and `labels` the colour key has. They are read on the main thread
  when the key is built, so writing one refetches nothing.
- **LocusZoom's key comes from those members**, not from Manhattan: the LD
  colour descends and names its missing row "No LD data", and the LD shape
  lists only the index, as "Index SNP", under no heading. Colin chose this
  over a key Manhattan draws itself, which only Manhattan could have had, and
  over shipping the generic two keys.

## Consequences

- A Manhattan plot facets, splits into rows, bins and aggregates like any mark
  display; the add-track workflow writes the LD mark when it is given an LD
  file.
- The r² key and the index SNP's row are two keys where the old legend was
  one. The index's swatch is its pink diamond, since any shape key of a mark
  painted one colour draws its shapes in that colour, as ggplot2 draws a
  layer's key glyphs; a mark coloured by a scale keeps the text colour.
- The insertion triangle is the SV-GWAS demo's own `shape` over `svtype`, no
  longer a Manhattan default applied to every file.
- `jbrowse validate` runs the mark rules on any display whose manifest lists
  `marks`, so a Manhattan entry is checked as a mark display is.

## Rejected

- **Retired spellings for `scoreField`, `color` and `size`.** The display
  shipped only in betas. The lifts would also have needed three keys to merge
  into one list entry, which the retired-spelling pass cannot express.
- **A model-level colour preset for `ld`.** Two answers to one field's scale:
  the paint would have said threshold and the editor categorical.
