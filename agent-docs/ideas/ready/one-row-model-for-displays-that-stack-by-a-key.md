---
name: one-row-model-for-displays-that-stack-by-a-key
description: The eight displays that stack features by a key — sections on the feature, mark and alignments displays, rows on wiggle, multi-row, the two multi-sample variant displays and MAF — converge on one row model with two config objects, `facet` for labelled bands and `rows` for one row per value. Arrangement, focus and hidden bands are config written as session deltas; one derivation builds every display's rows. Reviewed three times; the order of work and what each step replaces. Read before touching a row display's order, colour, grouping or tree.
---

# One row model for displays that stack by a key

Eight displays stack what they draw by a key. The feature, mark and alignments
displays split features into labelled **sections** that each pack their own
rows. Wiggle, multi-row, the two multi-sample variant displays and MAF draw one
**row** per key, with the tree sidebar beside them. The drawing is already
shared (`packages/tree-sidebar`, `GroupLabelChips`); the row model is not. Each
display builds its own row list and spells key, order, colour, bands and hiding
its own way — `facet` names sections on three displays, bands of rows on the
variant displays and the rows themselves on wiggle, and row colour is written
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
row, where `filterRowsBySubtree` returns none and blanks the display. MAF's fetch
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
  reads `samplePloidy` (`MultiSampleVariantBaseModel.ts`, `rpcProps`); focusing
  after expansion is a silent refetch loop.
- **Named consumers read named stages**: the arrangement dialog the expanded
  unfocused rows, clustering the focused rows, the fetch key the focused
  unexpanded rows, a legend focus and sort-at-column the ordered rows, rendering
  `sources`. Colour deals over the unfocused rows, so a focus never
  recolours.
- **A display supplies the discovered rows and its hooks.** Discovered rows stay
  a stable-identity getter over region payloads (wiggle, multi-row) or a volatile
  from a header fetch (variants, MAF).
- **A band draws the clade of its rows**, one rule in the derivation
  (`bandedSources`, ADR-169), where "a band yields while a tree describes the
  rows" was written twice (`maybeApplyFacet`, `applyRowGroups`).

Unlisted keys follow the key source: a declared list (a VCF header, subtracks,
MAF samples, a tree) keeps its own order, and values discovered in features
sort. Those are today's two rules, stated by their source.

## Colour, after the rows

Each row display first states what a row's colour paints: the label (the
variant displays), the row's content (multi-row's `rowColor` pairs), or the plot
(wiggle, which moves identity to `labelColor` under a gradient). Then one
colour object (ADR-135's shape) carries it, with a declared target per display,
and the label swatch always reads it, which retires `colorRowLabels`. Per-row
colours are the object's `domain`/`range` pairs, which already pair by position.
One dealer hands out a palette over an order it is given, ties in source order,
so a drag no longer recolours a wiggle row; never a bare hash over discovered
rows, which collides. One precedence: an explicit entry, then the feature's own
colour, then the palette. An adapter's per-row colour (a subtrack's `color`,
MAF's `samples[].color`, a samples TSV column) enters as an explicit entry and
stays, since a discovered row set has no other place to state one. Which palette is a visual call, captured side by side
before it is asked.

## Order of work

1. ~~Alignments sections key strand by the `strand` vocabulary and the key
   follows section order~~ (`2e734b0c2c`).
2. ~~Every product edits track config as session deltas~~ (`130e41de08`).
3. **The row model, one display at a time**, gated on a zero image diff:
   ~~wiggle~~ (ADR-157), ~~the variant displays~~ (the hard case: two-point
   expansion, bands, tint; ADR-157), ~~multi-row~~ (ADR-157; `rowColor` holds
   `sampleColorMap` and the dialog's colours as one map), ~~MAF~~ (ADR-157; the
   guide tree stays data, drawn while some rotation of it lists `rows.domain`).
   `rows` replaces `layout`, `clusterTree`, `clusterProvenance` and
   `subtreeFilter`; `facet.hidden` replaces the volatile hide-set. ~~The
   changes table's array summary~~ (`86cadb9f94`). About 7–11 days.
4. **Colour**, as above: ~~the `rowColor` object and one dealer, each display
   handing in its old order and palette at a zero image diff~~ (ADR-160); then
   the palette flip after the side-by-side capture, the base arrangement on
   wiggle and the one precedence on the variant displays.
5. ~~**A tree per band**, ComplexHeatmap's `row_split` with `cluster_rows`, which
   retires "a band yields to a tree"~~ (ADR-169, `ba2c68e31d`…`ccc131d14f`).
6. ~~**The mark display takes `rows`** for bar and point marks, whose rows are
   one band each~~ (ADR-157). `facet` with `rows` waits on step 5's bands, and
   a pileup's variable-height sections need a tree laid against section tops.
   Its integer `encoding.row` gets another name then — not "lane", which
   already names a synteny section.
7. **Harden the hook seam**: static hooks become mixin factory options and
   dynamic ones getters, plus a test that no display redefines a mixin member
   outside the declared list.

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
  colours each have a home in the two objects and the colour object.

## Step 4 plan (design pass, 2026-09-23)

Notes as the design pass left them; file and line references are to main of that day.


### Object
`rowColor: field | { field, scale, domain, range }` on all four displays (display-kit factory: colorChannelSlots categorical + colorDomainSlot + colorRangeSlot; shorthand field; closed; no value, no scheme). `field` = row attribute, default `name`; `group`; a samplesTsv column. `domain` = the field's values; unlisted values take the dealt palette. Per-row entries = `field: 'name'` pairs. VariantRowColor folds in. A hand recolour under a non-name field materialises resolved colours as name pairs (~60 KB / 2,500 rows) — keep in one function. Target = display fact = `identityChannel`. `colorRowLabels` goes (labelColor = resolved row colour everywhere) → tinted label boxes on multi-row and rows-layout wiggle figures = named pixel change + visual call. `rowGroups[].color` goes → `rowGroups: [{match, group}]` derives `group`; `rowColor: { field: 'group', domain, range }`; wiggle's groups-first rule = `rowColor: { field: 'group' }` default where a source carries a group (`effectiveRowColor`). Wiggle `color: { field: 'source' }` stays the plot-side switch but `sourcePalette` reads rowColor; domain/range under color.field source → colorProblems.

### Dealer
`dealRowColors(order, {domain, range}, palette)`: listed → range[i]; others first-seen over one cursor `[...range.slice(domain.length), ...palette]`; past end: wrap vs re-lit laps (question 2); no hash, no randomColor. Order = base arrangement `orderRowsByDomain(expandedRows, baseRowDomain)`. One computed `rowColorScale` on the mixin; arrangeRows' relabel pass takes the Map. Fixtures that move at the flip: wiggle overlay (volvox_microarray_multi*, microarray_multi 21, pur_copynumber_1000g 104 → cnv1000g/*, paper/cohort_cnv, methylation/*, tcga/cohort_cnv_*); multi-row (bxd painting, broad_chromhmm 9, roadmap 127/19 groups, dog10k 14 → qtl/bxd_*, dog10k-*, ui.ts roadmap); variants (population_1000genomes, ld/*, popgen/*, pangenome/chrm_*, jbrowse-img/multisample_variants, volvox_variants); MAF unchanged (no default palette; opt-in `rowColor: 'name'`).

### Palette call (Colin) — page: scenes × palettes (+ deuteranopia column via feColorMatrix)
Candidates: set1 (9; #ffff33 vanishes; #999 = no-value grey), categoricalPalette (~40, tableau10-first, 14 near-twins), tableau10, Okabe-Ito (8, CVD), Tol bright/vibrant (7), Tol muted (9, lines), d3 schemeSet2 (8 pastels, poor at 1 px), Tableau 20, re-lit laps off 9–10 base (karyotype mechanism). Scenes at 5/20/100 rows: wiggle overlay line+xy (volvox_microarray_multi, microarray_multi, pur_copynumber_1000g); wiggle rows density with groups (volvox_microarray_multi_grouped, microarray_multi_groups); multi-row blocks (volvox_mouse_inheritance_rows, broad_chromhmm, roadmap_chromhmm); variants label tint (volvox multi-sample sv; chrm superpopulation 5 / population ~26); MAF label tint (volvox_maf, hg38.multiz470way). How: `generate-screenshots.ts --check --filter <spec> --exact --localport 3355` (FIGURE_CAPTURE.md:184) + dealer palette override, one run per candidate; one HTML page. One-look question: at 20 rows on a 1 px line and a 4 px block, which palette keeps every neighbour apart with nothing vanishing on white — and past its length, re-lit lap or wrap?
The flip should deal over an order no save changes. Until it does, the multi-row display recolours rows on a pan, and "Save track settings to config" recolours every row, since the palette is dealt over the base order and the save rewrites the base. A second page goes with the call: a tour of what steps 3–4 changed on screen (drag, cluster, undo, reset on an agent-built track, the MAF guide tree turning).
Questions: 1 palette; 2 past-length rule; 3 label boxes always tinted (tint on/off pair at 20 rows); 4 variants value order first-seen vs count-ranked (legend both ways); 5 field mapping vs TSV colour column (no fixture; design says own colour stays).

### The rowGroups colour against GenomeSpy (2026-09-27)
GenomeSpy's groups carry no colour; a group's is its attribute's scale (`getGroupColorScale`, `packages/app/src/charts/sampleAttributePlotUtils.js`), and attribute colours paint the metadata cells, never the marks. So `rowGroups[].color` → `rowColor: { field: 'group' }` is right, but it cannot ship alone: `rowColor` targets multi-row's blocks, and an explicit entry beats itemRgb, so the roadmap/chromHMM and dog10k figures would paint group colours over their states. It needs question 3's answer — an attribute's colour on the label box, a row's own (`field: 'name'`) on its content — first.

### Precedence
explicit entry (pair in the field's keyspace) → row's own colour (subtrack color, MAF samples[].color, samplesTsv color column, multi-row itemRgb/color slot) → dealt palette. Variants deviates (field palette beats own + pairs) → fixed at the flip (no fixture TSV has a color column → no pixel moves). Wiggle follows. Multi-row withholds palette under color slot/itemRgb = display fact. Gradient→label identity, rowColor entry replacing threshold pair = display facts.

### Sequencing (≈6.5 d + the call)
5a object 1.5 d (zero images; web ConfigSlotDefaults snap moves on CI); 5b dealer 2 d (each display hands today's order+palette → zero diff; retire buildPaletteColors, resolveRowColorStrings palette half, colorByPalette; speed gate: rowColorScale identity across setRowOrder/setRowFocus/relabel; categoricalScale dealt-order option 0.5 d); 5c legend 1 d (one ColorScale id 'rowColor' focusesRows via unionLegendCandidates; one focusLegendEntry by field value; retire legendItems.ts, getSampleGroupEntries, rowGroupLegend; text-snapshot diffs, zero pixels); 5d retirements 1.5 d (colorRowLabels, rowGroups[].color: config_demo roadmap, demos/arg, ui.ts:2369, dog10k.ts, chromhmm.md, videos/epigenomics.ts; palettizer writing rowColor.field; wiggle source-range notice; named pixels: tinted label boxes); 5e flip 0.5 d + call (one commit per display naming its figures; goldens refresh; figures:push --filter per family).

### Already decided / undo / defer
ADR-151 palette→range; no categorical scheme. ADR-153: categoricalScale hashes unlisted → dealt-order option. ADR-154: Color by none = scale none keeping field. Undo: VariantRowColor schema; amend ADR-153 "range in domain's order" → rowColor; ADR-157 "pairs, which the palette still beats" reverses. Defer: rowGroups partition → facet 'group' (step 5); mark display (step 6); MAF default palette (opt-in).
