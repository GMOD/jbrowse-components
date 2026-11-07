---
id: sectionfacet
title: SectionFacet
description: "The facet of a display that stacks labelled sections, each of which a reader can hide from its chip: Facet's field and sort, and the sections hidden."
sidebar_label: Display setting -> SectionFacet
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/sectionFacetConfigSchema.ts).

The facet of a display that stacks labelled sections, each of which a
reader can hide from its chip: Facet's `field` and `sort`, and the
sections hidden. A hide-set rather than a show-set, so a section a later
region discovers shows; a new `field` starts with none hidden. Only here,
since the row displays' Facet reads no hidden band.

## Example usage

```js
{
  type: 'LinearBasicDisplay',
  facet: { field: 'gene_biotype', hidden: ['misc_RNA'] },
}
```

## Related links

- **Extended by:** [MarkFacet](../markfacet)
- **Base config:** [Facet](../facet)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. One that changes `field` first clears `sort`, `hidden`, which name the old values, except those it states. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-hidden">**hidden**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The keys of the sections hidden from the stack, as a section chip's Hide writes them; "Show all" clears it. |
| <span class="slot-group">Inherited from [Facet](../facet)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | A feature field, or on a row display a row attribute, whose values each get a labelled section of the track: a field name, a dotted path into a structured field (`INFO.SVTYPE`, a read's `tags.HP`), a `jexl:` expression, or `strand`. A feature with no value stacks last, under `field: none` (`(no value)` for a `jexl:` field, whose sections show the value alone). The variant display's row attribute is a sample attribute, and the mark displays' is `group`, their `rows.groups`. The alignments displays also take a read dimension here: `firstOfPairStrand`, `pairOrientation`, `pairing`, `split`, `spliced`, `mapq`, `mateRefName` or `mateAssembly`. Writing `facet: "strand"` sets this slot. |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The values whose sections stack first, in order, as Vega-Lite's `sort` lists them: the rest follow sorted, and none is dropped. Empty stacks every section sorted, and a `strand` facet forward, reverse, then unstranded (`1`, `-1`, `0`). |
