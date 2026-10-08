---
status: Rejected
summary: "A genotype frequency band above the multi-sample variant display's rows, stacking each variant's share of the drawn rows by genotype class in the cells' own colors, was built, landed and removed on 2026-10-03. Over every drawn row it restates the VCF's own `AF` and what the matrix's columns already show; the reading that tells a biological story is a frequency per group (population, case and control), which bcftools computes per sample-sheet group and a multi-wiggle track draws a row each, with no code in the variant display"
---

# ADR-206: A row display summarizes its rows in a frequency band

## Status

Rejected (2026-10-03). Built in `9e5c57cedc`, removed the same day. The
composition band and per-site summary strip proposals it answered are deleted
with it.

## Context

The haplotype overview mockup in `~/src/gmod/gbz-base-js/tools/overview/render.ts`
draws a strip over its rows stacking, per bin, the share of rows in each class.
The proposal carried that to the multi-sample variant display, and Colin judged
the 2026-09-30 stacked-bar decline did not cover a share of a fixed set of rows.

## What was built

A band directly on the rows, in both layouts, that counted each column's
non-reference cells by class, dosage and painted color, so every color mode
followed with no category table, with a hover naming the counts in the key's
words, a 0–100% axis shared with MAF's conservation band, and its SVG export. It
cost one class byte a cell on the wire and 35 ms per count over 3 million carrier
cells.

## Why it went

- **One band over every drawn row says little the screen does not.** The
  cohort frequency is the VCF's `AF`; the carrier share is how dark the column
  under it is. Its one reading of its own, call rate, the missingness filter and
  the no-call cells already give.
- **The story is a comparison between groups.** The lactase-persistence allele
  at LCT is common in Europeans and rare elsewhere; cases against controls is
  the same picture. Splitting the band by the display's facet would have built
  per-section bands into the variant display's row layout, the bloat a main
  display type should not take on.
- **A group's frequency belongs to standard tools and the generic displays.**
  `bcftools +fill-tags -- -S groups.txt -t AF` writes `AF_<group>` per
  sample-sheet group, and a bigWig per group draws as rows in a multi-wiggle
  track at any zoom.

## Rejected alternatives

- **A band per facet section in the variant display.** Section strips inside
  the rows' scroll, hit test and export, for a picture a multi-wiggle track
  draws already.
- **A `fold` step in the mark display**, Vega-Lite's reshaping of named fields
  into rows, so `AF_<group>` INFO fields draw a row each straight off the VCF.
  Easy, but not needed while the bigWig route covers both the locus and the
  chromosome.
- **Folding INFO with `flatten`.** `flatten` over the whole INFO record fans out
  every tag, and its entry reader takes a list value (`AF=[0.5]`) for a record
  of fields, so the fanned field reads back empty.
