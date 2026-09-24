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
  color: { scale: 'log', scheme: 'viridis', domainMax: 500 },
}
```

_See the **Config slots** section below for all available configuration fields._

The Hi-C display's `color`: a bin's contact count through a `linear` or
`log` scale onto a named `scheme`. An unset `domainMax` follows the loaded
counts, saturating where the display's `useColorPercentile` says; setting it
gives every zoom, and every track that sets the same number, one scale.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "HicColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-scale">**scale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | linear, or log2 of the count, which lifts sparse long-range bins off the floor |
| <span id="slot-scheme">**scheme**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange) = <code>'juicebox'</code> | the named ramp counts run across; juicebox fades from transparent to red |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a linear or log scale's domain; unset follows the loaded values |
