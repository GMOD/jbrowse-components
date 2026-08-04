# @jbrowse/cigar-utils

Pure CIGAR / MD / mismatch parsers and types — no rendering or framework deps

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### buildReadVsRefFeatures

Decompose one alignment record plus its SA tag into the segments of the split
read, ordered along the read. The layer above `featurizeSA`: it folds the record
itself in as one more segment, in the same normalized read coordinate space the
SA entries are put in, and pairs each segment with a `mate` describing its span
on the read.

This is what the "read vs ref" launchers (linear synteny + dotplot) draw against
a synthetic read assembly, and what the alignments feature-detail widget lists
split-read junctions from.

`getCanonicalRefName` resolves each segment's refName against the reference
assembly's aliases: a BAM whose header says `chr1` against a FASTA whose refName
is `1` otherwise yields regions no track can be opened on. Optional only because
a caller may not have the assembly in hand; pass it when you do.

```js
// type signature
(feature: ReadVsRefInput, getCanonicalRefName?: ((refName: string) => string | undefined) | undefined) => ReadVsRefFeatures
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/buildReadVsRefFeatures.ts)

### featurizeSAEntries

featurizeSA over pre-split entries (see splitSA). Lets a caller filter the
entries first — e.g. deduplicating the records repeated across a split read's
segments — without paying to split and rejoin the tag around the filter.

```js
// type signature
(entries: string[], id: string, strand: number | undefined, readName: string | undefined, normalize?: boolean | undefined) => {…}[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

### getLength

Length of the read sequence (sum of all ops except D/N).

```js
// type signature
(cigar: string) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

### getLengthOnRef

Length the read spans on the reference (sum of M/=/X/D/N ops).

```js
// type signature
(cigar: string) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

### getMismatches

Computes the list of mismatches (SNVs, indels, clips, skips) for a read from its
CIGAR, optional MD tag, sequence, reference, and quality.

```js
// type signature
(cigar?: string | undefined, md?: string | undefined, seq?: string | undefined, ref?: string | undefined, qual?: Uint8Array<ArrayBufferLike> | undefined) => Mismatch[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

### getNextRefPos

Maps read-sequence positions to reference-sequence positions via the CIGAR,
invoking the callback for each. Handles both packed Uint32Array and unpacked
number[] CIGAR formats.

```js
// type signature
(cigarOps: ArrayLike<number>, positions: number[], callback: (ref: number, idx: number) => void) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/getNextRefPos.ts)

### parseCigar

Parses a CIGAR string to an alternating `[length, op, ...]` string array.

```js
// type signature
(s?: string) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

### parseCigar2

Parses a CIGAR string to a packed number array where each value is
`(length << 4) | opIndex`.

```js
// type signature
(s?: string) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

### parseCigar2Typed

Same encoding as `parseCigar2` but writes into a packed `Uint32Array` — matches
the NUMERIC_CIGAR format that BAM/CRAM adapters emit, so consumers can use a
single typed-array code path.

```js
// type signature
(s?: string) => Uint32Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

### splitSA

The `;`-separated alignment records of an SA tag, empties dropped — the input
`featurizeSAEntries` expects.

```js
// type signature
(SA: string) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

<!-- API_DOCS_END -->
