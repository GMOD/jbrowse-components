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
counts, saturating at their `numQuantile` percentile under `autoscale:
'localpercentile'` and at their maximum under `local`; setting it gives
every zoom, and every track that sets the same number, one scale.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "HicColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-scale">**scale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | linear, or log2 of the count, which lifts sparse long-range bins off the floor |
| <span id="slot-scheme">**scheme**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange) = <code>'juicebox'</code> | the named ramp counts run across; juicebox fades from transparent to red |
| <span id="slot-reverse">**reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | Unset turns round a scheme dark at its low end, since an unpainted bin is the page behind the matrix. |
| <span id="slot-autoscale">**autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (local, localpercentile) = <code>'localpercentile'</code> | What an unset `domainMax` follows: `localpercentile` the loaded counts' `numQuantile` percentile, so faint off-diagonal contacts read, or `local` their maximum. The track menu's "Emphasize faint contacts" toggles it. The same word every colour ramp and `scales.y` take. |
| <span id="slot-numquantile">**numQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.95</code> | The percentile `localpercentile` saturates at.<br>_advanced_ |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a linear or log scale's domain; unset follows the loaded values |
