---
id: marksize
title: MarkSize
sidebar_label: Display -> MarkSize
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markSizeConfigSchema.ts).

## Example usage

```js
{
  mark: 'link',
  encoding: { size: { field: 'score', scale: 'log', range: [1, 8] } },
}
```

_See the **Config slots** section below for all available configuration fields._

A link mark's stroke width as a channel: a feature field read through a
linear or log scale into a px range, so a score becomes a width the way a
ramp makes it a colour. Writing a field name directly on the encoding lands
in `field`, on a linear scale over the default range.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MarkSize", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field the width reads, or a jexl expression over `feature`. Empty draws every instance at the mark's own `size`. |
| <span id="slot-scale">**scale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | How the value becomes a width: `linear` or `log` between `domainMin` and `domainMax`. |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value the thinnest width stands at; unset, the loaded regions' own least. |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value the widest width stands at; unset, the loaded regions' own greatest. |
| <span id="slot-range">**range**</span><br>`stringArray` = <code>[]</code> | The px at each end of the domain, thinnest first. Empty is 1 to 6. |
