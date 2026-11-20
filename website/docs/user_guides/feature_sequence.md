---
title: Feature sequence panel
description: Sequence extraction for selected features
guide_category: Sequence tools
---

**Show feature sequence** in the feature details panel displays the sequence
under a selected feature. For a gene or transcript, choose CDS, protein
translation, cDNA, or genomic with introns (plus optional flanking bases); for
any other feature type it shows the literal underlying sequence.

## Gene features

For a gene or transcript, the panel stitches the subfeature sequences together.
The dropdown at the top of the panel picks the type:

- **CDS:** the stitched-together coding sequences
- **Protein:** the translation of the CDS, in the standard genetic code (NCBI
  table 1) unless the CDS has a `transl_table` attribute in the GFF (e.g.
  `transl_table=2` for vertebrate mitochondria), which selects the matching
  table, start codons and `transl_except` included
- **cDNA:** the exon sequences joined
- **Genomic w/ full introns:** the whole gene region, with UTR and CDS
  highlighted
- **Genomic w/ full introns +/- Nbp up+down stream:** the above plus N bases
  upstream and downstream
- **Genomic w/ Nbp intron:** the exons plus N intronic bases flanking each
  splice site
- **Genomic w/ Nbp intron +/- Nbp up+down stream:** the splice-site flanks plus
  the upstream and downstream extension

With one of those types picked, the panel's ⋮ menu offers a **Flanking bases**
or **Intron bases** slider (100bp and 10bp by default), and the type's name
follows it.

<Figure caption="The sequence panel for HBB, colored by region: flanks red, UTR blue, CDS yellow, introns white." src="/img/feature_detail_sequence.png" />

Selecting the **Protein** type highlights (amber) any residue whose translation
a `transl_except` attribute overrides, and summarizes the overrides in a legend.
The example below is SELENOP, whose ten in-frame UGA stop codons are annotated
as `transl_except=(...,aa:Sec)` and translate to selenocysteine (U).

<Figure caption="SELENOP's translation, the transl_except residues highlighted amber." src="/img/feature_detail_protein.png" />

<Figure caption="The sequence type set to Genomic w/ full introns +/- 100bp up+down stream, with the ⋮ menu's Flanking bases slider open." src="/img/upstream_downstream_details.png" />

<Video src="/media/ui/feature_sequence_types.mp4" caption="A transcript's feature sequence with three types taken from the dropdown in turn." />

## Other feature types

For other features, **Show feature sequence** shows the sequence under the
feature as one span. **Genomic +/- Nbp up+down stream** adds flanking bases, and
the ⋮ menu's **Flanking bases** slider sets how many.

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/gene_track)
- [Assembly configuration: alternative genetic codes](/docs/config_guides/assemblies#configuring-alternative-genetic-codes-translation-tables)
