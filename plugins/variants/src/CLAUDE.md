# shared (MultiSampleVariant)

## Hot loops: indexed for-loops only

The per-feature × per-sample loops run `numFeatures * numSamples` times (10⁸+ on
real VCFs). Inside them:

- indexed `for`, never `.forEach`/`.map`/`.find`/`.filter` (closure alloc, no
  inlining)
- `for (const key in obj)`, never `Object.values/entries/keys` (temp array)
- no `??`/`||` fallbacks wrapping allocating right-sides

Applies to `computeVariantCells.ts`, `computeVariantMatrixCells.ts`, and
`attachBackend` upload/render callbacks touching per-cell data. NOT to:
`perRegionCellData` iteration (1-3 regions), one-shot actions (sort, hover), UI,
or VCF-parse / RPC-arg-shaping (amortized). Don't apply it everywhere — the rest
of the codebase prefers declarative iteration.

## Genotype maps cross the RPC boundary keyed by `sampleName`

`ProcessedSource` has two names: `name` (render identity, HP-suffixed in phased
mode — `"HG001 HP0"`) and `sampleName` (bare VCF identity — `"HG001"`). Any
sample→genotype `Record` crossing the RPC→model boundary must key by
`sampleName`; `name` silently breaks in phased mode. Holds for
`featureGenotypeMap[id].genotypes` (compute*Cells), the `VariantComponent.tsx`
hover lookup (resolve `sampleName` via `sourceMap` first), and
`sortSourcesByGenotype`.

## Settings: classify by invalidation tier

A setting can live in a config slot (`SharedVariantConfigSchema.ts`),
`configOverrides` (`ConfigOverrideMixin`, via `getConfWithOverride`/`setOverride`),
a bespoke MST property (`rowHeightMode`, `jexlFilters`, `lineZoneHeight`), or a
volatile (`showLegend`, `cellData`). There's no single rule, and the two display
families disagree (`showLegend` is volatile here, a `configOverride` in LD). What
matters when adding one is the tier it invalidates:

| Tier             | Change triggers          | Wired in                              |
| ---------------- | ------------------------ | ------------------------------------- |
| **Fetch input**  | refetch (recompute cells) | `rpcProps()`, watched by `SettingsInvalidate` |
| **Layout input** | reorder rows, no refetch  | `sourcesBase` / `sources` / `hierarchy` |
| **Render input** | repaint only              | subclass `renderState` getter         |

`rpcProps()` is the only structural marker of a fetch input — wrong tier means
needless refetches or stale cells. `renderingMode` spans all three (hence its
special-cased setter). Invariant: **`rpcProps()` must not read fetch-derived
state** (`sampleInfo`, `cellData`, `sources`) or it loops via `setCellData`;
that's why it reads `sourcesBase`, not `sources`.

## Allele counting: three implementations on purpose, count inline

`shared/alleleCounts.ts` keeps three counters that look like duplication but are
context-tuned — don't merge into a shared accumulator + per-allele helper:

- `calculateAlleleCountsFast` (VCF hot path) accumulates into an object `b`
  because it runs inside the `processGenotypes` closure (mutating captured
  primitive `let`s forces a V8 Context deopt).
- `calculateAlleleCounts` (genotypes object) and `calculateAlleleCountsFromRaw`
  (int8) are plain loops, so they use local-variable counters (faster than object
  fields).

Rule: count inline while iterating; a transform-then-tally shape or per-allele
function call regresses the hot loop. Length filtering is no longer built in —
use a jexl filter (`jexl:get(feature,'end')-get(feature,'start')<N`), like the
`maf()` jexl function in `index.ts`. `lengthCutoffFilter` was removed here (no UI,
never set); LD keeps its functional one.

## Edit-filters (jexl) wiring

The Edit filters dialog writes `jexlFilters`; they reach the worker via the
standard filter contract. The model's `filters` getter (a
`SerializableFilterChain`) is in `rpcProps()`, so editing refetches and forwards
it. `MultiSampleVariantGet{CellData,GenotypeMatrix,ClusterGenotypeMatrix}` extend
`RpcMethodTypeWithFiltersAndRenameRegions`, which serializes the chain to string[]
and rebuilds it in the worker with `pluginManager.jexl`. The worker applies it in
`getFeaturesThatPassMinorAlleleFrequencyFilter` (`filterChain` param), so cell
data and clustering share one filtered set. Pass `filters` as a chain, not a
string[] — `serializeArguments` calls `.toJSON()`.

## Phased expansion has one home

The `"<sampleName> HP<n>"` convention and ploidy defaulting live only in
`expandSourcesToHaplotypes` (`shared/getSources.ts`), called by the worker, the
`sources` getter, and the cluster dialog. Don't re-inline the
`flatMap(... makeHaplotypeSources ...)` pattern — labels and rendered rows drift.
