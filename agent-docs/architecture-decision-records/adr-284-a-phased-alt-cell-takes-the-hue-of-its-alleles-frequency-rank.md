---
status: Accepted
summary: "In phased mode an alt cell's hue is its allele's frequency rank at the site: blue, the old red, six more, the rarest sharing the last; the key names alleles only where one record painted every non-blue hue, else one strip"
---

# ADR-284: A phased alt cell takes the hue of its allele's frequency rank

## Status

Accepted (2026-11-23). Refines the "per-haplotype allele identity" hue of
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

## Decision

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
- **The key names every allele past blue, or none of them**, read off
  `featureCategories` (now 16 bits: a bit per allele slot past the first).
  - Where one record painted every non-blue hue on screen, as at rice Pup1, each
    hue gets a row naming its allele. Blue is named too where that record is
    also the only one painting it.
  - Otherwise the key reads "Reference", "Most common alt allele", then one row
    of the painted swatches, "Other alt alleles at each site, by frequency".
    So does a record whose rarest alleles share the last hue.
  - Biallelic neighbours painting blue beside one multiallelic record (rice
    qSW5) keep "Most common alt allele" for blue and name the record's other
    alleles, since each of those hues stands for one allele.
  - A sequence allele reads by its ALT index and exact length against the
    reference's ("ALT 17, 2,391 bp (-28 bp)"), a short substitution by its
    bases ("ALT 2, C"), so no two rows read alike. A symbolic allele keeps its
    name and the path length `INFO/ALEN` states ("<X:5>, 67,027 bp path", its
    length through the graph rather than an event size). A spanning deletion
    `*` reads "spanning deletion".
  - A biallelic view's key is still "Reference, Alt allele".
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
- A hue is comparable only within a site and a file: red is the second most
  common alt of whichever site it sits in, and another file's counts deal the
  same alleles differently.
- The named rows give way to the strip as a second multiallelic record pans
  into view, and come back when it leaves; the strip itself does not change
  label while panning.
- The second hue stays the SV preset's deletion red, so the SV key's
  "Deletion" red and a rank-1 cell below it can share a panel, as the single
  other-alt red always could. That is not a regression; the key heads each
  section.

## Alternatives

| Alternative | Why not |
| --- | --- |
| Hue by ALT index (file order) | the commonest alt of a site is often not allele 1, so the bulk of a column would leave the alt blue and a biallelic-looking site would change color; the shared last hue would fall on whichever alleles the file lists last, not the rarest |
| A `colorBy: allele` setting or menu radio | the old picture is the new one wherever a site has two alts or fewer, so the choice would only reproduce a collision |
| Color by the allele's stated length (`ALEN`) on a ramp | one producer's INFO field; two alleles of one length (Pup1's two 39 bp paths) would merge, and a ramp reads as order where the alleles are a nominal |
| Hash the allele to a hue, as the phase-set wheel does | unbounded hues land on the no-call and reference fills and on each other; rank keeps the commonest on blue |
| Re-lit laps of the palette past eight | lightness is the dosage channel in sample rows, and sixteen cell fills are not told apart at row height |
| A dedicated grey for the alts past the palette | grey is the reference and near-black the unphased fill |
| One legend row with a strip of swatches, always | says nothing about which allele is which where the view could name them; taken only where it cannot |
| A row per rank past blue ("2nd most common", ...), named where one record painted that hue | on a human multiallelic VCF (HPRC) the rows churned as the view panned, keys ran to ten rows, and one key mixed allele names with rank labels |
| Name the allele on every row always | with several multiallelic records on screen a hue stands for a different allele at each |
| Name an allele as the hover spells it (`2.42Kbp -> 2.39Kbp`) | two alleles of one record rounded to the same label |
