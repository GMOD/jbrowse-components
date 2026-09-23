---
id: mafrowcolor
title: MafRowColor
sidebar_label: Display -> MafRowColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafRowColorConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearMafDisplay',
  rowColor: { domain: ['panTro4', 'mm10'], range: ['#4e79a7', '#f28e2b'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The MAF display's `rowColor`: a tint per species row, by row name, as
`domain`/`range` pairs. It tints the row's label and the swatch the sidebar
draws for a row too short for text, over the colour an adapter's `samples`
entry gives; the alignment cells stay coloured by base. The arrangement
dialog's Color column edits it.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MafRowColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the species rows given a tint of their own, by row name |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | the CSS colour each row in domain takes, in the same order |
