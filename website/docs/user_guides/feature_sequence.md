---
id: feature_sequence
title: Feature sequence panel
description: Sequence extraction for selected features
guide_category: Track types
---

### Gene features

For gene or transcript features, the feature detail sidebar stitches the
sequence together for you. Options:

- **CDS** — coding sequences, spliced
- **Protein** — protein translation of the CDS using the standard genetic code
  (NCBI table 1). Alternative codon tables (mitochondrial, certain organisms)
  are not currently supported
- **cDNA** — CDS plus UTRs (or all exons for a non-coding gene)
- **Gene with introns** — the entire gene region including introns
- **Gene with 10bp of introns** — spliced gene sequence with 10bp around each
  splice site
- **Gene with 500bp up+down stream** — the gene region plus 500bp upstream and
  500bp downstream (shown in light red)
- **Gene with 500bp up+down stream + 10bp of introns** — combines the
  upstream/downstream extension with the splice-site flanks

The 500bp and 10bp values are defaults — [let us know](/contact/) if you want
them configurable.

<Figure caption="Sequence panel showing upstream, exonic, intronic, and downstream sequence for a selected feature." src="/img/feature_detail_sequence.png" />

### Other feature types

For non-gene features, the "Feature sequence" button shows the literal sequence
underlying the feature, without subfeature stitching. The number of flanking
bases is configurable from the gear icon.
