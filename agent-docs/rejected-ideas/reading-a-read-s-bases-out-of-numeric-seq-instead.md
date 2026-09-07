---
name: reading-a-read-s-bases-out-of-numeric-seq-instead
description: Reading a read's bases out of `NUMERIC_SEQ` instead of decoding `seq`
area: performance-and-measurement
---

# Reading a read's bases out of `NUMERIC_SEQ` instead of decoding `seq`

—
measured 2026-08-13 in `computeReadBaseCounts` and declined at **parity**
(6.73x vs 6.74x on `200x.longread.mod`, 3.77x vs 3.68x on `20x.longread.mod`,
each run one fixture per process against the shipped baseline; three earlier
all-in-one-process runs agreed). It looks like a clear win and the reasoning
is worth keeping,
because it applies to any consumer of BAM's packed SEQ. Once that function
walks only the modified columns it reads ~28% of a long read's bases, so
decoding the other 72% into a string reads as pure waste. It is not: the
decode is a `TextDecoder` pass over a `Uint16Array` of precomputed base pairs
at ~GB/s, and `charCodeAt` on the flat result is a single load — while the
nibble path pays a shift, a mask and a second table indirection
(`CHAR_CODE_FROM_NIBBLE`) at every column. They trade evenly. It would also
fork the function, since CRAM has no packed SEQ at all — `getReadBases()` is a
string, and a cached one. Kept as a live arm in
`plugins/alignments/benches/readBaseCounts.bench.ts` so the negative stays
reproducible. Same shape as the VCF entry below: the decode is nearly free and
the byte scan is not faster.
