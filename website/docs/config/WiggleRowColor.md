---
id: wigglerowcolor
title: WiggleRowColor
sidebar_label: Display -> WiggleRowColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleRowColorConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearWiggleDisplay',
  rowColor: { domain: ['tumor', 'normal'], range: ['#b2182b', '#2166ac'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The quantitative display's `rowColor`: the colour a reader set on a named
subtrack in the arrangement dialog, as `domain`/`range` pairs. It paints the
row's identity where the display paints one per row — its plot, or under a
score gradient the tint beside its label — ahead of the colour the adapter
supplied and the palette a group or an overlaid source is dealt.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "WiggleRowColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the subtracks given a colour of their own, by name |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | the CSS colour each subtrack in domain takes, in the same order |
