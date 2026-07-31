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

## Both read-feature walks must agree with cram-js's `getCigarString()`

`readFeaturesToNumericCIGAR` and `readFeaturesToMismatches` are the third and
fourth independent walks over the same read features — cram-js has
`getCigarString()` and `decodeReadSequence()`. Three bugs came out of that
duplication, all confirmed against `samtools view` on htslib's own fixtures:

- **q/Q are not alignment positions.** Their `refPos` says where a quality score
  sits in the _read_, so a Q after an insertion points _back into_ it. Both
  walks must gate on `RF_POSITIONAL[code]` (exported by cram-js, which documents
  why). Letting one through emitted `1I1I` for `2I`, and split a 2-base
  insertion into two 1-base mismatch callbacks.
- **A pending `i` run must flush before any other op**, not just before a match
  region. Flushing on match only merged the two insertions of `c2#pad` s4 across
  the deletion between them: `4M1D2I4M` for samtools' `4M1I1D1I4M`.
- **Zero-length ops must be dropped and same-op runs merged.** `xx#minimal` a1
  is `10H`, not the `5H5H` its two hard-clip features read as; a2 is `5H10M5H`,
  not `5H0I10M0D5H`.

To check a change to either walk, sweep every cram-js fixture and diff the
numeric walk against `record.getCigarString()` — decode with cram-js's
`CramFile` + `getAllRecords()` (no `seqFetch`, so no reference is needed) over
`containerCount()` × the container header's landmarks. That was 0 disagreements
across 122,869 mapped records in 128 fixtures, with one documented exception:
cram-js returns `'*'` where no op survives, which `numericCigarToString` spells
as `''`.
