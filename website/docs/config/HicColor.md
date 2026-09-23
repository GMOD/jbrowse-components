---
id: hiccolor
title: HicColor
sidebar_label: Display -> HicColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/hicColorConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearHicDisplay',
  color: { scale: 'log', scheme: 'viridis' },
}
```

_See the **Config slots** section below for all available configuration fields._

The Hi-C display's `color`: how a bin's contact count becomes a colour. The
count runs through a `linear` or `log` scale onto a named `scheme`, whose
top is where the display's `useColorPercentile` saturates it.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "HicColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-scale">**scale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | `log` places a count on the ramp by its log2, which lifts a sparse file's decayed long-range bins off the floor and turns a dense file's matrix solid. |
| <span id="slot-scheme">**scheme**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (viridis, juicebox, fall, reds, blues) = <code>'juicebox'</code> | The named ramp counts run across; `juicebox` fades from transparent to red. |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Runs the ramp from its last colour, so the scheme's end paints the fewest contacts. |
