Zika virus (~10.8 kb) rendered from **inline** data, like the
[SARS-CoV-2 demo](../nextstrain-covid/). The config is generated from the live
[Nextstrain Zika dataset](https://nextstrain.org/zika) by
`scripts/gen-nextstrain-demos.mjs`: the real reference sequence comes from the
build's GenBank reference, gene coordinates come from the dataset's
`genome_annotations`, and the diversity (Shannon-entropy) `QuantitativeTrack` is
reconstructed per position from the phylogeny's nucleotide mutations. Those are
all inlined in the config.

The **Published genomes** track streams a BAM: every Zika genome NCBI publishes
(the 3,342 sequences Nextstrain ingests), aligned to the reference and hosted on
`jbrowse.org/demos`. So this demo mixes inline data (assembly, annotations,
diversity) with one remote alignments track — the coverage and per-base
mismatches show how the published genomes vary against the reference.

Zika is a flavivirus: its genome is one long ORF translated into a single
polyprotein, then cleaved into mature peptides (C, prM, E, NS1–NS5). Rather than
show a dozen unrelated genes, the annotation track models this as one
`polyprotein` feature whose subfeatures are the mature-protein regions — so the
cleavage products read as segments of a single unit.

See [the config guide](https://jbrowse.org/jb2/docs/config_guide) for the
track/assembly shapes.
