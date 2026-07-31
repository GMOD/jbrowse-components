# shared (MultiSampleVariant)

## Hot loops: indexed for-loops only

The per-feature × per-sample loops run `numFeatures * numSamples` times (10⁸+ on
real VCFs). Inside them:

- indexed `for`, never `.forEach`/`.map`/`.find`/`.filter` (closure alloc, no
  inlining)
- `for (const key in obj)`, never `Object.values/entries/keys` (temp array)
- no `??`/`||` fallbacks wrapping allocating right-sides

Applies to `computeVariantCells.ts`, `computeVariantMatrixCells.ts`, and
`attachRenderingBackend` upload/render callbacks touching per-cell data. NOT to:
`perRegionCellData` iteration (1-3 regions), one-shot actions (sort, hover), UI,
or VCF-parse / RPC-arg-shaping (amortized). Don't apply it everywhere — the rest
of the codebase prefers declarative iteration.

## Regular-display hit-test: per-feature index, arithmetic rows

The spatial index the regular display ships (`featureIndexData`) holds **one
interval per variant**, not one box per cell. A cell adds nothing to it: every
cell of a variant repeats the same x-extent, so a per-cell index stored
`numSamples` identical copies — measured at 21.3 bytes/cell (box + tree nodes +
index array), which was more than every other per-cell array combined, 61 MB for
1000 variants × 3000 samples versus 33 KB now.

That works because x, y, and existence are resolved separately:

- **x** — `featureIndex.search(...)` over `featurePositions`, padded by
  `HIT_SEARCH_PAD_PX` so a wide insertion marker is reachable from its locus.
- **y** — `rowsUnderCursor` (`variantCellLookup.ts`). Row `r` occupies
  `[r*rowHeight, r*rowHeight + max(rowHeight, 2))`, so for `rowHeight >= 2` the
  band is one row; only sub-pixel rows stack. `pickVariantCell` walks the band
  **nearest-first**, and the nearest row is also the last painted there, so the
  cell that reports is the cell visibly on top.
- **existence** — `findCellIndex` binary-searches the cell arrays. A cell is
  absent when the sample has no genotype at the site _or_ its genotype is
  all-reference under `referenceDrawingMode: 'skip'`. Answering from the arrays
  the renderer draws from is deliberate: a client-side predicate restating the
  skip rule would be a second copy of it, free to drift.

**Invariant this rests on:** `computeVariantCells` appends cells feature-major /
row-minor, then partitions them into a reference bucket `[0, refCellCount)` and
a non-reference bucket `[refCellCount, numCells)` — so each bucket stays sorted
by `(featureIndex, rowIndex)`. Anything that reorders cells (a new paint order,
a per-cell sort) must preserve that or rework `findCellIndex`.
`computeVariantCells.test.ts` (`cell bucket ordering`) pins it, in `draw` and
`skip` reference modes and with ungenotyped samples.

The partition is done by **writing from both ends of one buffer set** — ref
cells forward from 0, non-ref backward from `maxCells` — rather than filling a
scratch set and copying it into a second. That halves peak worker memory (23
B/cell scratch + 22 B/cell output → 22 B/cell; 135 MB → 66 MB at 1000 variants ×
3000 samples), which is what the per-cell cost is dominated by now that the
spatial index is gone. Two consequences to keep in mind when editing it: the
backward-written half lands **reversed** and is flipped back in place (that flip
is what preserves the sort invariant above), and the buffers are only `slice`d
when cells were skipped — a fully-genotyped VCF returns them untrimmed, so read
`numCells`, never `.length`.

The matrix display does not use any of this **hit-test** machinery — it inverts
`columnGeometry` instead, since its columns are laid out by feature index rather
than position. It does use the same both-ends partition
(`computeVariantMatrixCells`, pinned by its own `cell bucket ordering` tests),
for the same memory reason: 25 B/cell → 12 B/cell. It always draws ref cells
(`skip` mode is a grey background there), so both buckets always land.

## Cell coloring is one exclusive axis (`featureColor`)

`featureColor` is the single "what do the alt cells mean" selector, and only one
answer can be on screen at once. It holds either a jexl expression or one of
three sentinels the worker special-cases: `CONSEQUENCE_IMPACT_JEXL`,
`SV_TYPE_COLOR`, `PHASE_SET_COLOR`. Add new cell-coloring modes here rather than
as sibling toggles — two independent switches would need a precedence rule to
settle which wins, and the legend would have to guess the same way.

`PHASE_SET_COLOR` is the odd one: phase set is a per-**(feature, sample)**
FORMAT field, not a per-feature color, so `makeFeatureColor` returns no resolver
for it and the worker passes a `colorByPhaseSet` flag into the cell loops
instead. It used to have no control at all — any FORMAT carrying PS silently
switched the alt cells to a hue hash while the legend went on showing "Alt
allele" / "Other alt allele" swatches that then matched nothing. Being explicit
is the fix; keep it that way. It only applies in phased mode (the allele-count
loop never reads PS), so `getVariantLegendSections` falls back to the genotype
legend outside it rather than describing a scheme that isn't painted.

## Genotype maps cross the RPC boundary keyed by `sampleName`

`ProcessedSource` has two names: `name` (render identity, HP-suffixed in phased
mode — `"HG001 HP0"`) and `sampleName` (bare VCF identity — `"HG001"`). Any
sample→genotype `Record` crossing the RPC→model boundary must key by
`sampleName`; `name` silently breaks in phased mode. Holds for
`featureGenotypeMap[id].genotypes` (compute\*Cells), the `VariantComponent.tsx`
hover lookup (resolve `sampleName` via `sourceMap` first), and
`anchoredHaplotypeSort.ts`.

That map is a **genotype record, not a log of what got painted** — record every
genotype the sources cover, whether or not the loop emitted a cell for it. It is
what `sortByGenotype` reads (through the interned `genotypeCodes`), and under
the default `referenceDrawingMode: 'skip'` a hom-ref call paints nothing: keying
it off the drawn cells made every hom-ref row decode as code 0, i.e. `MISSING`
to `sortSourcesAroundVariant`, so the same data sorted differently in the
regular display than in the matrix (which always paints ref). It costs nothing
on the wire — `genotypeCodes` is a fixed `Uint16Array(numSamples)` either way.
Pinned by `computeVariantCells.test.ts`
(`featureGenotypeMap records every genotype`).

## Genotype matrices: NaN is the only missing marker

`getGenotypeMatrix` / `getPhasedGenotypeMatrix` emit `Float32Array` rows with
`NaN` for anything with no usable value (no-call, sample absent, unphased call
in phased mode). Don't reintroduce a sentinel on the value scale: the old `-1`
put a no-call further from a hom-alt genotype (3) than any two real genotypes
are from each other (2) under hclust's Euclidean metric, so samples clustered by
missingness. Consumers each resolve `NaN` their own way —
`executeClusterGenotypeMatrix` imputes to the site mean (the WASM rejects
non-finite input), `clusterRScript.ts` writes `NA`. See
`VariantRPC/genotypeMatrixEncoding.ts`.

Phased rows carry a **binary alt indicator**, not the raw allele index — an
allele index is a category, so Euclidean distance over it is meaningless. Where
allele identity matters, `anchoredHaplotypeSort.ts` compares alleles exactly.

`buildGenotypeMatrix.ts` is the single place that picks the matrix for a
rendering mode. Both the auto (WASM) and manual (R export) paths must go through
it; when only the auto path branched, manual clustering in phased mode silently
produced a sample-level tree wearing haplotype labels.

## Row sorting is anchored, not clustered

`sortByGenotype` orders rows by their genotype at the clicked variant, then
refines ties by the flanking sites reading outward. Hierarchical clustering
answers a different question — it wants one distance over the whole window, but
a haplotype is a mosaic, so past the first recombination breakpoint that
distance describes no position in particular. The anchored sort makes the mosaic
legible instead: the shared block reads as a rectangle and frays where
recombination ends it. Both are kept; clustering is the right tool zoomed out,
where it becomes a kinship ordering.

The refinement counting-sorts (site values are a handful of small categories)
and reuses every buffer across sites and buckets. The deep passes produce
thousands of two- and three-row buckets, so anything allocating per bucket or
per row dominates — an earlier comparison-sort version was ~4x slower.

## Settings: classify by invalidation tier

A setting can live in a config slot (`SharedVariantConfigSchema.ts`, read via
`getConf` / written via `self.configuration.setSlot` — these survive hide/retick
and can take a declarative config default), a bespoke MST property (`rowHeight`,
`jexlFilters`), or a volatile (`showLegend`, `cellData`). There's no single
rule, and the two display families still disagree in places (`showLegend` is
volatile here, a config slot in LD). One rule that did settle: a **drag-resized
dimension goes on the config slot**, because the config node outlives the
display instance — that's why `height` (`TrackHeightMixin`) and `lineZoneHeight`
are slots in both families, each written by an identical clamped setter
(`clampLineZoneHeight`, `shared/lineZoneHeight.test.ts`). The matrix raises the
shared slot's 0 default by redeclaring it in its own schema, the same way it
redeclares `height`. What matters when adding a setting is the tier it
invalidates:

| Tier             | Change triggers           | Wired in                                      |
| ---------------- | ------------------------- | --------------------------------------------- |
| **Fetch input**  | refetch (recompute cells) | `rpcProps()`, watched by `SettingsInvalidate` |
| **Layout input** | reorder rows              | `sourcesBase` / `sources` / `hierarchy`       |
| **Render input** | repaint only              | subclass `renderState` getter                 |

`rpcProps()` is the only structural marker of a fetch input — wrong tier means
needless refetches or stale cells. `renderingMode` spans all three (hence its
special-cased setter). Invariant: **`rpcProps()` must not read fetch-derived
state** (`sampleInfo`, `cellData`, `sources`) or it loops via `setCellData`;
that's why it reads `sourcesBase`, not `sources`.

Note the layout tier is **not** "no refetch": `sourcesBase` is literally
`rpcProps().sources`, so a reorder — drag, cluster, `colorBy`/`groupBy` — does
refetch, and has to. The worker assigns each cell a `rowIndex` against the
source order it was handed, so cells computed for the old order describe the
wrong rows. Only `sources` (the phased-expanded render view) and `hierarchy` are
layout-only, which is exactly why `rpcProps()` reads the un-expanded
`sourcesBase`.

The tier is **per display**, not per setting, so the base `rpcProps()` carries
only what both send and a subclass extends it by super-capture.
`referenceDrawingMode` is the live example: regular mode omits reference cells
from the payload entirely when it's `'skip'` (`computeVariantCells`), so it's a
fetch input there and `LinearMultiSampleVariantDisplay` adds it back; the matrix
always computes ref cells and greys its background in CSS, so for it the setting
is a render input. Listing it in the base made every matrix display-type switch
refetch identical bytes, because `PORTABLE_CONFIG_KEYS` copies the slot across.

### Matrix mode is zoom-cache-strict (`isCacheValid`)

The **matrix** display (`cellDataMode === 'matrix'`) lays columns out by feature
index across the full width, so the displayed feature set is the **visible**
region for the _current_ zoom — it fetches `view.visibleRegions` (not the
half-screen-buffered set regular mode uses), since off-screen buffered features
would otherwise cram extra columns into the viewport and draw connector lines to
off-screen genomic positions (see `fetchRegionsForMode`). Zooming in/out changes
which features show even when the viewport stays spatially inside loaded data,
so `MultiSampleVariantBaseModel` overrides `isCacheValid` to require
`view.bpPerPx === loadedBpPerPx` (recorded in `fetchNeeded`, cleared in
`clearDisplaySpecificData`) — the same strict-zoom rule wiggle uses (adr-008).
Without it, zoom-**in** never refetches and the matrix stays stale. Because
matrix records the visible (un-buffered) region as loaded, panning also moves
the visible block out of the loaded bounds and correctly refetches. **Regular**
mode draws each variant at its genomic position, so spatial `isBlockCovered`
coverage alone is correct and it keeps the buffered fetch — don't extend the
strict-zoom check or the visible-only fetch to it (needless refetches). The
connector lines, GPU/Canvas render, hit-test, and SVG export all key off
`view.totalWidthPxWithoutBorders` (the rounded width) so columns/lines/clicks
stay pixel-aligned — via the `columnGeometry` getter, which is also what the
click hit-test inverts.

## Connector lines: one frame, one coord list

The lines tying a matrix column to its genomic position are shared by the LD and
multi-sample-matrix displays (`shared/ConnectorLines.tsx`): the field, hover
hit-test, tooltip, crosshair line, zone resize, and SVG export all live there.
Each display contributes only a `connectorLineCoords` **model getter** —
`{mx, gx, label}` in **viewport pixels**, 0 = the view's left edge. Rules that
keep the two from drifting:

- Coords are computed on the model, not in a component `useMemo`. They depend on
  `view.bpPerPx`/`offsetPx`, and a memo that doesn't re-run also stops
  _tracking_ those, so the overlay can miss a zoom entirely.
- One frame, no group transform. The `|offsetPx|` gap when content doesn't reach
  the left edge is baked into `mx`/`gx` (LD via `renderTransform.viewOffsetX`,
  matrix via `columnGeometry.left`), so the live overlay and the export don't
  each restate a shift.
- The LD column pitch comes from the **fetch-time** cell width
  (`cellWidth * SQRT2` = `uniformW * SQRT2`) rescaled by `renderTransform`,
  exactly like the shader and `hitTest`. Deriving it from the live block width
  double-applies the zoom during the debounce+RPC window.
- No genomic x means no line: `genomicViewportX` returns undefined when the
  refName has left the view, and callers drop that entry instead of pinning it
  to x=0 (which also skewed the field's density-derived alpha).
- Per-line alpha is an ink budget, so it takes the stroke width
  (`connectorLineAlpha`) — LD's 1px lines and the matrix's 0.5px lines must read
  as equally dark at equal density.
- The hovered coord is React state but the list is a computed off the view, so
  the overlay only draws a hover still present in the current list. A zoom fires
  no mousemove, and identity alone left the red line and tooltip on the column's
  old position (`ConnectorLines.test.tsx`).
- The resize handle is gated on `lineZoneHeight`, never on there being lines: an
  empty viewport still reserves the zone, and that is when a user most wants to
  drag it shut. It drags from where it is drawn, not from the slot, because
  `effectiveLineZoneHeight` can be something taller than the slot.
- LD's genomic-positions mode has no connectors (the triangle is already at
  genomic x) and reserves the band only for what is switched on — the
  recombination plot at `recombinationZoneHeight`, the labels at the draggable
  `lineZoneHeight`, whichever is taller. Room for the rotated labels is dragged,
  not measured; before that they had no band and drew over the triangle.

## Allele counting: two implementations on purpose, count inline

`shared/alleleCounts.ts` keeps two counters that look like duplication but are
context-tuned — don't merge into a shared accumulator + per-allele helper:

- `calculateAlleleCountsFast` (VCF hot path) accumulates into an object `b`
  because it runs inside the `processGenotypes` closure (mutating captured
  primitive `let`s forces a V8 Context deopt).
- `calculateAlleleCounts` (genotypes object) is a plain loop, so it uses
  local-variable counters (faster than object fields).

Rule: count inline while iterating; a transform-then-tally shape or per-allele
function call regresses the hot loop. Length filtering is no longer built in —
use a jexl filter (`jexl:get(feature,'end')-get(feature,'start')<N`), like the
`maf()` / `missingness()` jexl functions in `index.ts`. `lengthCutoffFilter` was
removed here (no UI, never set); LD keeps its functional one.

## Minor allele frequency: one definition, two computations

MAF is over **called** alleles — `.` is missingness, never a candidate minor
allele nor part of the denominator (`missingness` is its own metric, the
complement of LD's `callRateFilter`). The definition lives in
`summarizeAlleleCounts` (`shared/minorAlleleFrequencyUtils.ts`), which yields
MAF, missingness, the primary alt, and the called-allele total from a single
pass; `calculateMinorAlleleFrequency` / `calculateMissingnessFrequency` (the
`maf()` / `missingness()` jexl functions) are wrappers on it, so the two
denominators can't drift apart again.

LD computes its own, off `packHaplotypesWithCounts` / `fillEncoded`
(`VariantRPC/getLDMatrix.ts`) rather than an allele-count Record, because it
already walks genotypes to build the dosage encoding. It has to land on the same
number: count **alleles** (`nAltAlleles / nCalledAlleles`), not genotype classes
over `2 * nValid` — the latter mis-weights a mixed-ploidy site and a half-call.
`nValid` stays a whole-genotype count because HWE and call rate need one; a
half-call encodes as dosage-missing in both paths, since one called allele
doesn't determine a dosage.

`getFilteredVariants` filters on those thresholds and nothing else. A site with
no called allele anywhere drops (nothing to draw); a **monomorphic** site does
not — dropping all-ref while keeping all-alt was an asymmetry, and a MAF floor
above 0 removes both anyway.

## Genotypes: string `genotypes` map is the only representation

Features carry genotypes as a `Record<sampleName, string>`
(`feature.get( 'genotypes')`) or the faster `processGenotypes` callback
(`VcfFeature`). A packed int8 `callGenotype` path used to exist across the cell,
LD, and clustering computations as anticipatory infra for a non-VCF binary
adapter, but no shipping adapter ever set the field, so it was dead and has been
removed. If a binary genotype adapter is added later, reintroduce a raw fast
path behind a real feature field rather than resurrecting the untestable
branches.

## Edit-filters (jexl) wiring

The Edit filters dialog writes `jexlFilters`; they reach the worker via the
standard filter contract. The model's `filters` getter (a
`SerializableFilterChain`) is in `rpcProps()`, so editing refetches and forwards
it. `MultiSampleVariantGet{CellData,GenotypeMatrix,ClusterGenotypeMatrix}`
extend `RpcMethodTypeWithFiltersAndRenameRegions`, which serializes the chain to
string[] and rebuilds it in the worker with `pluginManager.jexl`. The worker
applies it in `getFilteredVariants` (`filterChain` param), so cell data and
clustering share one filtered set. Pass `filters` as a chain, not a string[] —
`serializeArguments` calls `.toJSON()`. That same chokepoint applies the two
frequency ceilings off one allele-count pass: `minorAlleleFrequencyFilter`
(floor) and `maxMissingnessFilter` (no-call ceiling, 1 = keep all) — both config
slots, both in `rpcProps()`.

## Phased expansion has one home

The `"<sampleName> HP<n>"` convention and ploidy defaulting live only in
`expandSourcesToHaplotypes` (`shared/getSources.ts`), called by the worker, the
`sources` getter, `getPhasedGenotypeMatrix`, and the cluster dialog. Don't
re-inline the `flatMap(... makeHaplotypeSources ...)` pattern — labels and
rendered rows drift. `getPhasedGenotypeMatrix` is where that already happened:
its copy keyed both the ploidy lookup and the label off `name` rather than the
resolved `sampleName`, so a source whose render name differs from its sample
name got diploid rows the pasted cluster order couldn't be lined up against.
`HP` is non-optional on the returned `HaplotypeSource`, so a caller indexing by
haplotype takes it from the type instead of restating a `?? 2` of its own.
