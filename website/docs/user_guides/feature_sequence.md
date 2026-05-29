---
title: Feature sequence panel
description: Sequence extraction for selected features
guide_category: Track types
---

### Gene features

For gene or transcript features, the feature detail sidebar stitches the
sequence together for you. Options:

- **CDS** — the stitched-together coding sequences
- **Protein** — protein translation of the CDS using the standard genetic code
  (NCBI table 1). Alternative codon tables (mitochondrial, certain organisms)
  are not currently supported
- **cDNA** — the "copy DNA" of the transcript, formed from the exon sequences
- **Genomic w/ full introns** — the entire gene region including introns, with
  UTR and CDS highlighted
- **Genomic w/ full introns +/- Nbp up+down stream** — the above plus N bases
  upstream and downstream (shown in light red)
- **Genomic w/ Nbp intron** — the exon sequence plus N intronic bases flanking
  each splice site
- **Genomic w/ Nbp intron +/- Nbp up+down stream** — combines the
  upstream/downstream extension with the splice-site flanks

The up/downstream extension defaults to 100bp and the intron flank to 10bp; both
are configurable from the gear icon.

<Figure caption="Sequence panel showing upstream, exonic, intronic, and downstream sequence for a selected feature." src="/img/feature_detail_sequence.png" />

### Other feature types

For non-gene features, the "Feature sequence" button shows the literal sequence
underlying the feature, without subfeature stitching. The number of flanking
bases is configurable from the gear icon.
