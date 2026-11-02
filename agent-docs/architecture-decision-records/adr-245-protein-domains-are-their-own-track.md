---
status: Accepted
summary: "Protein domains draw as their own track in the multi-row display, a row per transcript: domains2genome --gff3 writes each coding transcript as an mRNA with its exons, CDS and its domains as protein_match children, and the display's default plot draws the transcript in greys with the domains over it, colored by family. A gene track draws no other track's rows and no domain children: transcriptFeatures (ADR-242) and the proteinFeatures key join before it are deleted. The projection from protein residues onto exons is domains2genome's, which the tutorial runs itself; the JBrowse CLI wraps none of it. Supersedes ADR-242"
---

# ADR-245: Protein domains are their own track

## Status

Accepted (2026-10-25), amended 2026-11-01. Supersedes ADR-242. Neither
`proteinFeatures` nor `transcriptFeatures` reached a release
(`v5.0.0-beta.17` predates both), so nothing migrates.

The amendment: the domain track carries its transcripts. As first accepted,
the track held domains alone and a reader paired each row with its isoform in
the gene track by name, through two tracks that order isoforms differently.

## Context

Three designs drew domains on the gene glyph in two days: a key join on the
row's `transcript` column, a fit by exon shape (ADR-242), and a plan to write
each domain into the gene GFF under its mRNA. Each served one tutorial figure,
vav's isoforms with their Pfam domains. The hard part, placing
protein-coordinate calls on the exons across introns and on either strand, is
`domains2genome`'s, and needs no gene-track code.

## Decision

- **The domain file carries its transcripts.** `domains2genome --gff3` (2.4)
  writes each coding transcript as an `mRNA` with its `exon` and `CDS` lines,
  and each domain on it as a `protein_match` child. The transcript and its
  domains come from one run, so they cannot drift apart, and the `Parent`
  says which transcript a domain sits on, with no column to join. The file is
  valid GFF3; `gt gff3validator -typecheck so` rejects it, since SO makes no
  `protein_match` part of an mRNA, and its job is display, not interchange.
- **The multi-row display draws it by default.** Where a scanned transcript's
  children include a `protein_match`, `multiRowPlot` draws a row per
  transcript: its span as a line, its exons and CDS in two greys, and the
  matches over them at the Normal row height. The grey marks state their own
  color, so the display's `encoding.color`, which Color by writes, reaches
  the matches alone, by `name` (the family) unless the config says otherwise.
- **The gene track stays the navigator.** It collapses to one transcript per
  gene zoomed out, where the domain track's rows follow the transcripts in
  the window. The tutorial sets no label or height mode on it.
- **domains2genome's BED stays its default output**, the portable form IGV and
  UCSC draw. A multi-row track over it (`proteinStart` and `transcript`
  columns) defaults to a row per `transcript`, colored by `name`.
- **A gene track draws only its own file.** The worker fetches no other
  track, and the glyph has no domain lanes, domain color or domain hit.
- **A BED whose header names `proteinStart` and `proteinEnd`** still skips
  the gene heuristic, so the domain track draws plain blocks with no
  `disableGeneHeuristic`.
- GRAMMAR_OF_GRAPHICS.md's "no `lookup` join" loses its ADR-242 exception.

## Rejected

| Proposal | Why not |
|---|---|
| `proteinFeatures`: a gene track joins one track's rows on their `transcript` column | Only domains2genome writes the column, and a join across tracks is the lookup the grammar declines |
| `transcriptFeatures` (ADR-242): rows from listed tracks fit by exon shape | A render-time guess with tolerances; the worker opened every listed adapter per fetch, and a click could open the wrong track's details |
| `domains2genome --cds`: each transcript's CDS as a BED12 row beside its domains, a `kind` column telling them apart | Two record kinds in one table: the CDS rows padded the domain columns with `-`, and a domain met its transcript only through a string column. GFF3 states both the kinds and the relation |
| Domains as GFF children of each mRNA in the user's own gene file, drawn in the gene glyph | No annotation pipeline writes it, `gt gff3validator -typecheck so` rejects it and gffread drops the lines; users replace their gene track with our merged copy and cannot add domains to a hosted one; a gene with no mRNA, overlapping InterProScan analyses and GTF input each need a rule. The mRNA parent comes only from gff-nostream merging a CDS's lines once it has children; a parser that merges only abutting CDS segments is the first step if this returns |
| The SO-strict form: a `polypeptide` that `Derives_from` the mRNA, domains under it | gff-nostream ignores `Derives_from`, so it draws as a separate feature |
| Domain rows in the gene track's isoform order | The order is the gene track's layout, which another track can read only through the cross-track join this ADR declines. Moot since the domain rows carry their transcripts |
| `jbrowse make-protein-features`, a CLI command around domains2genome | It added only bgzip and tabix, which the tutorial's readers have, and each domains2genome release needed a CLI bump to reach it. Deleted before a release |
| Fit-by-shape as an offline CLI step for UniProt's and UCSC's genome-placed BEDs | Those already draw as their own tracks; nobody has asked |
