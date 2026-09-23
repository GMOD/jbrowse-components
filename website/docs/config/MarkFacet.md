---
id: markfacet
title: MarkFacet
sidebar_label: Display -> MarkFacet
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markFacetConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearMarkDisplay',
  facet: { field: 'HP', transform: [{ type: 'pileup' }] },
  marks: [{ shape: 'span' }],
}
```

_See the **Config slots** section below for all available configuration fields._

The mark display's `facet`: one labelled section of the track per value of
a field, as the feature and alignments displays' facet is, and the steps the
facet runs over each section's features alone, after the display's
`transform` and before every mark's own. A `pileup` here packs each section
on its own rows, which every mark then stands in. A string is the field.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MarkFacet", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field each value of which packs its own labelled section: a field name, a dotted path into a structured field (`INFO.SVTYPE`), a `jexl:` expression, or `strand`. A feature with no value stacks last. Writing `facet: "HP"` lands here. |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | The values whose sections stack first, in order; the rest follow sorted. |
| <span id="slot-transform">**transform**</span><br>[MarkTransform](../marktransform) | Steps over each section's features alone, after the display's `transform` and before any mark's own: a `pileup` here packs each section on its own rows, and every mark stands in them. |
