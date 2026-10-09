---
id: sectionfacet
title: SectionFacet
description: "The facet of a display that stacks labelled sections, each of which a reader can hide from its chip: Facet's field and domain, and the sections hidden. A hide-set rather than a show-set, so a…"
sidebar_label: Display -> SectionFacet
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/sectionFacetConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearBasicDisplay',
  facet: { field: 'gene_biotype', hidden: ['misc_RNA'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The facet of a display that stacks labelled sections, each of which a
reader can hide from its chip: Facet's `field` and `domain`, and the
sections hidden. A hide-set rather than a show-set, so a section a later
region discovers shows; a new `field` starts with none hidden. Only here,
since the row displays' Facet reads no hidden band.

## Related links

- **Extended by:** [MarkFacet](../markfacet)
- **Base config:** [Facet](../facet)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-hidden">**hidden**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The keys of the sections hidden from the stack, as a section chip's Hide writes them; "Show all" clears it. |
| <span class="slot-group">Inherited from [Facet](../facet)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field each value of which packs its own labelled section of the track: a field name, a dotted path into a structured field (`INFO.SVTYPE`, a read's `tags.HP`), a `jexl:` expression, or `strand`. A feature with no value stacks last, under `field: none`. The multi-sample variant displays read a sample attribute instead, and the multi-row display `group`, its `rowGroups`. The alignments displays also take a read dimension here: `firstOfPairStrand`, `pairOrientation`, `splitRead`, `mapq` or `mateAssembly`. Writing `facet: "strand"` lands here. |
| <span id="slot-domain">**domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The values whose sections stack first, in order; the rest follow sorted. Empty stacks every section sorted, and a `strand` facet forward, reverse, then unstranded (`1`, `-1`, `0`). |
