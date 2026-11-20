---
name: a-samplestsv-modifier-in-jb2export
description: jb2export draws a 2,504-sample 1000 Genomes matrix but cannot color its rows by population, because the CLI has no way to pass the VCF adapter's `samplesTsvLocation`. A `samplesTsv:<uri>` track modifier would.
---

# A `samplesTsv:` modifier in jb2export

The multi-sample variant matrix renders real 1000 Genomes data in jb2export (a
full 2,504-sample matrix off `ALL.chr11.phase3…genotypes.vcf.gz`). The gap for
the flagship figure is `rows.color: 'population'`: it needs the VCF adapter's
sample-to-population table (`samplesTsvLocation`,
`packages/core/src/util/samplesTsv.ts`), which the CLI cannot pass.

Add a `samplesTsv:<uri>` track modifier in `packages/launch-args` that sets
`samplesTsvLocation` on the adapter, so a genome-wide callset can be colored by
super-population instead of reading as reference-dominant grey.
