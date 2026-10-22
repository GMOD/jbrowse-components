---
id: hiccolor
title: HicColor
description: "The Hi-C display's color: a bin's observed contact count, or its observed/expected ratio, through a linear, symlog or log scale onto a named scheme."
sidebar_label: Display -> HicColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/hicColorConfigSchema.ts).

The Hi-C display's `color`: a bin's `observed` contact count, or its
`observed/expected` ratio, through a `linear`, `symlog` or `log` scale onto
a named `scheme`.

- `observed`: an unset `domainMax` follows the loaded counts, saturating at
  their `domainQuantile`, the 95th percentile by default, or at their
  maximum at a quantile of 1. Setting it gives every zoom, and every track
  that sets the same number, one scale.
- `observed/expected`: each count over the file's expected count at that
  distance, the view Juicebox calls O/E, which shows compartments and loops
  under the decay of contact with distance. It diverges around 1 from a
  quarter to fourfold, and where the file has no expected values at the
  binsize, the display paints the counts and the key says so.

The slots are the shared color object's, so `jbrowse validate` and "Edit
plot..." judge them as they judge any other display's.

## Example usage

```js
{
  type: 'LinearHicDisplay',
  color: { scale: 'symlog', scheme: 'viridis', domainMax: 500 },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (observed, observed/expected) = <code>'observed'</code> | observed, each bin's contact count, or observed/expected, that count over the file's expected count at its distance |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | the named ramp the field runs across; unset is the field's own, juicebox for count, which fades from transparent to red |
| <span id="slot-reverse">**reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | Unset turns round a scheme dark at its low end, since an unpainted bin is the page behind the matrix. |
| <span id="slot-domainmid">**domainMid**</span><br><code>colorRampSlots.domainMid</code> | The value the ramp's middle stop sits at, so a diverging scheme centres on it and equal distances from it take equal colors; unset, the stops spread evenly across the domain. |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of the scale; unset is 0 |
| <span id="slot-domainquantile">**domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.95</code> | The value an unset `domainMax` follows: the loaded counts' quantile, `0.95` so faint off-diagonal contacts read, or at `1` their maximum. The track menu's "Emphasize faint contacts" toggles it. Every color ramp reads the word this way; `scales.y` reads it as an outlier fence. |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (linear, symlog, log) | linear; symlog, d3's log(1 + count), which the Log scale toggle writes: it lifts sparse long-range bins off the floor and leaves only 0 transparent; or log, log2 of the count from a pinned domainMin or else 1, every bin at or below which draws transparent. Unset is linear |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of the scale's domain; unset follows the loaded counts |
