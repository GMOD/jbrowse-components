---
id: facet
title: Facet
sidebar_label: Display -> Facet
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/facetConfigSchema.ts).

## Example usage

```js
{ type: 'LinearBasicDisplay', facet: 'strand' }
```

```js
{
  type: 'LinearBasicDisplay',
  facet: { field: 'gene_biotype', domain: ['protein_coding', 'lncRNA'] },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  facet: { field: 'tags.HP', domain: ['1', '2'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The `facet` setting of the feature, multi-sample variant and alignments
displays: one labelled section of the track per value of a field. A string
is the field; the object adds the order. The mark display's `MarkFacet`
adds the steps each section runs.

## Related links

- **Extended by:** [MarkFacet](../markfacet)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "Facet", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field each value of which packs its own labelled section of the track: a field name, a dotted path into a structured field (`INFO.SVTYPE`, a read's `tags.HP`), a `jexl:` expression, or `strand`. A feature with no value stacks last, under `field: none`. The alignments displays also take a read dimension here: `firstOfPairStrand`, `pairOrientation`, `splitRead`, `mapq` or `mateAssembly`. Writing `facet: "strand"` lands here. |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | The values whose sections stack first, in order; the rest follow sorted. Empty stacks every section sorted, and a `strand` facet forward, reverse, then unstranded (`1`, `-1`, `0`). |
