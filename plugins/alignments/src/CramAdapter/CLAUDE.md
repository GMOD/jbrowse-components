# CramAdapter

## Keep `getReadBases()` (seq decode) off the hot render path

`CramSlightlyLazyFeature.get(field)` has direct cases for the hot fields the
render path reads (`start`/`end`/`strand`/`next_pos`/`next_ref`/`tags`/`flags`/
…), each reading straight off `this.record`. They must **not** fall through to
the `default` → `this.fields[field]` branch: `fields` is memoized but building
it once still touches every getter, and a stray fall-through forces work per
read.

`seq` is deliberately **not** in `fields`. `this.seq` calls
`record.getReadBases()`, decoding the entire read (10kb+ on long-read CRAM) —
and the render path never needs it (only the sequence track and a few colorBy
modes call `get('seq')`, which has its own case). Keep `seq` and
`convertTagsToPlainArrays` only in `toJSON()` (the serialization path). `fields`
and `get('tags')` return raw `this.tags`, matching `BamSlightlyLazyFeature`.

## `mismatches` getter allocates — render path drives `forEachMismatch`

Same as BAM: `extractCigarFeatures` drives off `forEachMismatch` directly
(zero-alloc). `get mismatches` builds a `Mismatch[]` and is kept only for
`get('mismatches')` / details, not the render path. It is **not**
`cacheGetter`'d — the render path never reads it, so a cache would be dead
weight that also pins a large array per ultra-long LRU read.
