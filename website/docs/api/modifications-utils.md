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

```js
// type signature
(feature: Feature, tag: string, alt: string) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getTagAlt.ts)

## matchesCytosineContext

Whether the cytosine at read position `pos` sits in the given context.

The pattern is defined on the template (the strand the C is on), read 5'->3'.
For forward reads the stored sequence IS the template, so we read forward from
`pos`. getModPositions works reverse-strand reads in stored-sequence space,
where the template runs backwards and complemented, so we read backwards from
`pos` and complement each base before matching.

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
