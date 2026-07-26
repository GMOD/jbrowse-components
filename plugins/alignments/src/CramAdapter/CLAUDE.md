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
`get('mismatches')` / details, not the render path. Not memoized — the render
path never reads it, so a cache would be dead weight that also pins a large
array per ultra-long LRU read.

## Only `NUMERIC_CIGAR` is memoized, and only because of the LRU

Measured per-read `get(field)` counts over a real `extractFeatureArrays` pass
(long-read CRAM, `volvox-inv-pbsim.cram`):

| field             | accesses/read | memoized |
| ----------------- | ------------- | -------- |
| `tags`            | 3.00          | no       |
| `start`, `strand` | 2.00          | no       |
| `NUMERIC_CIGAR`   | 1.00          | **yes**  |
| `fields`, `CIGAR` | 0.00          | no       |

`fields` and `CIGAR` are never touched on the render path at all — only
`toJSON()` / details read them, once each — so the old `cacheGetter` calls on
them were pure state. `tags` is read three times but an in-process A/B put
re-spreading (1.06ms/pass, 400 reads) ahead of a cached copy (1.09ms).
`NUMERIC_CIGAR` is read once per read, so its memo does nothing _within_ a pass;
it pays off only because `ultraLongFeatureCache` hands the same wrapper back
after a pan (8.4ms rebuilt vs 7.3ms reused, ~13%). Drop one and the other stops
earning its keep. Add a cache here only with an interleaved A/B behind it.
