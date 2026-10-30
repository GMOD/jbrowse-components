---
id: markfacet
title: MarkFacet
description: "The mark display's facet: the Facet the feature and alignments displays take, one labelled section of the track per value of a field, plus the steps the facet runs separately over each section's…"
sidebar_label: Display setting -> MarkFacet
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markFacetConfigSchema.ts).

The mark display's `facet`: the [Facet](../facet) the feature and alignments
displays take, one labelled section of the track per value of a field, plus
the steps the facet runs separately over each section's features, after the
display's `transform` and before every mark's `transform`. A `pileup` here
packs each section into separate rows, and every mark then draws in them. A
string is the field; with no field the steps run over the one section there
is.

## Example usage

```js
{
  type: 'LinearMarkDisplay',
  facet: { field: 'HP', transform: [{ type: 'pileup' }] },
  marks: [{ mark: 'rect' }],
}
```

## Related links

- **Base config:** [SectionFacet](../sectionfacet)

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-transform">**transform**</span><br>[MarkTransform](../marktransform) | Steps that run separately over each section's features, after the display's `transform` and before any mark's `transform`: a `pileup` here packs each section into separate rows, and every mark draws in them. |
| <span class="slot-group">Inherited from [SectionFacet](../sectionfacet)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-hidden">**hidden**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The keys of the sections hidden from the stack, as a section chip's Hide writes them; "Show all" clears it. |
| <span class="slot-group">Inherited from [Facet](../facet)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field whose values each get a labelled section of the track: a field name, a dotted path into a structured field (`INFO.SVTYPE`, a read's `tags.HP`), a `jexl:` expression, or `strand`. A feature with no value stacks last, under `field: none` (`(no value)` for a `jexl:` field, whose sections show the value alone). The multi-sample variant displays read a sample attribute instead, and the mark displays `group`, their `rowGroups`. The alignments displays also take a read dimension here: `firstOfPairStrand`, `pairOrientation`, `pairing`, `split`, `spliced`, `mapq`, `mateRefName` or `mateAssembly`. Writing `facet: "strand"` sets this slot. |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The values whose sections stack first, in order, as Vega-Lite's `sort` lists them: the rest follow sorted, and none is dropped. Empty stacks every section sorted, and a `strand` facet forward, reverse, then unstranded (`1`, `-1`, `0`). |
