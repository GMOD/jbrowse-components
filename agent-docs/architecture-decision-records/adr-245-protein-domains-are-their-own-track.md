---
status: Accepted
summary: "Protein domains draw as their own track, one row per transcript, from `jbrowse make-protein-features`' BED in the multi-row display with `rows: 'transcript'`. A gene track draws no other track's rows and no domain children: transcriptFeatures (ADR-242) and the proteinFeatures key join before it are deleted, and the GFF-children plan is declined. The projection from protein residues onto exons stays in the CLI. Supersedes ADR-242"
---

# ADR-245: Protein domains are their own track

## Status

Accepted (2026-10-25). Supersedes ADR-242. Neither `proteinFeatures` nor
`transcriptFeatures` reached a release (`v5.0.0-beta.17` predates both), so
nothing migrates.

## Context

Three designs drew domains on the gene glyph in two days: a key join on the
row's `transcript` column, a fit by exon shape (ADR-242), and a plan to write
each domain into the gene GFF under its mRNA. Each served one tutorial figure,
vav's isoforms with their Pfam domains. The hard part, placing
protein-coordinate calls on the exons across introns and on either strand, is
`make-protein-features`' and `domains2genome`'s, and needs no gene-track code.

## Decision

- **The domain BED is a track** in the multi-row display with
  `rows: 'transcript'`, so each isoform's domains sit on a labelled row under
  the genes, colored by `name` with the display's own key.
- **A gene track draws only its own file.** The worker fetches no other
  track, and the glyph has no domain lanes, domain color or domain hit.
- **A BED whose header names `proteinStart` and `proteinEnd`** still skips
  the gene heuristic, so the domain track draws plain blocks with no
  `disableGeneHeuristic`.
- GRAMMAR_OF_GRAPHICS.md's "no `lookup` join" loses its ADR-242 exception.

## Rejected

| Proposal | Why not |
|---|---|
| `proteinFeatures`: a gene track joins one track's rows on their `transcript` column | Only `make-protein-features` writes the column, and a join across tracks is the lookup the grammar declines |
| `transcriptFeatures` (ADR-242): rows from listed tracks fit by exon shape | A render-time guess with tolerances; the worker opened every listed adapter per fetch, and a click could open the wrong track's details |
| Domains as GFF children of each mRNA, drawn in the gene glyph | No annotation pipeline writes it, `gt gff3validator -typecheck so` rejects it and gffread drops the lines; users replace their gene track with our merged copy and cannot add domains to a hosted one; a gene with no mRNA, overlapping InterProScan analyses and GTF input each need a rule. The mRNA parent comes only from gff-nostream merging a CDS's lines once it has children; a parser that merges only abutting CDS segments is the first step if this returns |
| The SO-strict form: a `polypeptide` that `Derives_from` the mRNA, domains under it | gff-nostream ignores `Derives_from`, so it draws as a separate feature |
| Fit-by-shape as an offline CLI step for UniProt's and UCSC's genome-placed BEDs | Those already draw as their own tracks; nobody has asked |
