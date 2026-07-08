Respiratory syncytial virus subgroup A (~15.2 kb), like the
[SARS-CoV-2 demo](../nextstrain-covid/): the gene annotations are inline, and the
reference (`IndexedFastaAdapter`, `rsv-a.fa`) plus the diversity (Shannon-
entropy) track (`BigWigAdapter`, `rsv-a_entropy.bw`) are small flatfiles hosted
on `jbrowse.org/demos`. The config is generated from the live
[Nextstrain RSV-A dataset](https://nextstrain.org/rsv/a/genome) by
`scripts/gen-nextstrain-demos.mjs`: gene coordinates come from the dataset's
`genome_annotations`, and the diversity track is reconstructed per position from
the phylogeny's nucleotide mutations.

The **Sample genotypes** track is a multi-sample variant matrix: the generator
reconstructs each phylogeny tip's genotype at every variable site (walking the
tree's nucleotide mutations root→tip) into a bgzipped/tabixed VCF plus a
`samplesTsv` of each tip's metadata, rendered by
`LinearMultiSampleVariantMatrixDisplay` as samples × sites colored by region —
the genotype table behind the Nextstrain tree, in genome coordinates.

See [the config guide](https://jbrowse.org/jb2/docs/config_guide) for the
track/assembly shapes.
