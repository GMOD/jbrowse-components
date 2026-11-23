---
status: Proposed
summary: "In phased mode an alt cell's hue is its allele's frequency rank at the site: alt blue, the old red, then six more, the rarest sharing the last; the key names an allele where one hue stands for it. No setting"
---

# ADR-284: A phased alt cell takes the hue of its allele's frequency rank

## Status

Proposed (2026-11-23). Refines the "per-haplotype allele identity" hue of
`reference/VARIANTS_DISPLAY.md`'s composition rule; leaves
[ADR-161](adr-161-a-variant-color-preset-is-a-field-and-cells-take-any-record-field.md)'s
`encoding.color` and
[ADR-203](adr-203-the-variant-cells-hue-resolves-on-the-main-thread.md)'s
split as they are: the allele hue is per cell, so it stays the worker's, as a
phase-set hue does.

## Context

- A haplotype row painted reference grey, the site's most frequent alt the alt
  blue and every other alt one red (`SECONDARY_ALT_COLOR`). The allele scale
  had three levels whatever the site held.
- `minigraph --call` writes one record per bubble with a symbolic allele per
  path. At rice Pup1 (chr12:15,866,609, nine alleles) seven insertions of 46
  to 89 kb drew as one red block, and at fly Cyp28d1 five alleles did. The
  two tutorials told them apart with callouts.
- Nothing in the file is lost by the display otherwise: the hover's "Alleles"
  row names the allele, and "Sort rows by genotype here" already groups rows
  by it.

## Decision (proposed)

- **The hue is the allele's frequency rank among the site's alts**
  (`shared/alleleHues.ts`). Rank 0 is `ALT_HUE` and rank 1 the old red, so a
  biallelic or triallelic site paints exactly as before. Ranks 2 to 7 are dark
  green, lavender, salmon, mint, maroon and navy; an alt ranked past the
  palette shares the last.
- **Ranks 2 to 7 take no color of the SV type preset.** The records band paints
  SV classes one band above the rows, so a shared color would read as an SV
  class. `alleleHues.test.ts` holds each of them 20 CIEDE2000 or more from
  every preset color, from each other and from the reference, no-call and
  unphased fills. The first draft (green, purple, orange, cyan, pink, brown)
  failed it: its orange, cyan and brown equalled the inversion, breakend and
  CNV colors, and its purple sat near the insertion purple.
- **The order is `AlleleSummary.altOrder`**, which replaces
  `mostFrequentAlt`: carried alts by count over every sample in the file,
  ties in file order, `*` last. It does not follow the rows shown, so hiding
  or filtering rows recolors nothing.
- **The key lists a row per hue painted on screen**, read off
  `featureCategories` (now 16 bits: a bit per allele slot past the first). A
  row names its allele, with the path length `INFO/ALEN` states for it ("766
  bp path", the allele's length through the graph rather than an event size),
  where every cell in that hue is one allele of one record; otherwise it names
  the rank. A spanning deletion `*` is named "spanning deletion".
  The first hue is named only where its one record is multiallelic, so the
  biallelic key is still "Reference, Alt allele".
- **Sample rows are unchanged.** There lightness is the dosage of one alt hue,
  and `1/2` has two alleles for one cell; the per-alt matrix columns carry
  which.
- **Under phase-set coloring** an alt with no phase set takes its allele hue,
  as it took blue or red, keyed as one row of swatches.
- **No setting.** A plain `encoding.color` value still paints every alt one
  color.

## Consequences

- `SECONDARY_ALT_COLOR` and `KeyedVariants.hasSecondaryAlt` are gone;
  `FilteredVariant` and `VariantFeatureInfo` carry `altOrder`, and the info
  `alleleBp` for a multiallelic record stating `INFO/ALEN`.
- A site with nine or more carried alts still shares one hue among its
  rarest; the hover names those.
- The tutorial figures' callouts for allele lengths can go once reshot.
- A name can turn into a rank label as the view pans: once a second
  multiallelic record painting the same hue comes into view, that hue stands
  for two alleles and its row reads "2nd most common".
- The second hue stays the SV preset's deletion red, so a deletion record in
  the records band and a rank-1 cell below it can share a color one band apart;
  the key heads each section.

## Alternatives

| Alternative | Why not |
| --- | --- |
| Hue by ALT index (file order) | the commonest alt of a site is often not allele 1, so the bulk of a column would leave the alt blue and a biallelic-looking site would change color; the shared last hue would fall on whichever alleles the file lists last, not the rarest |
| A `colorBy: allele` setting or menu radio | the old picture is the new one wherever a site has two alts or fewer, so the choice would only reproduce a collision |
| Color by the allele's stated length (`ALEN`) on a ramp | one producer's INFO field; two alleles of one length (Pup1's two 39 bp paths) would merge, and a ramp reads as order where the alleles are a nominal |
| Hash the allele to a hue, as the phase-set wheel does | unbounded hues land on the no-call and reference fills and on each other; rank keeps the commonest on blue |
| Re-lit laps of the palette past eight | lightness is the dosage channel in sample rows, and sixteen cell fills are not told apart at row height |
| A dedicated grey for the alts past the palette | grey is the reference and near-black the unphased fill |
| One legend row with a strip of swatches | says nothing about which allele is which where the view could name them |
| Name the allele on every row always | with several multiallelic records on screen a hue stands for a different allele at each |
