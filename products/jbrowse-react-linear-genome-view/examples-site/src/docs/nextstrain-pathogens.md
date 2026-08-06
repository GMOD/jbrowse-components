Five viral genomes — SARS-CoV-2, Zika, Ebola, measles, RSV-A — each one config
object bundled with the app. The **Pathogen** dropdown swaps which config the
view is built from; nothing else changes. Gene annotations are inline
(`FromConfigAdapter`), while the reference (`IndexedFastaAdapter`) and the
Shannon-entropy diversity track (`BigWigAdapter`) are flatfiles on
`jbrowse.org/demos`.

**Sample genotypes** is a multi-sample variant matrix. The generator walks each
phylogeny's nucleotide mutations root→tip to reconstruct every tip's genotype at
every variable site, then writes a bgzipped VCF plus a `samplesTsv` of tip
metadata, which `LinearMultiSampleVariantMatrixDisplay` draws as samples × sites
colored by region. Zika and measles also carry a `CramAdapter` **Published
genomes** track — every genome NCBI publishes, aligned with `minimap2`.

`scripts/gen-nextstrain-demos.mjs` builds all of it from the live Nextstrain
datasets. Because each config is a plain JS object, your own code can import,
generate or template it the same way. See
[react-msaview](https://gmod.org/JBrowseMSA/examples#nextstrain-pathogens) for
the matching reconstructed tree and alignment.
