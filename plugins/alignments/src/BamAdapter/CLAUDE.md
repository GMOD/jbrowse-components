# BamAdapter

## `BamSlightlyLazyFeature.get(field)` is a hot dispatch

The per-feature loop in `shared/extractFeatureArrays.ts` calls
`feature.get('start' | 'strand' | 'NUMERIC_QUAL' | 'mismatches' | 'next_pos' | 'next_ref' | 'tags')`
plus `feature.id()` — eight dispatches through the `get()` switch per feature.
Direct typed property access on the worker-side class would skip the switch
entirely. Worth doing, but it touches the `Feature` abstraction; treat as a
deliberate refactor, not a drive-by.

## `fields` vs `get()` — keep conversion out of `fields`

`get('tags')` hits the switch and returns raw `this.tags` directly — it never
touches `fields`. The `fields` getter is only reached via the `default` branch
for uncommon fields not in the switch. Do **not** move `convertTagsToPlainArrays`
into `fields`; it belongs only in `toJSON()` (the MST/serialization path). Putting
it in `fields` would be dead code for the hot render path and inconsistent with
what `get('tags')` returns.

## `mismatches` getter allocates

`get mismatches` builds the full `Mismatch[]` array. The single remaining
consumer is `extractCigarFeatures` (via `extractFeatureArrays`). Migrate that
callsite to `feature.forEachMismatch` (zero-alloc) before deleting the getter.

## Sequence pre-fetch span

`BamAdapter.getFeatures` pre-fetches a single contiguous reference span covering
all reads-without-MD in the region (`Math.min(start)`/`Math.max(end)` across
reads). For long-read tracks without MD this can fetch megabases of reference
and then `record.ref = regionSeq.slice(...)` duplicates substrings into N
records. Passing `(refSeq, refStart)` views to consumers instead of slicing per
record would eliminate the O(N × readLen) string copy. Not done yet.
