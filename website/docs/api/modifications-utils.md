---
id: modifications-utils
title: modifications-utils
---

Note: this document is automatically generated from exported functions marked
with an `#api` JSDoc tag in our source code. See
[Plugin dependencies and re-exports](/docs/developer_guides/imports_and_reexports)
for how to import these from a plugin.

### getMethBins

Bins per-read base modifications and their probabilities onto reference
positions, returning typed arrays for methylated/unmethylated calls.

```js
// type signature
({ modifications, probabilities, cigarOps, seq, fstrand, flen, }: ParsedModData) => { methBins: number[]; hydroxyMethBins: number[]; methProbs: number[]; hydroxyMethProbs: number[]; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getMethBins.ts)

### getModPositions

Parse MM tag to extract modification positions on the read sequence.

```js
// type signature
(mm: string, fseq: string, fstrand: number) => ModWithPositions[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getModPositions.ts)

### getModProbabilities

Reads the ML tag from a feature and returns per-call modification probabilities
scaled to 0..1.

```js
// type signature
(feature: Feature) => number[] | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getModProbabilities.ts)

### getTagAlt

Read a tag by its canonical name, falling back to a lowercase-suffixed alias
(e.g. MM/Mm, ML/Ml) as emitted by some aligners.

```js
// type signature
(feature: Feature, tag: string, alt: string) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getTagAlt.ts)

### modProbAt

Returns the probability value from the flat probabilities array at the correct
offset for a given modification position, handling the reverse-strand index
reversal that getModPositions applies (positions stored in descending order for
reverse-strand reads).

```js
// type signature
(probabilities: number[] | undefined, probIndex: number, isReverse: boolean, idx: number, posLen: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/getModProbabilities.ts)

### parseModHeader

Parses one MM-tag modification header (e.g. `C+m`) into its base, strand, type
string, and modification code.

```js
// type signature
(basemod: string, fullmod: string) => { base: string; strand: string; typestr: string; mod: string; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/modifications-utils/src/consts.ts)
