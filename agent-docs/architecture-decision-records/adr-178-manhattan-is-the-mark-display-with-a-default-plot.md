---
status: Accepted
summary: "`LinearManhattanDisplay` is the mark display with a default plot: its schema takes `LinearMarkDisplay`'s as its base and redeclares `marks` as a list defaulting to a point per feature at its `score` (`markListSchema`, over a core change that keeps a collection slot's own default), and its model composes the mark model and adds only the LD join. A plot whose encoding names `ld` or `ld_role` joins r² to the index SNP; the join travels as the mark model's `adapterOptions` hook, a fetch input resolved per region by `resolveAdapterOptions`. LD colouring is written into the plot, a threshold colour over `ld` and a shape over `ld_role`, rather than implied by a field preset. `scoreField`, `color`, `size`, `ManhattanColor` and the hand-written point display go, with no retired spellings: the display shipped only in v5 betas. The byte gate stays off for Manhattan, and the mark display gains a hover ring for points and a title on its shape key"
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
  writes a threshold colour over `ld` in LocusZoom's bins and a shape over
  `ld_role` on every point mark, so the plot says what it draws and Edit plot
  shows it.
- **No field preset for `ld`.** The previous colour object painted `{ field:
  'ld' }` as the LocusZoom threshold through a preset only the model knew,
  while the rule list and Edit plot read every field as categorical.
- **The byte gate stays off**, as it was: a genome-wide view of summary
  statistics is the display's case.
- **Two gains for every mark display**: a hovered point lights as a ring, as
  Manhattan's did, and a shape key takes a `title`, as a colour key does.

## Consequences

- A Manhattan plot facets, splits into rows, bins and aggregates like any mark
  display; the add-track workflow writes the LD mark when it is given an LD
  file.
- The r² key is the mark display's threshold key, and the index SNP has a
  shape key of its own, where the old legend listed the index as a row of the
  r² key.
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
