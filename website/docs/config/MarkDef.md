---
id: markdef
title: MarkDef
description: "A marks entry's mark, Vega-Lite's mark object: the type it draws as, and the members one type alone reads, a line's or a link's interpolate, a span's height and a line's gapBp."
sidebar_label: Display -> MarkDef
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markDefConfigSchema.ts).

A `marks` entry's `mark`, Vega-Lite's mark object: the `type` it draws as,
and the members one type alone reads, a line's or a link's `interpolate`,
a span's `height` and a line's `gapBp`. A bare name is the `type`, so
`mark: "line"` and `mark: { type: "line" }` are one mark.

## Example usage

```js
{
  mark: { type: 'line', interpolate: 'linear' },
  encoding: { y: 'score' },
}
```

```js
{ mark: { type: 'span', height: { band: 0.8 } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-heightband">**height.band**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | The fraction of its band a span fills, centred in the band, so below 1 the rows stand apart. Read by a span alone; the track menu's Row height presets write every span's. |
| <span id="slot-type">**type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (bar, point, rule, line, span, text, link) = <code>'bar'</code> | `bar` spans from `origin` to `y`; `point` is a shape at `y` over the middle of `x` to `x2`; `rule` is a line across `x` to `x2` at `y`, `encoding.strokeWidth` px thick; `line` is a stroke through consecutive values, held across each span or run centre to centre as `interpolate` says, dropping to `origin` across a gap; `span` is a band across the whole plot from `x` to `x2`; `text` prints a field over the middle of `x` to `x2`, just above `y` where it names one, at the apex of a link drawn between the same two ends, and in the middle of its band otherwise, and the display omits a label that would overlap one already placed to its left; `link` is a curve from `x` up and over to `x2`, which may lie on another sequence, its apex at `y` where it names one. |
| <span id="slot-interpolate">**interpolate**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (step, linear, dome, arc) | The path a `line` or a `link` takes between its ends. A line takes `step`, holding each value across its span as the data says, or `linear`, running from one span's centre to the next, smoother where the spans are few; unset is `step`. A link takes `dome`, a half-ellipse whose apex is the pair's half-width clamped to the band, `arc`, a true semicircle that may leave it, or `linear`, a straight segment between the feet, on the baseline or at the `y` value; unset is `dome`. A dome or arc wider than three view widths becomes a circle whose legs rise from each foot. |
| <span id="slot-height">**height**</span><br>[MarkHeight sub-schema](#slot-heightband) | The height a `span` draws at, as a fraction of its band: `{ band: 0.8 }`, Vega-Lite's spelling. |
| <span id="slot-gapbp">**gapBp**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The stretch in bp a `linear` line breaks across rather than bridge: where the next value's middle lies further on than this. Unset, a `window` step in front sets it to the bases its frame spans at the median row, so a moving average breaks where no data reached, and with none the line runs unbroken. Read by a line alone. |
