---
id: rowcolor
title: RowColor
sidebar_label: Display -> RowColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowColorConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearWiggleDisplay',
  rowColor: { domain: ['tumor', 'normal'], range: ['#b2182b', '#2166ac'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The `rowColor` setting of the row displays: the colour a reader sets on a
row, by the row's name, as `domain`/`range` pairs. The arrangement dialog
writes it, and each display paints it on the channel that carries a row's
identity: the quantitative display's plot, or the tint beside its label
while a score gradient paints; the multi-row feature display's blocks; the
multi-sample variant displays' label tint; the MAF display's label tint,
over the adapter's `samples[].color`. `VariantRowColor` is this plus
`field`.

## Related links

- **Extended by:** [VariantRowColor](../variantrowcolor)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "RowColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the rows given a colour of their own, by name |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | the CSS colour each row in domain takes, in the same order |
