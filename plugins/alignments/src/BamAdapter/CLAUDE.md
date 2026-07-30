# BamAdapter

## `BamSlightlyLazyFeature.get(field)` is a hot dispatch

The per-feature loop in `shared/extractFeatureArrays.ts` calls
`feature.get('start' | 'strand' | 'next_pos' | 'next_ref' | 'tags')` plus
`feature.id()` per feature. Direct typed property access on the worker-side
class would skip the `get()` switch entirely. Worth doing, but it touches the
`Feature` abstraction; treat as a deliberate refactor, not a drive-by.

## `fields` vs `get()` — keep conversion out of `fields`, and don't memoize it

`get('tags')` hits the switch and returns raw `this.tags` directly — it never
touches `fields`. The `fields` getter is only reached via the `default` branch
for uncommon fields not in the switch. Do **not** move
`convertTagsToPlainArrays` into `fields`; it belongs only in `toJSON()` (the
MST/serialization path). Putting it in `fields` would be dead code for the hot
render path and inconsistent with what `get('tags')` returns.

Instrumenting a real `extractFeatureArrays` pass over a pacbio pileup counts **0
`fields` accesses per read** — every field the render path asks for has its own
switch case. The old `_cachedFields` memo therefore never served the hot path;
it only added state on a class that already exists once per read. `fields` is
now rebuilt on demand. Same measurement, same conclusion, for CRAM's
`cacheGetter(fields)`.

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
reads, via `seqFetchSpan`). Each no-MD record is emitted as
`record.withRegionRef(regionSeq, record.start - span.start)`, carrying the
shared string plus its own offset into it; `forEachMismatchNumeric` indexes
`ref.charCodeAt(refOffset + roffset + j)`. No per-read substring is copied. The
sequence adapter is also only loaded when `seqFetchSpan` returns non-null, so
MD-tagged BAMs skip it entirely.

**`withRegionRef`, never `record.ref = …`.** These records are not per-fetch:
`@gmod/bam` memoizes decoded records in a per-file chunk LRU keyed on the
chunk's block positions, so two queries resolving to the same chunk span get the
identical objects back. A display fetches all its needed regions at once, so
assigning let the last fetch to resolve rebind the read for every other region
still holding it — resolving one region's mismatches against another's
sequence. It hid for a long time because two *different* query ranges normally
produce different chunk keys, so the cache misses and each fetch decodes its own
copy; re-querying one range is what makes the cache actually hit. Covered by
`regionRefAliasing.test.ts` (BAM and SAM both). `withRegionRef` is an
`Object.create` view, so BamRecord's `_cached*` memos on the shared record are
still read through the prototype chain.
