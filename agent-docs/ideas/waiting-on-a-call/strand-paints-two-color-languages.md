---
name: strand-paints-two-color-languages
description: Strand is tomato/cornflowerblue on features, marks and synteny but #EC8B8B/#8F8FD8 on reads; one hue pair in palette.ts, at a fill weight and a mark weight, would make a forward strand one color everywhere. Waits on which hues, judged on captures.
---

# Strand paints two color languages

Two pairs say "forward" and "reverse":

- `UNIVERSAL_FIELD_PRESETS.strand` (`packages/core/src/util/colorScale.ts`):
  `tomato` / `cornflowerblue`. Every display offering Color by → Strand reads it
  (features, marks, multi-row), and synteny's strand scheme takes its range
  (`packages/synteny-core/src/colorUtils.ts`, `forwardStrandColor`).
- `colorFwdStrand` / `colorRevStrand` (`packages/core/src/ui/palette.ts`):
  `#EC8B8B` / `#8F8FD8`, the alignments read fills, and the strand of a splice
  junction.

So a gene track and the reads under it, both colored by strand, paint the
forward strand two different reds.

## Proposal

One strand hue pair, declared in `palette.ts`, with two weights: a pale fill for
large areas (a read body, where mismatches draw on top) and a saturated mark
weight for thin glyphs and ribbons. The universal preset and synteny read the
mark weight, alignments the fill weight. The two weights differ in lightness
only, so they read as one statement.

## What deciding it involves

- which hues: the read pair's (hue 0° / 240°) or the preset's (9° / 219°);
- before/after captures of a feature track over a pileup, a synteny ribbon
  colored by strand, and the multi-row display;
- the legend swatches follow, since both read the same constants.

Related: `ready/multi-row-color-by-strand-takes-fixed-colors.md`.
