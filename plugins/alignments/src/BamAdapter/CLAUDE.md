# BamAdapter

## `BamSlightlyLazyFeature.get(field)` is a hot dispatch

The per-feature loop in `shared/extractFeatureArrays.ts` calls
`feature.get('start' | 'strand' | 'next_pos' | 'next_ref' | 'tags')` plus
`feature.id()` per feature. Direct typed property access on the worker-side
class would skip the `get()` switch entirely. Worth doing, but it touches the
`Feature` abstraction; treat as a deliberate refactor, not a drive-by.

## `fields` vs `get()` — keep conversion out of `fields`

`get('tags')` hits the switch and returns raw `this.tags` directly — it never
touches `fields`. The `fields` getter is only reached via the `default` branch
for uncommon fields not in the switch. Do **not** move
`convertTagsToPlainArrays` into `fields`; it belongs only in `toJSON()` (the
MST/serialization path). Putting it in `fields` would be dead code for the hot
render path and inconsistent with what `get('tags')` returns.

## `mismatches` getter allocates — hot path no longer uses it

`get mismatches` builds the full `Mismatch[]` array. The hot render path
(`extractCigarFeatures` via `extractFeatureArrays`) now drives off
`feature.forEachMismatch` directly (zero-alloc, ~1.75x faster on real pacbio
reads — see scratch bench). The getter is kept only for `get('mismatches')`,
still used by `BamAdapter.test.ts` / `CombinationTest.test.ts` as a public field
accessor; don't reintroduce it into the render path.

## Sequence pre-fetch span — shared string, no per-read slice

`BamAdapter.getFeatures` pre-fetches a single contiguous reference span covering
all reads-without-MD in the region (`Math.min(start)`/`Math.max(end)` across
reads, via `seqFetchSpan`). Each no-MD record stores `record.ref = regionSeq`
(the shared string) plus `record.refOffset = start - span.start`;
`forEachMismatchNumeric` indexes `ref.charCodeAt(refOffset + roffset + j)`.
No per-read substring is copied. The sequence adapter is also only loaded when
`seqFetchSpan` returns non-null, so MD-tagged BAMs skip it entirely.
