---
id: basicfeaturefilter
title: BasicFeatureFilter
description: "The tests LinearBasicDisplay applies to the features it fetched, its filter: the jexl expressions every display's feature filter takes, and the gene-like features as a category."
sidebar_label: Display -> BasicFeatureFilter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/basicFeatureFilterConfigSchema.ts).

## Example usage

```js
{ type: 'LinearBasicDisplay', filter: { genes: 'only' } }
```

The tests `LinearBasicDisplay` applies to the features it fetched, its
`filter`: the jexl `expressions` every display's feature filter takes, and
the gene-like features as a category.

## Related links

- **Base config:** [FeatureFilter](../featurefilter)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-genes">**genes**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: the gene-like top-level features, which are every gene, transcript and RNA type, the `transcriptTypes` and `containerTypes`, and a top-level CDS. "Filter by... → Genes" sets it. |
| <span class="slot-group">Inherited from [FeatureFilter](../featurefilter)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-expressions">**expressions**</span><br>[`expressionArray`](/docs/config_guides/slot_types#expressionarray) = <code>[]</code> | The features the display admits: a feature is drawn when every expression holds. Each entry is a `jexl:` expression over `feature`. The "Filter by..." dialog and "Edit plot..." edit this list, and "Clear all filters" returns it to what the track's config declares. |
