---
status: Accepted
summary: "A `cells` transform step replaces each aligned row with its runs of columns against the reference, one feature per run in one `state` (`match`, `mismatch`, `gap`) on the row's reference span, a mismatch run carrying its `base` and a match or mismatch run `match` as 1 or 0. The reference is the same field on the feature the row was fanned out of, so the step stands behind `flatten` and names no second field. It walks every column and merges runs by state and mismatched base; a reference gap is no cell, and a gap run reaching either end of the row is no cell, as the MAF display's painters already rule. Sub-pixel sampling and an identity through `bin` stay outside it"
---

# ADR-187: A `cells` step reads a row against the block it came from

## Status

Accepted (2026-09-28). The second item of
[maf-onto-marks](../handoffs/maf-onto-marks.md), behind
[ADR-186](adr-186-flatten-fans-out-a-record-keyed-by-name.md)'s species rows.

## Context

The MAF display's base view is one run per stretch of same-coloured cells per
species row, which `buildMafChannels` walks on the main thread off the
block's reference text and each row's aligned text. With the species rows on
the mark display, nothing turned a row's `seq` into drawable runs: a span
over the row painted its whole block, and a mark cannot read inside a string.

Two shapes were open for the step. It could name two fields, the row's and
the reference's, or it could read the reference off the feature the row was
fanned out of. The flattened row shadows its block's `seq` with its own, so
the reference text is reachable by no field name from the row, and giving
`MafFeature` a second name for the same string is a representation added for
one consumer.

## Decision

- **`cells` reads its `field` (`seq`) on the row and on the row's parent.**
  A `FlattenedFeature` and the `DerivedFeature` over it answer `parent()`,
  which is the block. A feature with no parent, or with no text on either
  side, answers no cells.
- **One feature per run, merged by `state` and, on a mismatch, `base`**, so
  a conserved stretch is one instance and each differing base its own. The
  run is a `DerivedFeature` over the row, so `species`, `chr`, `strand` and
  the rest read through, and `rows: "species"` keys the runs as it keyed the
  rows. The fields written are `state`, `base` on a mismatch, and `match` as
  1 or 0 where the column has a base on both sides. `CELLS_FIELDS` lists
  them for the field pickers and the rule list.
- **The MAF painters' column rules carry over**: case folds before the
  comparison, `-` and space are gaps, a reference gap holds no genomic
  position and is skipped, and a gap run reaching either end of the row is
  the block's cut rather than the alignment and paints nothing
  (`alignedExtent`). The cross-block flank that rescues a real gap at a seam
  (`rowFlank`) needs the neighbouring block, which a step over one feature
  has not got.
- **Every column is walked.** The MAF display samples one base per window
  once a base is under half a pixel (`binBp`); the step does not, since a
  transform has no zoom, and a mark over cells takes a `maxBpPerPx` where
  the summary should take over.

## Consequences

- A `span` coloured by `state` over `rows: "species"` is the MAF display's
  mismatch view, and a `text` over `base` at base zoom its letters. The
  `marks_maf_cells` track in the volvox marks config and the
  `mark-maf-cells` scene draw both.
- **Identity through `bin` and `aggregate mean` is not right yet.** `bin`
  snaps a feature to the bin its start falls in, so a 500 bp match run
  counts once, in one bin. A length-weighted mean needs a `bin` that splits
  an interval at its edges, or the cells left unmerged, before `match`'s
  mean is the identity. The handoff carries it.
- Insertions against the reference are skipped, not emitted; an interbase
  glyph for them is the handoff's item 8.
