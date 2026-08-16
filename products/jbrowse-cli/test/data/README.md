# CLI test data

Two kinds of file live here, and telling them apart matters.

Most are real and parseable — `volvox.sort.gff3`, `volvox.filtered.vcf`,
`simple.fasta`, `volvox_inv_indels.paf`. Commands that read a file
(`text-index`, `sort-gff`, `make-pif`) use these.

**Eleven are deliberately 0 bytes.** `add-track` picks an adapter from the
filename and copies the file; it never opens it. So its fixtures only need the
right extension, and an empty file is the honest way to say "the content is not
part of this test":

    grape.bed  peach.bed
    simple.bai  simple.bam  simple.bam.bai  simple.bam.csi
    volvox_inv_indels.anchors  volvox_inv_indels.anchors.simple
    volvox_inv_indels.chain  volvox_inv_indels.delta  volvox_inv_indels.out

Don't read the empty ones as missing coverage of those formats, and don't fill
them to "fix" them — `simple.bam` cannot be a valid BAM at 0 bytes either, and
nothing here would notice. The parsers behind these extensions are tested where
they live: the chain and delta parsers against a PAF of the same alignment in
`plugins/comparative-adapters/src/formatParity.test.ts`, the MCScan `.anchors`
readers in `plugins/comparative-adapters/src/MCScan*Adapter/`.
