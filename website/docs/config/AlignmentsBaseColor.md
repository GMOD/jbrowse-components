---
id: alignmentsbasecolor
title: AlignmentsBaseColor
sidebar_label: Display -> AlignmentsBaseColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsBaseColorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', baseColor: 'modifications' }
```

```js
{
  type: 'LinearAlignmentsDisplay',
  color: { field: 'tags.HP' },
  baseColor: { field: 'modifications' },
  modifications: { twoColor: true },
}
```

_See the **Config slots** section below for all available configuration fields._

The alignments displays' `baseColor` setting: the per-base variable painted
as a cell per base over the reads, whatever `color` fills them with.
`modifications` paints the MM/ML calls and `bisulfite` the conversion state
against the reference, both under the display's `modifications` settings;
`baseQuality` and `base` paint every aligned base. A string is the field.
While a modification field paints, mismatches draw grey, and a read with no
`color` of its own takes a pale strand tint.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "AlignmentsBaseColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the per-base variable painted over the reads: modifications, bisulfite, baseQuality or base; empty draws none |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none) | none draws no layer and keeps the field for a switch back |
