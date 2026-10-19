---
title: Feature sequence panel
description: Sequence extraction for selected features
guide_category: Sequence tools
---

The feature details panel can extract and display the sequence underlying a
selected feature. For a gene or transcript, choose CDS, protein translation,
cDNA, or genomic with introns (plus optional flanking bases); for any other
feature type it shows the literal underlying sequence.

## Gene features

For gene or transcript features, the feature details panel stitches the
subfeature sequences together. The available types are:

- CDS - the stitched-together coding sequences
- Protein - protein translation of the CDS. The panel uses the standard genetic
  code (NCBI table 1) by default, but if the CDS has a `transl_table` attribute
  in the GFF (e.g. `transl_table=2` for vertebrate mitochondria) it applies the
  matching alternative codon table, including start-codon and `transl_except`
  handling
- cDNA - the complementary DNA of the transcript, formed from the exon sequences
- Genomic w/ full introns - the entire gene region including introns, with UTR
  and CDS highlighted
- Genomic w/ full introns +/- Nbp up+down stream - the above plus N bases
  upstream and downstream
- Genomic w/ Nbp intron - the exon sequence plus N intronic bases flanking each
  splice site
- Genomic w/ Nbp intron +/- Nbp up+down stream - combines the
  upstream/downstream extension with the splice-site flanks

Choose the sequence type from the dropdown at the top of the panel. The
up/downstream extension defaults to 100bp and the intron flank to 10bp; both are
configurable from the gear icon.

<Figure caption="The sequence panel for SELENOP, colored by region: flanks red, UTR blue, CDS yellow, introns white." src="/img/feature_detail_sequence.png" />

Selecting the **Protein** type highlights (amber) any residue whose translation
a `transl_except` attribute overrides, and summarizes the overrides in a legend.
The example below is SELENOP, whose ten in-frame UGA stop codons are annotated
as `transl_except=(...,aa:Sec)` and translate to selenocysteine (U).

<Figure caption="SELENOP's translation, the transl_except residues highlighted amber." src="/img/feature_detail_protein.png" />

<Figure caption="The sequence type dropdown set to Genomic w/ full introns +/- 100bp up+down stream." src="/img/upstream_downstream_details.png" />

<Video src="/media/ui/feature_sequence_types.mp4" caption="A transcript's feature sequence with three types taken from the dropdown in turn." />

## Other feature types

For non-gene features, the "Feature sequence" button shows the literal sequence
underlying the feature, without subfeature stitching. The number of flanking
bases is configurable from the gear icon.

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/gene_track)
- [Assembly configuration: alternative genetic codes](/docs/config_guides/assemblies#configuring-alternative-genetic-codes-translation-tables)
