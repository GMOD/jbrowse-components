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

<Figure caption="Sequence panel for the human SELENOP gene, color-coded by region: upstream/downstream (red), UTR (blue), CDS (yellow), and intronic (white)." src="/img/feature_detail_sequence.png" />

Selecting the **Protein** type highlights (amber) any residue whose translation
a `transl_except` attribute overrides, and summarizes the overrides in a legend.
The example below is SELENOP, whose ten in-frame UGA stop codons are annotated
as `transl_except=(...,aa:Sec)` and translate to selenocysteine (U).

<Figure caption="Protein translation of SELENOP: the ten selenocysteine (U) residues recoded via transl_except are highlighted amber, with a legend summarizing the overrides." src="/img/feature_detail_protein.png" />

<Figure caption="Choosing the sequence type for a volvox gene: the dropdown is set to 'Genomic w/ full introns +/- 100bp up+down stream', so the panel shows the upstream flank, the exons and introns, and the downstream flank." src="/img/upstream_downstream_details.png" />

<Video src="/media/ui/feature_sequence_types.mp4" caption="A volvox transcript selected, its feature sequence shown, and three types taken from the dropdown in turn: the coding sequence, its translation, and the genomic sequence with introns and flanks around it." />

## Other feature types

For non-gene features, the "Feature sequence" button shows the literal sequence
underlying the feature, without subfeature stitching. The number of flanking
bases is configurable from the gear icon.

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/gene_track)
- [Assembly configuration: alternative genetic codes](/docs/config_guides/assemblies#configuring-alternative-genetic-codes-translation-tables)
