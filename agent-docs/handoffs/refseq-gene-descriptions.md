---
name: refseq-gene-descriptions
description: "Description lines on the hosted UCSC-converted RefSeq gene tracks: a one-transcript gene reads its transcript's product, a variant name included, and a multi-transcript gene reads nothing. NCBI's GFF has a short description on every gene, which the converter could copy onto gene rows."
---

# RefSeq gene descriptions

## What draws now

- The default description field, `FEATURE_DESCRIPTION_FIELD`
  (`plugins/features/src/RenderFeatureDataRPC/featureNameField.ts`), reads
  `note`, `description`, `function`, then `getUnbranched(feature,'product')`.
  `unbranchedValue` (`packages/core/src/util/featureWalks.ts`) steps down only
  while a level has one child, which suits a bacterial gene → CDS chain.
- The gene rows of `jbrowse.org/ucsc/<asm>/ncbiRefSeq.gff.gz` carry only
  `ID`, `Name` and `gene_id`. Each transcript row carries the UCSC Link
  table's columns: `product` names that transcript ("tripartite motif
  containing 5, transcript variant 4"), and `description` is RefSeq's summary
  paragraph, too long for a label.
- So in hg38 chr11:5,200,000-5,800,000, HBB reads "hemoglobin subunit beta",
  OR51I2 reads "olfactory receptor family 51 subfamily I member 2, transcript
  variant 1, coding", and TRIM5 (19 transcripts) reads nothing. A blank line
  under a gene reads as "nothing known", not "several transcripts".
- NCBI's own GFF, hosted as `jbrowse.org/ucsc/hg38/hg38.gff.gz` (track
  `hg38-ncbiRefSeqGff`, `NC_` sequence names), has a short `description=` on
  every gene row: 32 of 32 genes in that window, TRIM5's "tripartite motif
  containing 5" among them.

## Next

- **Copy NCBI's gene description onto the converted gene rows.** jb2hubs'
  `ucsc2jbrowse/src/genePredToGff.ts` already reads NCBI's GFF to enrich
  transcripts (`readNcbiTranscripts` keeps `tag` and `exception` and skips
  gene rows), and `geneRows` writes `ID`, `Name` and `gene_id` alone. Read the
  gene rows' `description` there, keyed by gene name, and write it in
  `geneRows`. The engine's default reads `description` before `product`, so
  this repo needs no change. To check first:
  - which assemblies get NCBI enrichment (the GFF argument
    `createGeneTracksForGoldenPath.sh` passes); the others keep the product
    fallback;
  - whether the text index picks up the new gene attribute, against the
    rebuilt-trix rule in `reference/HOSTING.md`.
- **Then judge the product fallback for eukaryotic genes again.** Once gene
  rows carry a description, `getUnbranched` reads `product` only on assemblies
  without enrichment. Reading it only through an all-single-child chain was
  proposed and declined on 2026-11-23, because it also blanks HBB.
- **Redraw what reads these files once they are re-uploaded.** Every website
  spec and jbrowse-web test config loading `ucsc/<asm>/ncbiRefSeq.gff.gz`
  gains a line on its multi-transcript genes. So do ggjbrowse's methylation
  tutorial and its population_genomics one, whose Cyp6g1 gene track turns
  descriptions off. Read the grow-height figures for track height.
