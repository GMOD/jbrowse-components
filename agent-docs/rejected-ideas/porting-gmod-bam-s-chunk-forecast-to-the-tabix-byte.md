---
name: porting-gmod-bam-s-chunk-forecast-to-the-tabix-byte
description: Porting `@gmod/bam`'s chunk forecast to the tabix byte gate
area: performance-and-measurement
---

# Porting `@gmod/bam`'s chunk forecast to the tabix byte gate

implemented,
measured across every `.tbi` fixture, and reverted (`@gmod/tabix` ADR 0005).
`TabixIndexedFile.bytesForRegions` sums every chunk `blocksForRange` offers
where `@gmod/bam` cuts the list at the linear-index entry past the query, and
the over-report is real — **3.57x** on `ncbi_human.sorted.gff.gz` at every
window under a megabase. The port is *safe* (zero queries forecast under what
they read, which is what killed an earlier attempt) and buys **one row** in
the whole sweep. It cannot help where the gate actually fires: every NCBI
RefSeq GFF opens with a `region` feature spanning the whole chromosome at
offset 0, which pins every linear-index entry on that reference and leaves the
bound ordering nothing, and a dense VCF already measures 1.00x because the
query reads all its chunks. The difference from BAM is not the forecast but
what `blocksForRange` returns: a deep pileup offers 90 chunks and reads 6,
tabix bins do not.
