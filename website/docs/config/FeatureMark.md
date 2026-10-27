---
id: featuremark
title: FeatureMark
description: "The canvas feature displays' mark, the box each feature draws as: its height, as the alignments display's pileup.mark.height is each read's."
sidebar_label: Display setting -> FeatureMark
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `features` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/features/src/LinearBasicDisplay/featureMarkConfigSchema.ts).

The canvas feature displays' `mark`, the box each feature draws as: its
`height`, as the alignments display's `pileup.mark.height` is each read's.

## Example usage

```js
{ type: 'LinearBasicDisplay', mark: { height: 6 } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10</code> | The main body's height in px under `displayMode: 'normal'`; compact draws it at 0.6 of this and superCompact at 0.3, on the main thread, so a preset never refetches. |
