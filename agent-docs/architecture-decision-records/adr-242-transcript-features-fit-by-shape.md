---
status: Accepted
summary: "A gene track's `proteinFeatures` becomes `transcriptFeatures`: a list of tracks whose genome-placed rows draw on each transcript they fit, in one shared color with one key. A row fits when each of its merged blocks lies in one of the transcript's CDS pieces (`on: 'cds'`) or exons (`on: 'exon'`), within a codon, and it skips no exon between its first block and its last; an optional `join` narrows the fit to the transcript the row names. UniProt's genome-mapped bigBeds and UCSC's Pfam-in-GENCODE carry no transcript column, so a key join alone could not draw them. Amends GRAMMAR_OF_GRAPHICS.md's 'no lookup join' for the canvas display"
---

# ADR-242: Transcript features fit by shape

## Status

Accepted (2026-10-24). Replaces the `proteinFeatures` slot, which shipped
only in betas. An audit and four model reviews shaped it. One review measured
the rule against UniProt and Pfam-in-GENCODE rows over chr17:7–9 Mb on GENCODE
V50.

## Context

`proteinFeatures` drew one track's BED12 rows over each transcript's CDS,
pairing a row with a transcript by a key: the row's `transcript` column equal
to the transcript's `id`. Only `jbrowse make-protein-features` writes such a
column. The hosted hg38 config carries fifteen UniProt bigBeds (domains,
signal peptides, transmembrane helices, chains, modified residues, variants),
keyed by UniProt accession, and UCSC's Pfam-in-GENCODE, keyed by nothing. A
GTF gene track's transcripts have no `id` at all. Each got a silent blank.

## Decision

- **`transcriptFeatures: { tracks: [{ track, on, join, filter }], encoding:
  { color } }`**, a bare list naming the tracks. The rows of every track share
  one color and one key, the merged legend's shape.
- **A row fits by shape.** Its blocks are merged first, since the BED gene
  heuristic splits a row at its thick ends and UniProt writes abutting
  blocks. Each block must lie in one part of the transcript (its CDS pieces
  for `on: 'cds'`, its exons for `on: 'exon'`), allowing 3 bp of overshoot,
  which is clipped off what draws. The parts the blocks land in must run
  without a gap, so a row refuses an isoform that skips one of its exons or
  holds an extra one between them. A block may end inside its exon: Pfam's
  alignment gaps are genome gaps. A single-block row reduces to containment.
- **`join` narrows the fit**: key equal, where a field is named, and shape
  compatible. GENCODE's UniProt accession matches 17 TP53 transcripts, of
  which 6 have the shape, so the two together are the rule.
- **A row repeating another's name and drawn blocks on one transcript draws
  once.**
- **A track whose rows met coding transcripts here and fit none gets a
  notice**, which a key on the wrong field or rows built against other gene
  models cause. A row missing an unrelated transcript stays quiet.
- **A track's `filter`** takes the display's predicate list, so UniProt's
  TrEMBL rows can go.
- **A BED whose header names `proteinStart` and `proteinEnd`**, as
  `make-protein-features` writes, skips the gene heuristic, so its own track
  draws plain blocks with no `disableGeneHeuristic`.

## Rejected

| Proposal | Why not |
|---|---|
| Interior block edges equal to exon edges, ±2 bp | Rescued 2 of 671 multi-block rows; Pfam-in-GENCODE's alignment gaps and 3 bp overshoots fail it |
| A frame check (row start at CDS offset ≡ 0 mod 3) | Removed no row on the measured data |
| `by: 'id' \| 'compatible'` as alternatives | Neither alone is right; a key match with the wrong shape draws on the wrong exons |
| A color per track: one value lane plus a per-rect channel tag | The tag adds back the filtering it removes, and N keys split the legend |
| A tick mark for single-codon rows | Rects already draw at least 2 px (`rect.slang`) |
| A representative-isoform option for the rows | `geneGlyphMode: 'longestCoding'` already draws one isoform per gene |
| Projecting protein-coordinate records in the worker | A second producer, not a rival; waits for a source that has no genome placement |
| The name `overlays` | `overlay` is already a `subfeatureLabels` value and a wiggle layout |
