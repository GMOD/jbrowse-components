Zika virus (~10.8 kb), like the [SARS-CoV-2 demo](../nextstrain-covid/): the gene
annotations are inline, and the reference (`IndexedFastaAdapter`, `zika.fa`) plus
the diversity (Shannon-entropy) track (`BigWigAdapter`, `zika_entropy.bw`) are
small flatfiles hosted on `jbrowse.org/demos`. The config is generated from the
live [Nextstrain Zika dataset](https://nextstrain.org/zika) by
`scripts/gen-nextstrain-demos.mjs`: gene coordinates come from the dataset's
`genome_annotations`, and the diversity track is reconstructed per position from
the phylogeny's nucleotide mutations.

The **Published genomes** track is a `CramAdapter`: every Zika genome NCBI
publishes (the 3,342 sequences Nextstrain ingests), aligned with `minimap2` to
the same hosted reference. CRAM stores each read as differences from the
reference, so JBrowse renders coverage and per-base mismatches straight off the
shared assembly sequence — showing how the published genomes vary against the
reference with no MD tag needed.

Zika is a flavivirus: its genome is one long ORF translated into a single
polyprotein, then cleaved into mature peptides (C, prM, E, NS1–NS5). Rather than
show a dozen unrelated genes, the annotation track models this as one
`polyprotein` feature whose subfeatures are the mature-protein regions — so the
cleavage products read as segments of a single unit.

See [the config guide](https://jbrowse.org/jb2/docs/config_guide) for the
track/assembly shapes.
