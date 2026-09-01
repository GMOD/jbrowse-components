---
id: cigar-utils
title: cigar-utils
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## buildReadVsRefFeatures

Decompose one alignment record plus its SA tag into the segments of the split
read, ordered along the read. The layer above `featurizeSA`: it folds the
record itself in as one more segment, in the same normalized read coordinate
space the SA entries are put in, and pairs each segment with a `mate`
describing its span on the read.

This is what the "read vs ref" launchers (linear synteny + dotplot) draw
against a synthetic read assembly, and what the alignments feature-detail
widget lists split-read junctions from.

`getCanonicalRefName` resolves each segment's refName against the reference
assembly's aliases: a BAM whose header says `chr1` against a FASTA whose
refName is `1` otherwise yields regions no track can be opened on. Optional
only because a caller may not have the assembly in hand; pass it when you do.

```js
// type signature
(feature: ReadVsRefInput, getCanonicalRefName?: ((refName: string) => string | undefined) | undefined) => ReadVsRefFeatures
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/buildReadVsRefFeatures.ts)

## featurizeSAEntries

featurizeSA over pre-split entries (see splitSA). Lets a caller filter the
entries first — e.g. deduplicating the records repeated across a split read's
segments — without paying to split and rejoin the tag around the filter.

```js
// type signature
(entries: string[], id: string, strand: number | undefined, readName: string | undefined, normalize?: boolean | undefined) => {…}[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

## getLength

Length of the read sequence (sum of all ops except D/N).

```js
// type signature
(cigar: string) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

## getLengthOnRef

Length the read spans on the reference (sum of M/=/X/D/N ops).

```js
// type signature
(cigar: string) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

## getMismatches

Computes the list of mismatches (SNVs, indels, clips, skips) for a read from
its CIGAR, optional MD tag, sequence, reference, and quality.

```js
// type signature
(cigar?: string | undefined, md?: string | undefined, seq?: string | undefined, ref?: string | undefined, qual?: Uint8Array<ArrayBufferLike> | undefined) => Mismatch[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

## getNextRefPos

Maps read-sequence positions to reference-sequence positions via the CIGAR,
invoking the callback for each. Handles both packed Uint32Array and unpacked
number[] CIGAR formats.

**Driven by the POSITIONS, not by the read bases.** This used to run an inner
loop over every base an op spans, testing `positions[currPos] === readPos + j`
— so it was O(read length) to find something O(positions) in size. On the full
extent of `200x.longread.mod.bam` that is 43.7 Mbp of read sequence scanned to
place 0.84M modification calls. Within one op the read-to-reference offset is
a constant, so each position's answer is one addition and the ops only have to
be walked once: O(positions + ops).
`plugins/alignments/benches/cigarWalkShape.bench.ts` prices it at **1.17x on
the whole per-read modification pipeline**, of which this walk is 45%.

**1.17x is the whole of it, and does not grow on a cleaner alignment.** The
first reading of that gap was that the op loop caps it — these reads carry
7,000 ops apiece, and neither shape avoids the op loop. `cigarOpDensity.bench.ts`
sweeps op density over a 5,000x range and the ratio stays between 1.10x and
1.18x, so that reading was wrong: what this phase is bound by is the per-CALL
work both shapes share — the callback, the ML lookup, the compare, the write —
not the traversal that differs. Changing how the scan is shaped therefore has a
low ceiling here, however lopsided the iteration counts look.

`positions` must be ASCENDING, which every caller's producer guarantees. The
one behaviour that changed with the shape: a REPEATED position used to be
dropped and to block every position after it (the per-base loop could match at
most one position per base offset), and now emits once per occurrence.

```js
// type signature
(cigarOps: ArrayLike<number>, positions: number[], callback: (ref: number, idx: number) => void) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/getNextRefPos.ts)

## parseCigar

Parses a CIGAR string to an alternating `[length, op, ...]` string array.

```js
// type signature
(s?: string) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

## parseCigar2

Parses a CIGAR string to a packed number array where each value is
`(length << 4) | opIndex`.

```js
// type signature
(s?: string) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

## parseCigar2Typed

Same encoding as `parseCigar2` but writes into a packed `Uint32Array` —
matches the NUMERIC_CIGAR format that BAM/CRAM adapters emit, so consumers can
use a single typed-array code path.

```js
// type signature
(s?: string) => Uint32Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

## splitSA

The `;`-separated alignment records of an SA tag, empties dropped — the input
`featurizeSAEntries` expects.

```js
// type signature
(SA: string) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)
