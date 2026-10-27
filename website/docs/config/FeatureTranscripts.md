---
id: featuretranscripts
title: FeatureTranscripts
description: "The feature display's transcripts: which children read as a gene's isoforms, and the order they rank in. field names the attribute holding a curated tag and sort the tag values that rank first, in…"
sidebar_label: Display setting -> FeatureTranscripts
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `features` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/features/src/LinearBasicDisplay/featureTranscriptsConfigSchema.ts).

The feature display's `transcripts`: which children read as a gene's
isoforms, and the order they rank in. `field` names the attribute holding
a curated tag and `sort` the tag values that rank first, in order, as a
`facet` sorts; the isoforms past the list follow by coding length. The
first-ranked is the one transcript `geneGlyphMode: 'representative'` draws,
and the first kept when `auto` caps a gene at the rows the track has.

## Example usage

```js
{
  type: 'LinearBasicDisplay',
  transcripts: { field: 'tag', sort: ['MANE Select', 'Ensembl_canonical'] },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-types">**types**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>['mRNA', 'transcript', 'primary_transcript', 'V_gene_segment',…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>['mRNA', 'transcript', 'primary_transcript', 'V_gene_segment', 'C_gene_segment', 'D_gene_segment', 'J_gene_segment']</code></pre></dialog></span> | Types the `geneLike` filter field counts beside every gene, transcript and RNA type, and the fallback for recognizing a childless transcript as one of a gene's isoforms. Not the isoform test: keying that off this list dropped every `lnc_RNA` and `misc_RNA` isoform NCBI hangs off a gene. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'tag'</code> | The attribute holding an isoform's curated "this one represents the gene" tag. |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>['MANE Select', 'MANE_Select', 'RefSeq Select', 'Ensembl_canoni…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>['MANE Select', 'MANE_Select', 'RefSeq Select', 'Ensembl_canonical', 'MANE Plus Clinical', 'MANE_Plus_Clinical']</code></pre></dialog></span> | The values of `field` that rank an isoform first, in order. |
