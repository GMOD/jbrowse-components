---
status: Accepted
summary: "The alignments read categories `split`, `spliced`, `pairing` and `svSignal` are color fields the main thread bakes per read from `readCategoryBits`, `readFlags` and `readPairOrientations`, so picking one recolors what is loaded with no refetch, where the worker's attribute path refetched. Each paints the levels a facet over it sections by, in colors from `palette.ts` chosen by dE against every alignments slot, and its baseline level (unsplit, unspliced, concordant, no evidence) keeps the plain fill. `svSignal` becomes a facet dimension, a chain taking its strongest record. Color by lists SV evidence and Pairing; `split` and `spliced` get a row only while they paint"
---

# ADR-230: Read categories color on the main thread

## Status

Accepted (2026-10-16), from the alignments grammar-of-graphics pass, whose
calls Colin left to the agent, and two review rounds.
Builds Idea 3 of
[`ideas/ready/category-filters-leave-coverage-whole.md`](../ideas/ready/category-filters-leave-coverage-whole.md).

## Context

- **`svSignal` (ADR-229) could filter and sort but not color or facet.** Idea
  3 asked for a color field that paints the reads without evidence grey.
- **`color: { field: 'split' }` already worked, poorly.** The color bake reads
  any facet dimension's keys through `fieldValueReader`, so `split`, `spliced`
  and `pairing` took the worker's attribute path: a refetch on every switch,
  hashed colors with no neutral level, and raw keys (`unsplit`) in the key.
- **The answers were on the main thread already.** `readCategoryBits` carries
  the split, spliced and SV-tier bits, and `pairingOf` reads the flags and the
  pair orientation every fetch ships.

## Decision

- **Four color schemes, baked on the main thread.** `split`, `spliced`,
  `pairing` and `svSignal` take the CPU-baked `tag` body. `readLevels.ts`
  reads a small code per read and paints it through a packed table, and the
  key's present levels are a bitmask scan, so a recolor allocates no string
  per read and a switch among the four refetches nothing (`workerColorBy`'s
  oracle test).
- **A level is named as the facet names it.** `svSignal`'s levels are
  `splitRead`, `svIndel`, `discordantPair` and `none`. They need both ends
  placed, so they name narrower read sets than `split: 'split'` and
  `pairing: 'discordant'`, and the words differ.
- **The baseline keeps the plain fill.** An unsplit, unspliced, concordant or
  no-evidence read bakes 0 and takes `noTagValue`, keyed under its level's
  name; `color.domain` naming the baseline colors it.
- **Colors come from `palette.ts`.** A split piece takes
  `colorSupplementary`, the color the pair schemes already give one; the rest
  are new slots picked by dE against every alignments color (nearest 29.6).
  A written `domain` alone reorders the levels and keeps each one's own color
  and name.
- **`svSignal` is a facet dimension**, and a chain takes its strongest
  record's level, as the filter keeps a chain by.
- **Color by lists SV evidence and Paired end → Pairing.** `split` and
  `spliced` have no standing row, and show one, checked, while they paint.

## Consequences

- A v5 config that wrote `color: { field: 'split' }` keeps working; its
  unsplit reads now take the plain fill.
- Under `unit: 'chain'` a section keys the whole chain while each record
  keeps its own color, so a split section shows which piece split.
- The display and the tables engine read the painted values through one
  `presentBakedValues`.

## Rejected alternatives

- **Okabe-Ito colors.** The first build used them; measured against the arc
  palette they sat dE 15.0 from `colorShortInsert` and 19.5 from
  `colorInterchrom`, the strokes drawn over these fills.
- **New read color categories with shader palette slots.** The `tag` body
  already paints one color per read; a category per level would add RC slots
  for four fields that switch without a refetch either way.
- **Standing radios for `split` and `spliced`.** SV evidence already paints
  every placed split read, and on RNA-seq a spliced color paints most of the
  pileup; Group by and Sort by answer both.
- **One read-field table every channel reads.** The color bake already reads
  any facet dimension, so the gap was `svSignal` alone.
