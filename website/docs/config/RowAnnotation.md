---
id: rowannotation
title: RowAnnotation
description: "One entry of rows.annotations: a color column beside the row labels, the row attribute field through a categorical scale as rows.color deals one, with a key of its own titled legend.title."
sidebar_label: Display setting -> RowAnnotation
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowAnnotationConfigSchema.ts).

One entry of `rows.annotations`: a color column beside the row labels, the
row attribute `field` through a categorical `scale` as `rows.color` deals
one, with a key of its own titled `legend.title`. A string is the field.
An entry naming no field, or `name`, which the label already shows, is
refused.

## Example usage

```js
{ type: 'LinearVariantDisplay', rows: { annotations: ['population', 'sex'] } }
```

```js
{
  type: 'LinearVariantDisplay',
  rows: {
    annotations: [
      {
        field: 'sex',
        scale: { domain: ['female', 'male'], range: ['#d95f02', '#1b9e77'] },
        legend: { title: 'Sex (reported)' },
      },
    ],
  },
}
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The row attribute whose values take the column's colors: a column of a multi-sample adapter's `samplesTsvLocation`, such as `population`, or a subtrack's `group`. |
| <span id="slot-scale">**scale**</span><br>[RowAnnotationScale sub-schema](#slot-scaledomain) | Which color each value of the field takes: `domain` paired with `range`, the rest dealt from the column's own palette. |
| <span id="slot-scaledomain">**scale.domain**</span><br><code>"the field's values that get a color, in order"</code> | The field's values that get a color, in order. |
| <span id="slot-scalerange">**scale.range**</span><br><code>RANGE</code> | The CSS color each value in `domain` takes, in the same order; past them, the column's palette. |
| <span id="slot-scaleunknown">**scale.unknown**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>'a color: every row the scale leaves out takes it. Unset: each…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'a color: every row the scale leaves out takes it. Unset: each value deals the next color of the column\'s palette; "" leaves the rows domain does not list without a color'</code></pre></dialog></span> | The color every row the scale leaves out takes; `''` for none. |
| <span id="slot-legend">**legend**</span><br>[RowAnnotationLegend sub-schema](#slot-legendtitle) | The column's key. |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The title of the column's key and the label over its column; unset, the field capitalised. |
