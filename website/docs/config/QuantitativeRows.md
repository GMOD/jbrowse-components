---
id: quantitativerows
title: QuantitativeRows
description: "A quantitative display's rows: source is the one field a quantitative row can be, since a wiggle carries a score per base and a subtrack name and nothing else to put on rows. The arrangement…"
sidebar_label: Display -> QuantitativeRows
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/quantitativeRowsConfigSchema.ts).

## Example usage

```js
{ type: 'LinearWiggleDisplay', rows: 'source' }
```

```js
{
  type: 'LinearWiggleDisplay',
  rows: { field: 'source', domain: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
}
```

_See the **Config slots** section below for all available configuration fields._

A quantitative display's `rows`: `source` is the one field a quantitative row
can be, since a wiggle carries a score per base and a subtrack name and
nothing else to put on rows. The arrangement members are the shared `Rows`
object's.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) ("", source) = <code>''</code> | `source` for one row per subtrack, or empty for one plot every source shares. Writing `rows: "source"` lands here. |
