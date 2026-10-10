---
id: alignmentssort
title: AlignmentsSort
description: "The alignments displays' sort setting: the pileup's row order. A whole-window order is a string — \"position\" (by start, the default), \"length\" (widest first), \"spliced\" (reads whose CIGAR…"
sidebar_label: Display -> AlignmentsSort
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsSortConfigSchema.ts).

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', sort: 'spliced' }
```

```js
{
  type: 'LinearAlignmentsDisplay',
  sort: { type: 'tag', tag: 'HP', pos: 1999, refName: 'ctgA' },
}
```

_See the **Config slots** section below for all available configuration fields._

The alignments displays' `sort` setting: the pileup's row order. A
whole-window order is a string — `"position"` (by start, the default),
`"length"` (widest first), `"spliced"` (reads whose CIGAR carries a skip
first) or `"split"` (reads aligned in pieces, or carrying a deletion of 50 bp
or more, first). A column sort ranks the reads over one base, `pos` (0-based)
on `refName`, by `strand`, `basePair`, `tag` (naming `tag`), or the
`insertion`, `softclip` or `hardclip` there; the reads not over it lay out by
position. On another chromosome a column sort orders by position.

## Related links

- **Extended by:** [LGVSyntenySort](../lgvsyntenysort)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-type">**type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'position'</code> | position, length, spliced or split order the whole window; strand, basePair, tag, insertion, softclip or hardclip rank the reads over the column at pos |
| <span id="slot-pos">**pos**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | a column sort's 0-based position |
| <span id="slot-refname">**refName**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | a column sort's reference sequence |
| <span id="slot-tag">**tag**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | the SAM tag a tag sort ranks by |
