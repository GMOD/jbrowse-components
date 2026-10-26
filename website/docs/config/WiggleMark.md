---
id: wigglemark
title: WiggleMark
description: "A wiggle display's mark, Vega-Lite's mark object: the type each score draws as, and a line's interpolate. A bare name is the type, so mark: \"rect\" and mark: { type: \"rect\" } are one config."
sidebar_label: Display -> WiggleMark
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleMarkConfigSchema.ts).

A wiggle display's `mark`, Vega-Lite's mark object: the `type` each score
draws as, and a line's `interpolate`. A bare name is the `type`, so
`mark: "rect"` and `mark: { type: "rect" }` are one config.

## Example usage

```json
{ "type": "LinearWiggleDisplay", "mark": { "type": "point" } }
```

```json
{
  "type": "LinearWiggleDisplay",
  "mark": { "type": "line", "interpolate": "linear" }
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-type">**type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (bar, point, line, rect) = <code>'bar'</code> | bar, point, line or rect |
| <span id="slot-interpolate">**interpolate**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (step, linear) = <code>'step'</code> | The path a `line` takes between scores: `step` holds each across its bin, as the data says; `linear` runs from one bin's centre to the next, smoother where the bins are few. Read by a line alone. |
