---
id: sashimilabels
title: SashimiLabels
description: "The sashimi band's labels layer: each junction's supporting-read count, drawn at its arc's apex."
sidebar_label: Display -> SashimiLabels
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/sashimiLabelsConfigSchema.ts).

The sashimi band's `labels` layer: each junction's supporting-read count,
drawn at its arc's apex.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', sashimi: { labels: { show: true } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the supporting-read count on each arc |
