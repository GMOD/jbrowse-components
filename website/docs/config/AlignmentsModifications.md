---
id: alignmentsmodifications
title: AlignmentsModifications
description: "The alignments displays' modifications setting configures the modifications and bisulfite fields of AlignmentsBaseColor: unmodified: 'calls' paints the unmodified side blue as well, and unmodified:…"
sidebar_label: Display -> AlignmentsModifications
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsModificationsConfigSchema.ts).

The alignments displays' `modifications` setting configures the
`modifications` and `bisulfite` fields of
[AlignmentsBaseColor](../alignmentsbasecolor): `unmodified: 'calls'` paints
the unmodified side blue as well, and `unmodified: 'all'` paints every
cytosine in the `pileup.bases.filter` context whether the basecaller listed
it or not, which is the methylation view. Which calls draw is
`pileup.bases.filter`'s.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: {
    bases: {
      show: true,
      encoding: { color: 'modifications' },
      filter: [{ field: 'context', oneOf: ['CHG'] }],
    },
  },
  modifications: { unmodified: 'all' },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-unmodified">**unmodified**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (hidden, calls, all) = <code>'hidden'</code> | unmodified sites painted blue: 'hidden' none, 'calls' the calls more likely unmodified, under modifications and bisulfite alike, and 'all' every cytosine in the context as well, the ones the basecaller left implicit included; 'all' is the methylation view |
