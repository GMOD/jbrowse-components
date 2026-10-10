---
id: alignmentsmodifications
title: AlignmentsModifications
description: "The alignments displays' modifications setting: what the modifications and bisulfite fields of AlignmentsBaseColor draw. The by-type view paints each MM/ML call its…"
sidebar_label: Display -> AlignmentsModifications
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsModificationsConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  baseColor: 'modifications',
  modifications: { unmodified: 'all', cytosineContext: 'CHG' },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  baseColor: 'modifications',
  modifications: { shownModifications: ['a'], threshold: 50 },
}
```

_See the **Config slots** section below for all available configuration fields._

The alignments displays' `modifications` setting: what the `modifications`
and `bisulfite` fields of [AlignmentsBaseColor](../alignmentsbasecolor)
draw. The by-type view paints each MM/ML call its type's color above
`threshold`; `unmodified: 'calls'` paints the unmodified side blue as well,
and `unmodified: 'all'` paints every cytosine in `cytosineContext` whether
the basecaller listed it or not, which is the methylation view.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-threshold">**threshold**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10</code> | hide a call whose probability is under this percent in the by-type view; the two-color view cuts at 50 and the methylation fill paints every cytosine |
| <span id="slot-unmodified">**unmodified**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (hidden, calls, all) = <code>'hidden'</code> | which unmodified sites paint blue: 'hidden' none, 'calls' the calls more likely unmodified, under modifications and bisulfite alike, and 'all' every cytosine in the context as well, the ones the basecaller left implicit included; 'all' is the methylation view |
| <span id="slot-cytosinecontext">**cytosineContext**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'CG'</code> | which cytosines the methylation fill and bisulfite paint: CG, CHG, CHH or all |
| <span id="slot-shownmodifications">**shownModifications**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the modification type codes drawn (m, h, a, ...); empty draws every type the reads carry |
