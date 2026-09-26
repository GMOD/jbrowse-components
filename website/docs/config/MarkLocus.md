---
id: marklocus
title: MarkLocus
sidebar_label: Display -> MarkLocus
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markLocusConfigSchema.ts).

## Example usage

A BEDPE-like file whose second end sits in its own columns:

```js
{
  mark: 'link',
  encoding: { x2: { chrom: 'chrom2', pos: 'start2' } },
}
```

_See the **Config slots** section below for all available configuration fields._

A mark's far end as a position that may lie on another sequence: `pos`,
the feature field holding its coordinate, and `chrom`, the field holding
its refName, as a paired record states its mate. Writing a field name
directly on the encoding lands in `pos`, on the feature's own sequence.
Left unwritten behind a `mate` step, it is the other end the step found.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MarkLocus", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-pos">**pos**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'end'</code> | The feature field, or jexl expression over `feature`, giving the position in bp. |
| <span id="slot-chrom">**chrom**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field holding the sequence the position lies on. Empty is the feature's own. |
