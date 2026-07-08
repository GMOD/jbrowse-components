Measles virus (~15.9 kb) rendered from **inline** data, like the
[SARS-CoV-2 demo](../nextstrain-covid/). The config is generated from the live
[Nextstrain measles dataset](https://nextstrain.org/measles) by
`scripts/gen-nextstrain-demos.mjs`: gene coordinates come from the dataset's
`genome_annotations` (the spliced V reading frame becomes subfeatures), and the
diversity (Shannon-entropy) `QuantitativeTrack` is reconstructed per position
from the phylogeny's nucleotide mutations. The real reference sequence comes
from the build's GenBank reference. Those are all inlined in the config.

The **Published genomes** track streams a BAM: every measles genome NCBI
publishes (the ~29,000 sequences Nextstrain ingests), aligned to the reference
and hosted on `jbrowse.org/demos`. So this demo mixes inline data (assembly,
annotations, diversity) with one remote alignments track.

See [the config guide](https://jbrowse.org/jb2/docs/config_guide) for the
track/assembly shapes.
