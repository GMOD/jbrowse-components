---
id: markdef
title: MarkDef
description: "A marks entry's mark, Vega-Lite's mark object: the type it draws as, and a line's interpolate. A bare name is the type, so mark: \"line\" and mark: { type: \"line\" } are one mark."
sidebar_label: Display -> MarkDef
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markDefConfigSchema.ts).

A `marks` entry's `mark`, Vega-Lite's mark object: the `type` it draws as,
and a line's `interpolate`. A bare name is the `type`, so `mark: "line"`
and `mark: { type: "line" }` are one mark.

## Example usage

```js
{
  mark: { type: 'line', interpolate: 'linear' },
  encoding: { y: 'score' },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-type">**type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (bar, point, rule, line, span, text, link) = <code>'bar'</code> | `bar` spans from `origin` to `y`; `point` is a shape at `y` over the middle of `x` to `x2`; `rule` is a line across `x` to `x2` at `y`, `encoding.size` px thick; `line` is a stroke through consecutive values, held across each span or run centre to centre as `interpolate` says, dropping to `origin` across a gap; `span` is a band across the whole plot from `x` to `x2`; `text` prints a field over the middle of `x` to `x2`, just above `y` where it names one, at the apex of a link drawn between the same two ends, and in the middle of its band otherwise, and the display omits a label that would overlap one already placed to its left; `link` is a curve from `x` up and over to `x2`, which may lie on another sequence, its apex at `y` where it names one. |
| <span id="slot-interpolate">**interpolate**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (step, linear) = <code>'step'</code> | The path a `line` takes between values: `step` holds each across its span, as the data says; `linear` runs from one span's centre to the next, smoother where the spans are few. Read by a line alone. |
