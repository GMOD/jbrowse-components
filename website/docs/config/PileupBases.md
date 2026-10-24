---
id: pileupbases
title: PileupBases
description: "The pileup's bases layer, a cell per base over the reads: show turns it on and encoding.color names what it paints. It draws while show is on and a field is named."
sidebar_label: Display -> PileupBases
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupBasesConfigSchema.ts).

The pileup's `bases` layer, a cell per base over the reads: `show` turns it
on and `encoding.color` names what it paints. It draws while `show` is on
and a field is named. Its `filter` picks the modification calls the
`modifications` and `bisulfite` fields paint, and `unmodified` adds the
unmodified side in blue.

Under those two fields the layer also stacks modification bars in the
coverage band, from the calls its cells paint, so both bands agree. A
coverage-only methylation track hides the pileup and keeps the layer on,
as the last example does.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: { bases: { show: true, encoding: { color: 'baseQuality' } } },
  encoding: { color: 'tags.HP' },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: {
    bases: {
      show: true,
      encoding: { color: 'modifications' },
      filter: [
        { field: 'probability', gte: 0.5 },
        { field: 'code', oneOf: ['a'] },
      ],
    },
  },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: {
    bases: {
      show: true,
      encoding: { color: 'modifications' },
      filter: [{ field: 'context', oneOf: ['CHG'] }],
      unmodified: { show: true },
    },
  },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: {
    show: false,
    bases: { show: true, encoding: { color: 'modifications' } },
  },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the per-base layer over the reads, and its modification bars in the coverage band |
| <span id="slot-encoding">**encoding**</span><br>[PileupBasesEncoding sub-schema](#slot-encodingcolor) | The layer's channels: `encoding.color`, the per-base variable. |
| <span id="slot-encodingcolor">**encoding.color**</span><br>[AlignmentsBaseColor](../alignmentsbasecolor) | The per-base variable the layer paints. |
| <span id="slot-filter">**filter**</span><br><code>fieldPredicateList()</code> | The modification calls drawn, by `probability` (0 to 1), `context` (`CG`, `CHG` or `CHH`) and `code` (`m`, `h`, `a`, ...). Unwritten, a field keeps its default: `probability` at least 0.1, which only the by-type view applies, `context` CG, which the methylation fill and bisulfite read, and every code. An entry naming a field with no test, `{ field: 'context' }`, drops that field's default. |
| <span id="slot-unmodified">**unmodified**</span><br>[PileupBasesUnmodified](../pileupbasesunmodified) | The unmodified side, in blue, under the `modifications` and `bisulfite` fields: the methylation view. |
