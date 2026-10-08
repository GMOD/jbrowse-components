---
id: samplerows
title: SampleRows
description: "The rows of a display whose rows are the file's samples, one each, with nothing else a row could be: the multi-sample variant display and the multiple alignment display. sample is the one field,…"
sidebar_label: Display -> SampleRows
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/sampleRowsConfigSchema.ts).

## Example usage

```js
{ type: 'LinearMultiSampleVariantDisplay', rows: { domain: ['HG002', 'HG003'] } }
```

```js
{
  type: 'LinearMafDisplay',
  rows: { domain: ['mm10'], labels: { mm10: 'Mouse' }, kept: ['mm10', 'hg38'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The `rows` of a display whose rows are the file's samples, one each, with
nothing else a row could be: the multi-sample variant display and the
multiple alignment display. `sample` is the one field, so the object is
the arrangement a reader gives the rows, written whole as every display's
`rows` is; `rows: "sample"` names the field and arranges nothing.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (sample) = <code>'sample'</code> | `sample`, the one field a row of these displays can be: a sample or a haplotype of one on the variant display, a genome on the alignment. |
