---
id: valuescale
title: ValueScale
sidebar_label: Display -> ValueScale
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/valueScaleConfigSchema.ts).

## Example usage

A log axis floored at 1:

```js
{
  type: 'LinearWiggleDisplay',
  scales: { y: { type: 'log', domainMin: 1 } },
}
```

The whole visible range, rather than the 99th percentile the wiggle
displays start on:

```js
{
  type: 'LinearWiggleDisplay',
  scales: { y: { autoscale: 'local' } },
}
```

Three samples' coverage on one axis that still follows the data, each
track's display naming the same group:

```js
{
  type: 'LinearAlignmentsDisplay',
  scales: { y: { autoscaleGroup: 'depth' } },
}
```

A titled axis with a labelled genome-wide threshold over a plain
suggestive one:

```js
{
  type: 'LinearMarkDisplay',
  scales: {
    y: {
      title: '-log10 p',
      rules: [{ value: 7.3, color: 'red', label: 'p = 5e-8' }, 5],
    },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

The value scale of a quantitative display, written as `scales.y`: the
wiggle and multi-wiggle plots, the Manhattan plot, the alignments coverage
band and the mark display each carry one. Which members it has follows what
the display draws: Manhattan places a linear axis and consults no autoscale
mode, so it has neither `type` alternatives nor `autoscale`.

Vega-Lite's spelling: a pinned end is `domainMin` or `domainMax`, and an end
left unset autoscales over the loaded regions.

Two defaults come from the display rather than from the scale. `autoscale`
starts at `localpercentile` on the wiggle and multi-wiggle plots and at
`local` on the coverage band and the mark display. `symlogConstant` starts
at `0` on the wiggle family and at `1` on the coverage band.

The wiggle family, the Manhattan plot and the mark display also carry
`rules`, reference lines at chosen values; the mark display adds `title`,
the caption beside the axis. A rule naming no `color` draws in the one
colour the chrome rules every plot in, so a red line is a claim its author
makes rather than a meaning a display assigns.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "ValueScale", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-scalesyrulesvalue">**scales.y.rules.value**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Where the rule sits on the axis, in the units the axis plots: a `-log10(p)` over a Manhattan plot, a depth over coverage. |
| <span id="slot-scalesyrulescolor">**scales.y.rules.color**</span><br>`maybeColor` | The line's colour, and its label's. Unset draws every rule in the one colour the chrome rules plots in, so a threshold that means something particular — genome-wide significance, a diploid depth — is one an author paints, on the plot where it means it. |
| <span id="slot-scalesyruleslabel">**scales.y.rules.label**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Free text drawn at the rule's right-hand end. JBrowse assigns it no meaning: "2 copies" over a coverage plot is a claim only the author can make, since no ploidy can be assumed. |
| <span id="slot-scalesytype">**scales.y.type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'linear'</code> | How the axis reads its domain — the ticks, the cross-hatches and the renderer's placement all come from it. `log` cannot represent 0 or negative values and floors the domain above them; `symlog` is log-like away from zero and linear through it, so a track whose values touch or cross 0 keeps them. Which of the three a display offers is which of them its renderer places. |
| <span id="slot-scalesydomainmin">**scales.y.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The bottom of the axis, pinning what would otherwise autoscale to the loaded regions. Unset autoscales that end. The score menu's "Set min/max" writes here. |
| <span id="slot-scalesydomainmax">**scales.y.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The top of the axis. Unset autoscales that end. |
| <span id="slot-scalesyautoscalegroup">**scales.y.autoscaleGroup**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | A name shared by the tracks whose axes autoscale together: each unpinned end spans the data of every track in the view naming the same group, so three coverage lanes stay comparable as the view moves. A pinned end stays this track's own. The score menu's "Autoscale with other tracks" writes it. |
| <span id="slot-scalesysymlogconstant">**scales.y.symlogConstant**</span><br>[`number`](/docs/config_guides/slot_types#number) = per display | Width of symlog's linear region around zero. `0` derives it from the domain, a thousandth of its largest magnitude — right for a wiggle track, whose units are its own. The coverage band starts at `1` instead, which makes symlog exactly `log(depth+1)` and puts the knee at one read.<br>_advanced_ |
| <span id="slot-scalesyautoscale">**scales.y.autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = per display | What an unpinned end scales to: `local` takes the extremes of the visible region, `localsd` the mean ± `numStdDev` standard deviations, `localpercentile` the `numQuantile`-th percentile of each sign, which is robust to a peaky distribution. |
| <span id="slot-scalesynumstddev">**scales.y.numStdDev**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | Standard deviations either side of the mean the `localsd` autoscale reaches.<br>_advanced_ |
| <span id="slot-scalesynumquantile">**scales.y.numQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.99</code> | The percentile `localpercentile` clips outliers at — 0.99 drops the outermost 1% of each sign. The two signs are measured independently and anchored at 0, so a sparse minority tail stays visible and all-positive data pins its bottom at 0.<br>_advanced_ |
| <span id="slot-scalesytitle">**scales.y.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The caption beside the axis, naming what it measures, drawn once however many bands the scale rules and at every zoom. Optional, as JBrowse's other captions are: unset, `""` or `null`, the axis has none; some text is that text. |
| <span id="slot-scalesyrules">**scales.y.rules**</span><br><code>types.array(valueScaleRuleSchema())</code> | Horizontal reference lines at chosen values, across every band the scale rules: a significance threshold, a zero line, an allele-frequency cut. Each is `{ value, color, label }`, or a bare number for a plain line. An autoscaled end widens to keep every rule on the axis; a pinned `domainMin` or `domainMax` that excludes a rule drops it. |
