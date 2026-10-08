---
id: ldcolor
title: LDColor
description: "The LD display's color: which statistic the cells are, r2 or dprime, through a linear scale onto a named scheme. An unset scheme is the metric's own, reds for r² and blues for D'. The…"
sidebar_label: Display -> LDColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/ldColorConfigSchema.ts).

## Example usage

```js
{
  type: 'LDTrackDisplay',
  color: { field: 'dprime', scheme: 'viridis', domainMin: 0.2 },
}
```

_See the **Config slots** section below for all available configuration fields._

The LD display's `color`: which statistic the cells are, `r2` or `dprime`,
through a linear scale onto a named `scheme`. An unset `scheme` is the
metric's own, reds for r² and blues for D'. The domain is the statistic's
0 to 1 rather than the loaded values', so one r² paints one colour on every
track; `domainMin` and `domainMax` narrow it. The slots are the shared
colour object's, so `jbrowse validate` and "Edit plot..." judge them as they
judge any other display's.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (r2, dprime) = <code>'r2'</code> | Which of the file's columns the cells are: `r2` (R², the R2/PHASED_R2 column) or `dprime` (D', the DP/ABS_DPRIME one). A file that carries only one of the two serves that one whichever is asked for, and the legend and the menu say which. |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue) | the named ramp the statistic runs across; unset is the field's own, reds for r2 and blues for dprime |
| <span id="slot-reverse">**reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | Unset turns round a scheme dark at its low end, since an unpainted cell is the page behind the matrix. |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the bottom colour paints, everything below it too; unset is 0 |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the top colour paints, everything above it too; unset is 1 |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (linear) | linear, the one scale; unset is linear |
