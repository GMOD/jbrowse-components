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

## Genotype maps cross the RPC boundary keyed by `sampleName`

`ProcessedSource` has two names: `name` (render identity, HP-suffixed in phased
mode — `"HG001 HP0"`) and `sampleName` (bare VCF identity — `"HG001"`). Any
sample→genotype `Record` crossing the RPC→model boundary must key by
`sampleName`; `name` silently breaks in phased mode. Holds for
`featureGenotypeMap[id].genotypes` (compute\*Cells), the `VariantComponent.tsx`
hover lookup (resolve `sampleName` via `sourceMap` first), and
`anchoredHaplotypeSort.ts`.

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
| **Layout input** | reorder rows, no refetch  | `sourcesBase` / `sources` / `hierarchy`       |
| **Render input** | repaint only              | subclass `renderState` getter                 |

`rpcProps()` is the only structural marker of a fetch input — wrong tier means
needless refetches or stale cells. `renderingMode` spans all three (hence its
special-cased setter). Invariant: **`rpcProps()` must not read fetch-derived
state** (`sampleInfo`, `cellData`, `sources`) or it loops via `setCellData`;
that's why it reads `sourcesBase`, not `sources`.

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
`sources` getter, and the cluster dialog. Don't re-inline the
`flatMap(... makeHaplotypeSources ...)` pattern — labels and rendered rows
drift.
