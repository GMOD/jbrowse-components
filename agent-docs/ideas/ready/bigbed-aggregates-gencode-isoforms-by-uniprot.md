---
name: bigbed-aggregates-gencode-isoforms-by-uniprot
description: BigBedAdapter's `aggregateField` defaults to `geneName2`, which GENCODE V50's bigGenePred fills with each isoform's UniProt accession, so a user-added knownGene track draws one gene per accession. The adapter picks the field from the file's autoSql instead.
---

# BigBed aggregates GENCODE isoforms by UniProt accession

## Ruling

BigBedAdapter chooses `aggregateField` from the file's autoSql, the column
named for the symbol, as hubtools chooses it from trackDb. `geneName2` stays
the default for a schema with no such column, so no producer whose files read
well today loses.

`aggregateField` (`plugins/bed/src/BigBedAdapter/configSchema.ts`) defaults to
`geneName2`. In the GENCODE V50 bigGenePred schema (UCSC's knownGene)
`geneName` is the symbol and `geneName2` the UniProt accession, so TP53 draws as
ten genes named P04637, E7EQX7 and so on. The flat transcripts then drop every
label and squeeze toward the 2px row floor.

The hosted configs are fixed at the producer: jb2hubs' hubtools sets
`aggregateField` from a bigGenePred's label field
(`bigGenePredAggregateField` in `hubtools/src/featureDisplay.ts`), so
`hg38-knownGene` aggregates on `geneName`. A bigGenePred a user adds by hand
still gets `geneName2`.

`geneName2` is the readable name in other schemas, which is why the ruling
reads the autoSql rather than changing the default.
