Respiratory syncytial virus subgroup A (~15.2 kb) rendered from **inline** data,
like the [SARS-CoV-2 demo](../nextstrain-covid/). The config is generated from
the live [Nextstrain RSV-A dataset](https://nextstrain.org/rsv/a/genome) by
`scripts/gen-nextstrain-demos.mjs`: the real reference sequence comes from the
build's GenBank reference, gene coordinates come from the dataset's
`genome_annotations`, and the diversity (Shannon-entropy) `QuantitativeTrack` is
reconstructed per position from the phylogeny's nucleotide mutations. Everything
is inlined, so the whole embed is self-contained with no runtime fetches.

See [the config guide](https://jbrowse.org/jb2/docs/config_guide) for the
track/assembly shapes.
