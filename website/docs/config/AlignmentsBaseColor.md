---
id: alignmentsbasecolor
title: AlignmentsBaseColor
description: "The pileup.bases.encoding.color channel: the per-base variable painted as a cell per base over the reads, whatever encoding.color fills them with. modifications paints the MM/ML calls and bisulfite…"
sidebar_label: Display setting -> AlignmentsBaseColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsBaseColorConfigSchema.ts).

The `pileup.bases.encoding.color` channel: the per-base variable painted
as a cell per base over the reads, whatever `encoding.color` fills them
with. `modifications` paints the MM/ML calls and `bisulfite` the conversion
state against the reference, both through `pileup.bases.filter` and
`unmodified`; `baseQuality` and `base` paint every aligned base. A string is
the field. While a modification field paints, mismatches draw grey, and a
read that no `encoding.color` paints takes a pale strand tint.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: { bases: { show: true, encoding: { color: 'modifications' } } },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (baseQuality, base, modifications, bisulfite) | the per-base variable painted over the reads: modifications, bisulfite, baseQuality or base; unset paints none |
