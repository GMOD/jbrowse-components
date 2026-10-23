---
id: alignmentssort
title: AlignmentsSort
description: "The alignments displays' sort setting: the pileup's row order, by the field it ranks the reads on."
sidebar_label: Display -> AlignmentsSort
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsSortConfigSchema.ts).

The alignments displays' `sort` setting: the pileup's row order, by the
`field` it ranks the reads on. A whole-window order is a string —
`"position"` (by start, the default), `"length"` (widest first), `"spliced"`
(reads whose CIGAR has a skip first), `"split"` (reads aligned in pieces
first) or `"svSignal"` (the structural-variant evidence first, in tiers:
split reads, then reads with an insertion or deletion of 50 bp or more, then
paired reads the aligner did not call concordant, each with both ends placed
above MAPQ 0, as the `svSignal` filter counts it). A column sort ranks the
reads over one base, `pos` (0-based) on `refName`, by `strand`, `base`,
`mapq` (highest first), `pairOrientation` (the abnormal orientations over
LR), a SAM tag (`tags.HP`, spelt as `encoding.color` and `facet` spell one), or the
`insertion`, `softclip` or `hardclip` there, or up to `within` bases either
side; the reads not over it lay out by position. On another chromosome a
column sort orders by position.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', sort: 'spliced' }
```

```js
{
  type: 'LinearAlignmentsDisplay',
  sort: { field: 'tags.HP', pos: 1999, refName: 'ctgA' },
}
```

## Related links

- **Extended by:** [LGVSyntenySort](../lgvsyntenysort)

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'position'</code> | position, length, spliced, split or svSignal order the whole window; strand, base, mapq, pairOrientation, a tags.XX tag, insertion, softclip or hardclip rank the reads over the column at pos |
| <span id="slot-pos">**pos**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | a column sort's 0-based position |
| <span id="slot-refname">**refName**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | a column sort's reference sequence |
| <span id="slot-within">**within**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | how many bases either side of pos an insertion, softclip or hardclip sort still ranks a mark |
