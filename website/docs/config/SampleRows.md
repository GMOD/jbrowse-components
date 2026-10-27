---
id: samplerows
title: SampleRows
description: "The rows of a display whose rows are the file's samples, one each, with nothing else a row could be: the multi-sample variant display and the multiple alignment display. sample is the one field, so…"
sidebar_label: Display setting -> SampleRows
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/sampleRowsConfigSchema.ts).

The `rows` of a display whose rows are the file's samples, one each, with
nothing else a row could be: the multi-sample variant display and the
multiple alignment display. `sample` is the one field, so the object is
the arrangement a reader gives the rows, written whole as every display's
`rows` is. Nothing needs `rows: "sample"`, and writing it clears the
arrangement.

## Example usage

```js
{ type: 'LinearMultiSampleVariantDisplay', rows: { sort: ['HG002', 'HG003'] } }
```

```js
{
  type: 'LinearMafDisplay',
  rows: { sort: ['mm10'], labels: { mm10: 'Mouse' }, kept: ['mm10', 'hg38'] },
}
```

## Related links

- **Base config:** [Rows](../rows)

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (sample) = <code>'sample'</code> | `sample`, the one field a row of these displays can be: a sample or a haplotype of one on the variant display, a genome on the alignment. |
| <span class="slot-group">Inherited from [RowArrangement](../rowarrangement)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The row order, as Vega-Lite's `sort` lists it: the rows listed lead, in this order, and none is dropped. The rest keep the order their source lists them in (a VCF's samples, a multi-BigWig's subtracks), or sort, digits by magnitude, where the rows are values found on features. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn beside a row in place of its name, by name. |
| <span id="slot-tree">**tree**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The dendrogram beside the rows, as newick. A clustering run writes it beside the order it produced, and a reorder that moves a row drops it. |
| <span id="slot-treeprovenance">**treeProvenance**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | The locus and settings `tree` was computed from; unset for a tree that arrived as data. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. Empty shows every row, and so does naming no current row where the track lists its rows. |
