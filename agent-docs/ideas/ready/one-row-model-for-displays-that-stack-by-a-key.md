---
name: one-row-model-for-displays-that-stack-by-a-key
description: The eight displays that stack features by a key — sections on the feature, mark and alignments displays, rows on wiggle, multi-row, the two multi-sample variant displays and MAF — converge on one row model with two config objects, `facet` for labelled bands and `rows` for one row per value. Arrangement, focus and hidden bands are config written as session deltas; one derivation builds every display's rows. Reviewed three times; the order of work and what each step replaces. Read before touching a row display's order, color, grouping or tree.
---

# One row model for displays that stack by a key

Eight displays stack what they draw by a key. The feature, mark and alignments
displays split features into labelled **sections** that each pack their own
rows. Wiggle, multi-row, the two multi-sample variant displays and MAF draw one
**row** per key, with the tree sidebar beside them. The drawing is already
shared (`packages/tree-sidebar`, `GroupLabelChips`); the row model is not. Each
display builds its own row list and spells key, order, color, bands and hiding
its own way — `facet` names sections on three displays, bands of rows on the
variant displays and the rows themselves on wiggle, and row color is written
five ways with four palette rules.

## Two levels, two objects

**`facet: field | { field, domain, hidden }`** is the outer level: labelled
bands. On a section display it reads the features, as today; on a row display it
reads the rows' attributes (the variant displays' population band, multi-row's
regex groups as a derived attribute, and wiggle's `group`, which ADR-143
anticipated). Chips, the cap and the Sections menu hang here.

**`rows: field | { field, domain, labels, tree, treeProvenance, kept }`** is the
leaf level: one row per value. Wiggle takes `rows: 'source'` where it took
`facet: 'source'`, multi-row took it for `partitionField`, and the variant
displays and MAF, whose key is intrinsic (a sample, a species), write every
member but `field`. The section displays leave it unset, because their rows
pack. The dendrogram, the row labels, sort-at-column and clustering hang here.

This is ggplot2's `facet_grid(rows = vars(band, row))` at depth two and
GenomeSpy's sample hierarchy (`packages/app/src/sampleView/state/sampleState.d.ts`)
with one group level. A multi-wiggle's source is a field, not a layer: the
fallback executor groups one fetched list by it (`groupFeaturesBySource`), the
config names it as a field in two channels, and a layer is declared in config
while a fallback adapter discovers sources per region.

## Arrangement is config, edited as session deltas

A row order, a section order, per-row labels, the cluster tree beside the order
it produced, a clade focus and hidden bands are config members of their level's
object. Config survives unticking and reticking a track, where a display
instance's state does not (`treeAreaWidth` is config for that reason); a
`domain` inside its object cannot outlive its `field` (ADR-131); and an author
can write any of them in a config file, a session spec or `displayDefaults`.
Every product edits a track's config as a delta in the session
(`130e41de08`), so undo, reset and a share link reach an arrangement, and an
admin publishes one only through Admin → Save track settings to config.

The tree moves with the order. Held apart — tree in display state, order in
config — one clustering run is two undo steps, and a second view clustering the
same track leaves the first view's dendrogram describing rows it no longer has.

Three things this requires, from the third review:

- **An arrangement writer flushes to the session synchronously.**
  `BaseTrackModel`'s persist reaction waits 400 ms, and until it fires the
  arrangement is not in the session, so a ctrl+z in that window undoes the
  previous change instead. (The debounce already coalesces a run's several
  members into one save; the flush is for immediacy.)
- **"Reset row order" compares against the base config**, not against an empty
  domain, or a user's reset writes a `null` that erases the admin's declared
  order for that user (`trackConfigDelta.ts`). `getTrackConfigChanges` already
  hands over the base value.
- **The "view changes" table summarises an array** rather than printing a
  2,500-sample order (`flattenTrackConfigDelta`).

`rows.kept` does not count toward "Reset row order", since the focus has a clear
of its own, though a reset clears it with the rest; `rows.domain` is both the
declared seed and the arrangement, so a run after a reorder rotates its tree
towards that reorder.

## Visibility

`rows.kept` is a show-set chosen from the tree or a legend click; `facet.hidden`
is a hide-set chosen from a chip. They stay two members because a show-set hides
a row discovered later and a hide-set shows one, and each is right for its
level. Both sit inside their object, so a field change drops them the way
`HiddenGroupsMixin` does today. A `kept` naming no current row resolves to every
row, where `rowsNamed` returns none and blanks the display. MAF's fetch
key reads `rows.kept` alone, since resolving it against the species a fetch
reports would key on a fetch result; the worker resolves a focus naming none of
the species it lists to every species.

## One derivation

discovered → focused for the fetch (the variant displays' samples before
expansion, `sourcesBase`) → expanded (a display hook: phased haplotypes) →
ordered (`rows.domain`, or a drawn tree's leaves), relabelled and tinted by the
`rowColor` pairs (`editableSources`) → focused (`kept`, `clusterableSources`) →
palette and bands (`sources`, the display's, with MAF's reference row).
`TreeSidebarMixin` holds the stages from expanded to focused as computeds of
their own, over one `arrangeRows` and the hooks a display supplies.

- **Nothing upstream of a fetch key reads a fetch result.** The variant
  displays' `sampleFilter` reads the focused, unexpanded rows because expansion
  reads `samplePloidy` (`LinearMultiSampleVariantDisplay/model.ts`, `rpcProps`); focusing
  after expansion is a silent refetch loop.
- **Named consumers read named stages**: the arrangement dialog the expanded
  unfocused rows, clustering the focused rows, the fetch key the focused
  unexpanded rows, a legend focus and sort-at-column the ordered rows, rendering
  `sources`. Color deals over the unfocused rows, so a focus never
  recolors.
- **A display supplies the discovered rows and its hooks.** Discovered rows stay
  a stable-identity getter over region payloads (wiggle, multi-row) or a volatile
  from a header fetch (variants, MAF).
- **A band draws the clade of its rows**, one rule in the derivation
  (`bandedSources`, ADR-169), where "a band yields while a tree describes the
  rows" was written twice (`maybeApplyFacet`, `applyRowGroups`).

Unlisted keys follow the key source: a declared list (a VCF header, subtracks,
MAF samples, a tree) keeps its own order, and values discovered in features
sort. Those are today's two rules, stated by their source.

## Color, after the rows

Decided by
[ADR-207](../../architecture-decision-records/adr-207-a-rows-color-resolves-once-and-shows-beside-its-label.md):
one resolution (entry, then the row's own color, then a palette by name only in
a shared panel), a label bar in place of `colorRowLabels`, groups as an
attribute, one key and one dialog.

## Order of work

1. ~~Alignments sections key strand by the `strand` vocabulary and the key
   follows section order~~ (`2e734b0c2c`).
2. ~~Every product edits track config as session deltas~~ (`130e41de08`).
3. **The row model, one display at a time**, gated on a zero image diff:
   ~~wiggle~~ (ADR-157), ~~the variant displays~~ (the hard case: two-point
   expansion, bands, tint; ADR-157), ~~multi-row~~ (ADR-157; `rowColor` holds
   `sampleColorMap` and the dialog's colors as one map), ~~MAF~~ (ADR-157; the
   guide tree stays data, drawn while some rotation of it lists `rows.domain`).
   `rows` replaces `layout`, `clusterTree`, `clusterProvenance` and
   `subtreeFilter`; `facet.hidden` replaces the volatile hide-set. ~~The
   changes table's array summary~~ (`86cadb9f94`). About 7–11 days.
4. ~~**Color**: the `rowColor` object and one dealer~~ (ADR-160), ~~then one
   resolution, the palette and the precedence~~ (ADR-207).
5. ~~**A tree per band**, ComplexHeatmap's `row_split` with `cluster_rows`, which
   retires "a band yields to a tree"~~ (ADR-169, `ba2c68e31d`…`ccc131d14f`).
6. ~~**The mark display takes `rows`** for bar and point marks, whose rows are
   one band each~~ (ADR-157). `facet` with `rows` waits on step 5's bands, and
   a pileup's variable-height sections need a tree laid against section tops.
   Its integer `encoding.row` gets another name then — not "lane", which
   already names a synteny section.
7. ~~**Harden the hook seam**~~ (ADR-207): every hook stays an overridable
   getter, a constant one included, since factory options beside getters would
   be two mechanisms for one; `declaredHooks.test.ts` holds each display to the
   members documented as hooks.

## Declined

- **Arrangement in display state** (`layout` for rows, and sections moved to
  match): an arrangement is lost on untick, and a section order held apart from
  its field outlives it.
- **One hide mechanism for sections and rows**: a show-set and a hide-set treat
  a newly discovered key oppositely.
- **Row palettes by hash**: `categoricalScale` with no domain has no collision
  avoidance, so two of four sources can share a hue where wiggle's dealer never
  repeats below nine.
- **A `layout` config slot** carrying whole row records: order, labels and
  colors each have a home in the two objects and the color object.
