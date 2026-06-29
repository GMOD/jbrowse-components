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
`sortSourcesByGenotype`.

## Settings: classify by invalidation tier

A setting can live in a config slot (`SharedVariantConfigSchema.ts`), a
`ConfigOverrideMixin` key (`getConfWithOverride`/`setOverride` — keys appear
flat in session snapshots and must be declared in the `ConfigOverrideMixin`
call's `configKeys` list), a bespoke MST property (`rowHeight`, `jexlFilters`,
`lineZoneHeight`), or a volatile (`showLegend`, `cellData`). There's no single
rule, and the two display families disagree (`showLegend` is volatile here, a
config override in LD). What matters when adding one is the tier it invalidates:

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
stay pixel-aligned.

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
`maf()` jexl function in `index.ts`. `lengthCutoffFilter` was removed here (no
UI, never set); LD keeps its functional one.

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
applies it in `getFeaturesThatPassMinorAlleleFrequencyFilter` (`filterChain`
param), so cell data and clustering share one filtered set. Pass `filters` as a
chain, not a string[] — `serializeArguments` calls `.toJSON()`.

## Phased expansion has one home

The `"<sampleName> HP<n>"` convention and ploidy defaulting live only in
`expandSourcesToHaplotypes` (`shared/getSources.ts`), called by the worker, the
`sources` getter, and the cluster dialog. Don't re-inline the
`flatMap(... makeHaplotypeSources ...)` pattern — labels and rendered rows
drift.
