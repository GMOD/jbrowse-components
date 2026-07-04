---
id: cigar-utils
title: cigar-utils
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

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

Computes the list of mismatches (SNVs, indels, clips, skips) for a read from its
CIGAR, optional MD tag, sequence, reference, and quality.

```js
// type signature
(cigar?: string | undefined, md?: string | undefined, seq?: string | undefined, ref?: string | undefined, qual?: Uint8Array<ArrayBufferLike> | undefined) => Mismatch[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)

## getNextRefPos

Maps read-sequence positions to reference-sequence positions via the CIGAR,
invoking the callback for each. Handles both packed Uint32Array and unpacked
number[] CIGAR formats.

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

Same encoding as `parseCigar2` but writes into a packed `Uint32Array` — matches
the NUMERIC_CIGAR format that BAM/CRAM adapters emit, so consumers can use a
single typed-array code path.

```js
// type signature
(s?: string) => Uint32Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/cigar-utils/src/mismatchParser.ts)
