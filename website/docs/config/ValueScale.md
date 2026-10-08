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

A GC line plot whose axis spans the loaded values, 30 to 60%:

```js
{
  type: 'LinearWiggleDisplay',
  scales: { y: { zero: false } },
}
```

The whole visible range, spikes included, rather than the fence the wiggle
displays start on:

```js
{
  type: 'LinearWiggleDisplay',
  scales: { y: { domainQuantile: 1 } },
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
wiggle plot, the alignments coverage band and the mark display, the
Manhattan plot among them, each carry one, with the axis guides it draws —
its ticks, its `grid`, its `rules` and its `title`.

Vega-Lite's spelling: a pinned end is `domainMin` or `domainMax`, an end
left unset autoscales over the loaded regions, and `zero` says whether an
autoscaled linear or symlog axis reaches 0 whatever those regions hold.

Two defaults come from the display rather than from the scale.
`domainQuantile` starts at `0.99` on the wiggle plot, fencing a spike, and
at `1`, the extremes, on the coverage band and the mark display. `symlogConstant` starts at `0` on the wiggle family and the mark
display and at `1` on the coverage band.

Every scale carries the same guides: `rules`, reference lines at chosen
values, `grid`, a line at every tick, `minimalTicks`, and `title`, the
caption beside the axis. A rule naming no `color` draws in the one colour
the chrome rules every plot in, so a red line is a claim its author makes
rather than a meaning a display assigns.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-scalesyrulesvalue">**scales.y.rules.value**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Where the rule sits on the axis, in the units the axis plots: a `-log10(p)` over a Manhattan plot, a depth over coverage. |
| <span id="slot-scalesyrulescolor">**scales.y.rules.color**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The line's colour, and its label's. Unset draws every rule in the one colour the chrome rules plots in, so a threshold that means something particular — genome-wide significance, a diploid depth — is one an author paints, on the plot where it means it. |
| <span id="slot-scalesyruleslabel">**scales.y.rules.label**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Free text drawn at the rule's right-hand end. JBrowse assigns it no meaning: "2 copies" over a coverage plot is a claim only the author can make, since no ploidy can be assumed. |
| <span id="slot-scalesytype">**scales.y.type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log, symlog) = <code>'linear'</code> | How the axis reads its domain — the ticks, the cross-hatches and the renderer's placement all come from it. `log` cannot represent 0 or negative values and floors the domain above them; `symlog` is log-like away from zero and linear through it, so a track whose values touch or cross 0 keeps them. |
| <span id="slot-scalesydomainmin">**scales.y.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The bottom of the axis, pinning what would otherwise autoscale to the loaded regions. Unset autoscales that end. The Y axis panel's Min field writes here. |
| <span id="slot-scalesydomainmax">**scales.y.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The top of the axis. Unset autoscales that end. |
| <span id="slot-scalesyzero">**scales.y.zero**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Whether an autoscaled linear or symlog axis reaches 0 whatever the loaded values span, Vega-Lite's `zero`. On, a plot of values between 30 and 60 draws 0 to 60, and a bar always shows its whole height. Off, the axis spans the values alone. A pinned end is unmoved either way, a log axis has no 0, and a density plot, which maps score to colour and has no axis, spans its values whatever this says. The Y axis panel's "Include 0" toggles it. |
| <span id="slot-scalesyautoscalegroup">**scales.y.autoscaleGroup**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | A name shared by the tracks whose axes autoscale together: each unpinned end spans the data of every track in the view naming the same group, so three coverage lanes stay comparable as the view moves. A pinned end stays this track's own. The Y axis panel's "Share axis with" writes it. |
| <span id="slot-scalesysymlogconstant">**scales.y.symlogConstant**</span><br>[`number`](/docs/config_guides/slot_types#number) = per display | Width of symlog's linear region around zero. `0` derives it from the domain, a thousandth of its largest magnitude — right for a wiggle track, whose units are its own. The coverage band starts at `1` instead, which makes symlog exactly `log(depth+1)` and puts the knee at one read.<br>_advanced_ |
| <span id="slot-scalesydomainquantile">**scales.y.domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = per display | Where an unpinned end's outliers are fenced. An end follows the loaded values' extreme; below `1`, an extreme that would stretch the axis past twice the span this quantile of the values draws stops at that fence, and the bars past it wear the red clip strip. So `0.99` leaves a plot with no spike whole and keeps one spike from flattening the rest. Each end's quantile is measured among the values on its side of 0, so a sparse minority tail stays visible, and the span includes 0 where `zero` reaches it. A colour ramp's `domainQuantile` clips at the quantile itself, since a saturated colour hides nothing its key does not say. The Y axis panel's "Clip extreme outliers" toggles it. |
| <span id="slot-scalesygrid">**scales.y.grid**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Rule the plot across at every tick, ggplot2's panel grid and Vega-Lite's `axis.grid`. The Y axis panel's "Grid lines" toggles it. |
| <span id="slot-scalesyminimalticks">**scales.y.minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Label only the two ends of the axis.<br>_advanced_ |
| <span id="slot-scalesytitle">**scales.y.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The caption beside the axis, naming what it measures, drawn once however many bands the scale rules and at every zoom. Optional, as JBrowse's other captions are: unset, `""` or `null`, the axis has none; some text is that text. |
| <span id="slot-scalesyrules">**scales.y.rules**</span><br><code>types.array(valueScaleRuleSchema())</code> | Horizontal reference lines at chosen values, across every band the scale rules: a significance threshold, a zero line, an allele-frequency cut. Each is `{ value, color, label }`, or a bare number for a plain line. An autoscaled end widens to keep every rule on the axis; a pinned `domainMin` or `domainMax` that excludes a rule drops it. |
