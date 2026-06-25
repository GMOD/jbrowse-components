---
title: Feature sequence panel
description: Sequence extraction for selected features
guide_category: Track types
---

The feature detail sidebar can extract and display the sequence underlying a
selected feature, with options that vary by feature type.

## Gene features

For gene or transcript features, the feature detail sidebar stitches the
sequence together for you. Options:

- **CDS** — the stitched-together coding sequences
- **Protein** — protein translation of the CDS. The standard genetic code (NCBI
  table 1) is used by default, but if the CDS has a `transl_table` attribute in
  the GFF (e.g. `transl_table=2` for vertebrate mitochondria) the matching
  alternative codon table is applied, including start-codon and `transl_except`
  handling
- **cDNA** — the "copy DNA" of the transcript, formed from the exon sequences
- **Genomic w/ full introns** — the entire gene region including introns, with
  UTR and CDS highlighted
- **Genomic w/ full introns +/- Nbp up+down stream** — the above plus N bases
  upstream and downstream
- **Genomic w/ Nbp intron** — the exon sequence plus N intronic bases flanking
  each splice site
- **Genomic w/ Nbp intron +/- Nbp up+down stream** — combines the
  upstream/downstream extension with the splice-site flanks

The sequence type is chosen from the dropdown at the top of the panel. The
up/downstream extension defaults to 100bp and the intron flank to 10bp; both are
configurable from the gear icon.

<Figure caption="Sequence panel for the human SELENOP gene, color-coded by region: upstream/downstream (red), UTR (blue), CDS (yellow), and intronic (white)." src="/img/feature_detail_sequence.png" />

When the **Protein** type is selected, residues whose translation was overridden
by a `transl_except` attribute are highlighted (amber) and summarized in a
legend. The example below is the selenoprotein SELENOP, whose ten in-frame UGA
stop codons NCBI RefSeq annotates as `transl_except=(...,aa:Sec)` so they
translate to selenocysteine (U) instead of terminating the protein.

<Figure caption="Protein translation of SELENOP: the ten selenocysteine (U) residues recoded from in-frame UGA stop codons via transl_except are highlighted amber, with a legend summarizing the overrides." src="/img/feature_detail_protein.png" />

<Figure caption="Choosing the sequence type for a volvox gene: the dropdown is set to 'Genomic w/ full introns +/- 100bp up+down stream', so the panel shows the upstream flank, the exons and introns, and the downstream flank." src="/img/upstream_downstream_details.png" />

## Other feature types

For non-gene features, the "Feature sequence" button shows the literal sequence
underlying the feature, without subfeature stitching. The number of flanking
bases is configurable from the gear icon.
