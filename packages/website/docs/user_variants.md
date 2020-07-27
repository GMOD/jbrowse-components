---
id: user_variants
title: Variant tracks
---

Visualizing variant tracks from the VCF format alongside the original alignment
evidence track is a common workflow for validating your results. In JBrowse 2
we can open a variant track and an alignments track as shown below

![](/jb2/img/variant_with_pileup.png)
Variant track indicating a SNP alongside the alignment track evidence

### Variant widget

The variant features have a specialized widget that contains a table
indicating all the calls that were made in a multi-sample VCF. Some VCF files,
like the 1000 genomes VCF, can contain thousands of samples in a single file.
This table can display the details

### Future additions

We anticipate adding more features to the variant track in the future including

1. Ability to visualize individual samples in a multi-sample VCF as subtracks
   of a variant track
2. Ability to use FILTER the VCF column via the track menu
