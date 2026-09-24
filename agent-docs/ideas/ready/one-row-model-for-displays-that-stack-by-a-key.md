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
  reads `sampleInfo` (`MultiSampleVariantBaseModel.ts`, `rpcProps`); focusing
  after expansion is a silent refetch loop.
- **Named consumers read named stages**: the arrangement dialog the expanded
  unfocused rows, clustering the focused rows, the fetch key the focused
  unexpanded rows, a legend focus and sort-at-column the ordered rows, rendering
  `sources`. Colour deals over the unfocused rows, so a focus never
  recolours.
- **A display supplies the discovered rows and its hooks.** Discovered rows stay
  a stable-identity getter over region payloads (wiggle, multi-row) or a volatile
  from a header fetch (variants, MAF).
- **"A band yields while a tree describes the rows"** is one rule in the
  derivation; it is written twice today (`maybeApplyFacet`, `applyRowGroups`).

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
4. **Colour**, as above.
5. **A tree per band**, ComplexHeatmap's `row_split` with `cluster_rows`, which
   retires "a band yields to a tree".
6. **The mark display takes `rows`** for bar and point marks, whose rows are one
   band each; a pileup's variable-height sections need a tree laid against
   section tops. Its integer `encoding.row` gets another name then — not
   "lane", which already names a synteny section.

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
Questions: 1 palette; 2 past-length rule; 3 label boxes always tinted (tint on/off pair at 20 rows); 4 variants value order first-seen vs count-ranked (legend both ways); 5 field mapping vs TSV colour column (no fixture; design says own colour stays).

### Precedence
explicit entry (pair in the field's keyspace) → row's own colour (subtrack color, MAF samples[].color, samplesTsv color column, multi-row itemRgb/color slot) → dealt palette. Variants deviates (field palette beats own + pairs) → fixed at the flip (no fixture TSV has a color column → no pixel moves). Wiggle follows. Multi-row withholds palette under color slot/itemRgb = display fact. Gradient→label identity, rowColor entry replacing threshold pair = display facts.

### Sequencing (≈6.5 d + the call)
5a object 1.5 d (zero images; web ConfigSlotDefaults snap moves on CI); 5b dealer 2 d (each display hands today's order+palette → zero diff; retire buildPaletteColors, resolveRowColorStrings palette half, colorByPalette; speed gate: rowColorScale identity across setRowOrder/setRowFocus/relabel; categoricalScale dealt-order option 0.5 d); 5c legend 1 d (one ColorScale id 'rowColor' focusesRows via unionLegendCandidates; one focusLegendEntry by field value; retire legendItems.ts, getSampleGroupEntries, rowGroupLegend; text-snapshot diffs, zero pixels); 5d retirements 1.5 d (colorRowLabels, rowGroups[].color: config_demo roadmap, demos/arg, ui.ts:2369, dog10k.ts, chromhmm.md, videos/epigenomics.ts; palettizer writing rowColor.field; wiggle source-range notice; named pixels: tinted label boxes); 5e flip 0.5 d + call (one commit per display naming its figures; goldens refresh; figures:push --filter per family).

### Already decided / undo / defer
ADR-151 palette→range; no categorical scheme. ADR-153: categoricalScale hashes unlisted → dealt-order option. ADR-154: Color by none = scale none keeping field. Undo: VariantRowColor schema; amend ADR-153 "range in domain's order" → rowColor; ADR-157 "pairs, which the palette still beats" reverses. Defer: rowGroups partition → facet 'group' (step 5); mark display (step 6); MAF default palette (opt-in).

## Steps 5–6 plan (design pass, 2026-09-23)


### Premises corrected
- Variant displays have NO band chips, cap or hide-set: `facet` there is a stable sort by a samplesTsv attribute (`maybeApplyFacet`, MultiSampleVariantBaseModel.ts:232-266, read once in `sources` :1120-1129; set from "Group rows by…" multiSampleVariantMenuItems.ts:294). Chips/cap/HiddenGroupsMixin live on the section displays (feature, alignments, mark). `facet.hidden` exists nowhere as config.
- `StaleTreeHint` has no band branch (one message); it gains a count.

### Step 5 — decisions
- Need from ComplexHeatmap: `row_split` (bands from a factor in `facet.domain` order) + `cluster_rows` per slice. Not: cluster_row_slices, row_km, gaps, per-slice titles.
- Config: NO new member. One `rows.tree` holds a forest (root's children = band trees, `((a,b),(c,d))`), `rows.domain` = concatenated leaf order; a run under bands writes both in one `setRowOrder`. Per-band map declined (couples facet and rows; reset/undo/changes are per member).
- Derivation: mixin hook `rowBand(row): string | undefined` (variants: `source[facet.field]`; multi-row: `row.group`) + `bandedSources` computed after `clusterableSources` (TreeSidebarMixin.ts:401): grouped by band rank (`facet.domain` first, then groupKeyComparator, '' last), arranged order kept inside a band, one Map pass, `rows` by reference when facet off. Each display's `sources` = palette over `bandedSources`. Retire: `maybeApplyFacet` + `sortSourcesByAttribute` (variants:232-266), `applyRowGroups`' `partition` arg (rowSources.ts:27-56; tagging half stays until step 4's `rowGroups: [{match, group}]` lands `group` as a derived attribute), the two `treeDescribesRows`-gated ternaries (variants:1126, multi-row model.ts:420-425). Multi-row's band = `facet: { field: 'group' }`; `groupedSources` (model.ts:407) = `clusterableSources` tagged.
- Rule flips: bands win; a band draws its dendrogram iff the tree has a clade whose leaves are exactly that band's rows in order. One post-order pass (extend `findSubtree`, clusterUtils.ts:20) labels nodes with band (uniform/mixed) + leaf count → O(nodes) once per change. A whole-cohort tree under a fresh facet draws nowhere, hint says "re-run clustering" (ComplexHeatmap's own behaviour). No facet = one band whose clade is the root (today's path, no cost).
- Stale per band: a band whose rows changed loses only its own dendrogram; hint counts.
- Run under bands: `clusterMatrix` (clusterMatrix.ts:63) takes an optional partition (row names per band), clusters each slice, returns one concatenated order + one forest newick; 1-row band = bare leaf; MIN_CLUSTER_ROWS per slice. The four RPCs build one matrix and pass the partition; applyClusterRun/applyClusterOrder/rotateClusterRun unchanged (rotation per node; forest root child order irrelevant since band placement comes from facet.domain). Cost: 2,504 samples/26 bands = 26×~96² ≈ 240k pair distances vs 6.3M; GPU whole-cohort 0.42–2.3 s (gpu-sample-distance-matrix.md:63-66); 26 dispatches ~18 ms each ≈ 0.5 s; cheaper than today.
- Layout/draw: `computeClusterHierarchy` (clusterUtils.ts:383) positions the forest of matched clades under a synthetic root; rows contiguous and `effectiveRowHeight` tall so `clusterLayout`'s `(i+0.5)×step` (hierarchy.ts:139) already lands leaf i on row i. Depth axis per child so each band's root sits at the left edge (`assignDepthY`/`assignBranchLengthY` per subtree, hierarchy.ts:171); synthetic root draws no link: one skip in treeDrawingAutorun.ts:51 links loop, renderTreeSVG (hierarchy.ts:329), buildSpatialIndex (spatialIndex.ts:36). Invariant: bands leave no gap; a divider is a 1 px overlay, never layout.
- Per frame: tree draw/hover autoruns already re-run on scrollTop (treeDrawingAutorun.ts:33,73) walking ~5,000 links; forest = one link fewer. Bands add nothing per frame. Chips on variants would add 26 `groupChipTop` calls per scroll tick.
- Files: TreeSidebarMixin.ts, arrangeRows.ts (band pass), clusterUtils.ts, hierarchy.ts, treeDrawingAutorun.ts, spatialIndex.ts, StaleTreeHint.tsx, clusterMatrix.ts + four run*Clustering.ts, MultiSampleVariantBaseModel.ts, rowSources.ts, multi-row model.ts + configSchema.ts (`facet` slot from facetConfigSchema.ts:36), tree-sidebar CLAUDE.md, variants CLAUDE.md:170, ADR-159(+).
- Tests: four rowDerivation snapshots = zero-diff gate for unbanded tracks. Two pins flip and get rewritten: variants/rowDerivation.test.ts:182 "a facet yields to it"; multi-row/rowDerivation.test.ts:181 "rowGroups yield the order"; applyRowGroups.test.ts:88-120 partition cases move to the band stage. New pins: forest newick round trip; uniform-band pass one walk; row added to one band hides that band's tree only; facet.domain move keeps every tree; run under bands writes one domain + one forest; 1-row band; forest root draws no link (treeDrawingAutorun.test.ts + SVG twin); hint count.
- Goldens: no fixture pairs a band with a tree (graph-chrm.ts:65 bands only, :97 clusters only; ld.ts:354/:1191 different tracks; tcga.ts:368 no runClustering; popgen.ts:172 bands only; dog10k.ts:1616 declined rowGroups on the clustered lane). Per-band trees by default = zero pixels. Chips on row displays would move four banded figures = Q1.
- Days: ~4–5 (band stage 1, forest clustering 1, forest layout/draw/SVG/hover 1, multi-row facet:'group' + retirements + tests 1, chips on variants 0.5 if chosen).

### Step 6 — decisions
- `rows` on the mark display = the facet table with rowCount 1 (ADR-130: worker splits by facet key; main thread caps/orders/lays out: facet.ts:33, model.ts:557). RPC arg stays `facet`; config names it `rows` (mirrors wiggle's rename). Compose TreeSidebarMixin: discoveredRows = distinct keys across regions (stable identity), rowOrder = rows.domain, unlistedRowsSort 'sorted', identityChannel 'labelColor'; gains sidebar, labels, clustering, dialog. ADR-126's `facet: 'source'` example (adr-126:63) superseded in wording; row lane, markRowHeightPx (markList.ts:108), bandTops (model.ts:710-724) unchanged.
- `facet` stays for sections (variable-height pileup sections, chips MarkFacetChips.tsx, cap, volatile hide, facet.transform). Both on one display = bands of rows = step 5's band stage → 6 follows 5 for that combination only.
- `encoding.row` rename with the pileup step: `{ type: 'pileup', as: 'pile' }`, `encoding: { pile: 'pile' }`; `stack` alternative — Colin's call (Q4). Integer channel untouched by `rows`.
- Out of scope: tree against variable-height pileup sections (clusterLayout would need leaf y-extents; no display has a meaningful section count).
- Files: plugins/marks/src/LinearMarkDisplay/configSchema.ts (rows from display-kit rowsConfigSchema; row slot renamed later), model.ts, facet.ts, renderSvg.tsx, markProblems.ts (a rows beside a section pileup), MARK_ENCODING.md:178, pileup step default `as`, marks.ts:118 spec, read_marks.ts. ~3 days.

### Wrong / decided / undo
- Wiggle `facet: 'group'` would undo ADR-157's checkRowsField → declined for 5; one-line opt-in later.
- Step 4's dealer deals over the unbanded unfocused order → bands never recolour; nothing to change.
- Mark display `rows` must not re-split in the worker (ADR-130 one split stands).
- `facet.hidden` as config only where a band gets a chip → variants = Q1.

### Colin's questions (a picture each)
1. Chips on the row displays? (1000G matrix by population: bare tint strip vs 26 chips + hairline dividers; the only golden mover, four figures)
2. Facet set over a clustered cohort: banded with empty gutter + "re-run clustering" vs unbanded keeping its tree.
3. Each band's dendrogram at full gutter width vs one shared depth scale.
4. `pile` or `stack` for the pileup channel.
5. If Q1 yes: hide × on a band chip writes `facet.hidden` as config, or stays volatile as on section displays.
