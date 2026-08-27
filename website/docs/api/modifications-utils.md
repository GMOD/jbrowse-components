---
id: modifications-utils
title: modifications-utils
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## getMethBins

Bins per-read base modifications and their probabilities onto reference
positions, returning typed arrays for methylated/unmethylated calls. Only
cytosines in `context` are considered (default CpG); plants also use CHG/CHH.

```js
// type signature
({…}: ParsedModData, context?: CytosineContext) => { methBins: number[]; hydroxyMethBins: number[]; methProbs: number[]; hydroxyMethProbs: number[]; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getMethBins.ts)

## getModPositions

Parse MM tag to extract modification positions on the read sequence.

```js
// type signature
(mm: string, fseq: string, fstrand: number) => ModWithPositions[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getModPositions.ts)

## getModProbabilities

Reads the ML tag from a feature and returns per-call modification probabilities
scaled to 0..1.

```js
// type signature
(feature: Feature) => number[] | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getModProbabilities.ts)

## getModProbabilityBytes

The ML tag as its raw 0..255 bytes, without the scaling `getModProbabilities`
applies.

The byte is a LOSSLESS stand-in for the probability — every value on this path
is exactly `(N + 0.5) / 256` — and it is monotonic in it, so anything that only
compares probabilities (picking the most likely call at a position, testing a
threshold) can work in bytes and divide once, at the end, for the few calls that
survive. A caller that needs the numbers themselves still wants
`getModProbabilities`.

```js
// type signature
(feature: Feature) => ArrayLike<number> | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getModProbabilities.ts)

## getModTypes

The modification types an MM tag declares, from its headers alone.

`getModPositions` answers this too, but on the way to placing every call: it
walks the delta list against the read sequence, which is the expensive half and
is only needed to DRAW marks. Anything that just wants to know what is in the
file — which types to offer in a menu, whether a track carries modifications at
all — wants this instead, and pays neither the walk nor the sequence decode that
feeds it.

```js
// type signature
(mm: string) => ModTypeHeader[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getModTypes.ts)

## getTag

Read a single tag by name, using the feature's targeted tag accessor when it has
one (BAM) and the full tags object otherwise (CRAM/synteny).

```js
// type signature
(feature: Feature, tag: string) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getTagAlt.ts)

## getTagAlt

Read a tag by its canonical name, falling back to a lowercase-suffixed alias
(e.g. MM/Mm, ML/Ml) as emitted by some aligners.

Prefers the feature's own one-pass alias lookup when it has one. The plain
`getTag(tag) ?? getTag(alt)` form walks the record's whole tag block TWICE
whenever neither name is present — which is every read in a file without base
modifications, and this is called per read on every render. On jb2bench's
1000x.shortread that pair of walks was 12.9% of the whole BAM query, more than
the CIGAR/SEQ/MD reads the pileup actually uses.

```js
// type signature
(feature: Feature, tag: string, alt: string) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getTagAlt.ts)

## isMethylationFillType

The modification types the methylation walk below paints — 5mC and 5hmC, the
pair that compete for one cytosine.

Stated once because two functions have to agree on it and they are in different
packages: this walk claims those types, and `extractModifications` has to skip
exactly them in the fill view so a cytosine gets one mark rather than two. A
second spelling would either double-paint or, as it did, drop every OTHER type
the read declares.

```js
// type signature
(type: string) => type is "h" | "m"
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getMethBins.ts)

## matchesCytosineContext

Whether the cytosine at read position `pos` sits in the given context.

The pattern is defined on the template (the strand the C is on), read 5'->3'.
For forward reads the stored sequence IS the template, so we read forward from
`pos`. getModPositions works reverse-strand reads in stored-sequence space,
where the template runs backwards and complemented, so we read backwards from
`pos` and complement each base before matching.

**Char codes, not characters, and that is the whole shape of this function.** It
reads `seq[pos]?.toLowerCase()` per probe and lower-cased the pattern character
beside it, which is two string operations per base — and the fill-unmarked
methylation walk asks this question up to twice for every aligned base of every
read (getMethBins), while bisulfite asks it at every candidate cytosine. Folding
case with `& ~0x20` on the code and comparing numbers measured 5.64x on the
predicate alone over 4M probes, byte-identical.

`charCodeAt` past either end of the string is NaN and `NaN & ~0x20` is 0 — an
index no pattern base equals and the complement table holds -1 at — so the walk
runs off the read as a non-match with no bounds test of its own.
`features/modCoverage/readBaseCounts.ts` folds case the same way and says so.

```js
// type signature
(seq: string, pos: number, isReverse: boolean, context: CytosineContext) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/cytosineContext.ts)

## modProbAt

Returns the probability value from the flat ML array for a modification's
position. `idx` is the position's index within the mod's stored `positions`
array; we recover its MM-tag order (reverse-strand reads store positions in
descending order) and step into ML by `probStart + mmOrder * probStride`.
`probStride` is >1 for combined codes (e.g. 'C+mh'), where ML values are
interleaved per position.

```js
// type signature
(probabilities: number[] | undefined, probStart: number, probStride: number, isReverse: boolean, idx: number, posLen: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getModProbabilities.ts)

## parseModHeader

Parses one MM-tag modification header (e.g. `C+m`) into its base, strand, type
string, and modification code.

```js
// type signature
(basemod: string, fullmod: string) => { base: string; strand: string; typestr: string; mod: string; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/consts.ts)
