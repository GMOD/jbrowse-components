---
id: featurefilter
title: FeatureFilter
description: "The tests a feature display applies to the records it fetched, its filter slot. A display adding tests of its own extends this schema."
sidebar_label: Display -> FeatureFilter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/featureFilterConfigSchema.ts).

## Example usage

```js
{ type: 'LinearBasicDisplay', filter: ["jexl:feature.score > 100"] }
```

The tests a feature display applies to the records it fetched, its `filter`
slot. A display adding tests of its own extends this schema. A list is
shorthand for `{ expressions: [...] }`, and a settings bag names the members
one by one.

Only a display whose model reads it declares it: the canvas base display
(and so `LinearVariantDisplay`) and the mark display take it as it is,
`LinearBasicDisplay` and the multi-sample variant display extend it. It sat
on `baseLinearDisplayConfigSchema` until the six other displays inheriting
it there turned out to read nothing, so a filter in an alignments, synteny,
MAF, multi-row-feature or LD track config validated, loaded and filtered
nothing.

## Related links

- **Extended by:** [BasicFeatureFilter](../basicfeaturefilter)
- **Extended by:** [VariantFilter](../variantfilter)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-expressions">**expressions**</span><br>[`expressionArray`](/docs/config_guides/slot_types#expressionarray) = <code>[]</code> | The features the display admits: a feature is drawn when every expression holds. Each entry is a `jexl:` expression over `feature`. The "Filter by..." dialog and "Edit plot..." edit this list, and "Clear all filters" returns it to what the track's config declares. |
