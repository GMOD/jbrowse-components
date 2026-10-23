---
id: yscale
title: YScale
description: "A YChannel's scale: its type, its pinned ends, the outlier fence an unpinned end follows, and the group it autoscales with. An end left unset autoscales over the loaded regions."
sidebar_label: Display -> YScale
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/yScaleConfigSchema.ts).

A [YChannel](../ychannel)'s `scale`: its type, its pinned ends, the outlier
fence an unpinned end follows, and the group it autoscales with. An end
left unset autoscales over the loaded regions.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  coverage: { encoding: { y: { scale: { type: 'symlog', domainMax: 100 } } } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-type">**type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log, symlog) = <code>'linear'</code> | The axis's scale type, which sets the ticks, the cross-hatches and the renderer's placement. `log` cannot represent 0 or negative values and floors the domain above them; `symlog` is log-like away from zero and linear through it. |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The bottom of the axis. Unset autoscales that end to the loaded regions. The axis panel's Min field writes here. |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The top of the axis. Unset autoscales that end. |
| <span id="slot-zero">**zero**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Whether an autoscaled linear or symlog axis reaches 0 whatever the loaded values span, Vega-Lite's `zero`. A pinned end is unmoved either way, and a log axis has no 0. The axis panel's "Include 0" toggles it. |
| <span id="slot-fencequantile">**fenceQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = per display | The fence for an unpinned end's outliers. Below `1`, an extreme that would stretch the axis past twice the span this quantile of the values draws stops at that fence, and the bars past it show the red clip strip. Each end's quantile is measured among the values on its side of 0. A color ramp's `domainQuantile` clips at the quantile itself instead. The axis panel's "Clip extreme outliers" toggles it. |
| <span id="slot-constant">**constant**</span><br>[`number`](/docs/config_guides/slot_types#number) = per display | Width of symlog's linear region around zero. `0` derives it from the domain, a thousandth of its largest magnitude; `1` makes symlog exactly `log(value+1)`.<br>_advanced_ |
| <span id="slot-group">**group**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | A name shared by the tracks whose axes autoscale together: each unpinned end spans the data of every track in the view naming the same group. A pinned end stays this track's own. The axis panel's "Share axis with" writes it. |
