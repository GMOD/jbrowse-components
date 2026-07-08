Measles virus (~15.9 kb), like the [SARS-CoV-2 demo](../nextstrain-covid/): the
gene annotations are inline (the spliced V reading frame becomes subfeatures),
and the reference (`IndexedFastaAdapter`, `measles.fa`) plus the diversity
(Shannon-entropy) track (`BigWigAdapter`, `measles_entropy.bw`) are small
flatfiles hosted on `jbrowse.org/demos`. The config is generated from the live
[Nextstrain measles dataset](https://nextstrain.org/measles) by
`scripts/gen-nextstrain-demos.mjs`: gene coordinates come from the dataset's
`genome_annotations`, and the diversity track is reconstructed per position from
the phylogeny's nucleotide mutations.

The **Published genomes** track is a `CramAdapter`: every measles genome NCBI
publishes (the ~29,000 sequences Nextstrain ingests), aligned with `minimap2` to
the same hosted reference. CRAM stores each read as differences from the
reference, so JBrowse renders coverage and per-base mismatches straight off the
shared assembly sequence — no MD tag needed.

The **Sample genotypes** track is a multi-sample variant matrix: the generator
reconstructs each phylogeny tip's genotype at every variable site (walking the
tree's nucleotide mutations root→tip) into a bgzipped/tabixed VCF plus a
`samplesTsv` of each tip's metadata, rendered by
`LinearMultiSampleVariantMatrixDisplay` as samples × sites colored by region —
the genotype table behind the Nextstrain tree, in genome coordinates.

See [the config guide](https://jbrowse.org/jb2/docs/config_guide) for the
track/assembly shapes.
