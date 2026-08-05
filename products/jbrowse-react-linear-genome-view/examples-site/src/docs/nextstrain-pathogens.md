Five viral genomes (SARS-CoV-2, Zika, Ebola, measles, RSV-A), each built from a
single config object bundled with the app. The **Pathogen** dropdown swaps which
committed config the view is built from; everything else is identical. Gene
annotations are inline (a `FromConfigAdapter` `FeatureTrack`), while the two
bulky pieces are flatfiles hosted on `jbrowse.org/demos`:

- reference: `IndexedFastaAdapter` (e.g. `covid.fa` + `.fai`)
- diversity (Shannon-entropy): `BigWigAdapter` (e.g. `covid_entropy.bw`)

`scripts/gen-nextstrain-demos.mjs` generates the configs from the live
Nextstrain datasets ([SARS-CoV-2](https://nextstrain.org/ncov/open/global/6m),
[Zika](https://nextstrain.org/zika), [Ebola](https://nextstrain.org/ebola),
[measles](https://nextstrain.org/measles),
[RSV-A](https://nextstrain.org/rsv/a/genome)): the reference is each build's
published sequence, gene coordinates come from the dataset's
`genome_annotations`, and the diversity track is reconstructed per position from
the phylogeny's nucleotide mutations.

The **Sample genotypes** track is a multi-sample variant matrix. The generator
reconstructs each phylogeny tip's genotype at every variable site (walking the
tree's nucleotide mutations root→tip) and writes a bgzipped/tabixed VCF plus a
`samplesTsv` of tip metadata, which `LinearMultiSampleVariantMatrixDisplay`
renders as samples × sites, colored by region. The Zika and measles configs also
carry a `CramAdapter` **Published genomes** track, every genome NCBI publishes
aligned to the hosted reference with `minimap2`.

Because each config is a plain JS object, your own code can import, generate or
template it. See [default session](../default-session/#default-session) for the
session structure, [the config guide](https://jbrowse.org/jb2/docs/config_guide)
for the track/assembly shapes, and the
[Nextstrain pathogens example](https://gmod.org/JBrowseMSA/examples#nextstrain-pathogens)
on [react-msaview](https://gmod.org/JBrowseMSA) for the matching reconstructed
tree + alignment.
