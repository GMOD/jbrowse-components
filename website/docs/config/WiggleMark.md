---
id: wigglemark
title: WiggleMark
description: "A wiggle display's mark, Vega-Lite's mark object: the type each score draws as. A bare name is the type, so mark: \"span\" and mark: { type: \"span\" } are one config."
sidebar_label: Display -> WiggleMark
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleMarkConfigSchema.ts).

A wiggle display's `mark`, Vega-Lite's mark object: the `type` each score
draws as. A bare name is the `type`, so `mark: "span"` and
`mark: { type: "span" }` are one config.

## Example usage

```json
{ "type": "LinearWiggleDisplay", "mark": { "type": "point" } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-type">**type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (bar, point, line, span) = <code>'bar'</code> | bar, point, line or span |
