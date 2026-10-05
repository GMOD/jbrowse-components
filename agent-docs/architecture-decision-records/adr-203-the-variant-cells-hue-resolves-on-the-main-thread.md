---
status: Accepted
summary: "The multi-sample variant display's worker reads what the alt cells' hue needs off each variant, and the main thread paints the cells and the lane from it, as ADR-202 has the mark display do. `cellHueOf` says where the hue comes from, the fetch's share (`read`: a field without its scale, a `jexl:` callback whole, the field a setting keeps for the way back under a constant) and how the main thread paints what it read. Each region ships `colorValues`, the distinct values as text, `featureColorValues`, each variant's index into them, and `paintedColorValues`, those a variant with an alt cell carried; the matrix ships them too, with `cellAltDosage`. `paintCellColors` repaints only alt cells through `fill = shade(hue, dosage)`, and hands back the worker's array under the default; cell colours, lane colours and row placement are three computeds, so a recolour re-places nothing and a key label repaints nothing. `shadeByDosage` stops being a fetch input, so the dosage is `altDosageByte` in the cells and the key's het swatch alike. A phase-set hue stays the worker's, since it is per cell"
---

# ADR-203: The variant cells' hue resolves on the main thread

## Status

Accepted (2026-10-01). Carries
[ADR-202](adr-202-every-mark-colour-resolves-on-the-main-thread.md) to the
multi-sample variant display, whose Consequences named it as the one display
still sending its colour encoding in `rpcProps()`.

## Context

The worker baked every alt cell's colour as `cellFill(hue, dosage, shade)`
(`shared/cellFill.ts`), so the whole `color` object and `shadeByDosage` were
fetch inputs: a reordered palette, an edited range, a threshold's cuts, a key
label or the shading checkbox cleared the loaded cells and re-read the VCF. On a
cohort callset that re-read is the slow part of the display.

## Decision

- **`cellHueOf` says where the hue comes from** (`shared/cellHue.ts`), one
  branch deciding both halves, as `markColorOf` does for the mark display.
  Its `read` is the fetch's share of `color`: a field as `{ field }`, without
  its scale, domain, range or labels; a `jexl:` callback whole, since only the
  worker holds the features to run it on; and, under a constant or the
  genotype colours, the field the setting keeps under `scale: 'none'` for the
  way back, so returning to it refetches nothing, as on canvas (ADR-167). A
  kept phase set is not read, since reading one paints it. `hueOf`, `keyOf`
  and `constant` are how the main thread paints what was read.
- **The worker ships values, not colours.** `cellHueReaderOf` reads each
  variant once: a record field's value as `valueText`, the impact tier, or the
  callback's colour. Each region carries `colorValues`, the distinct values,
  `featureColorValues`, each variant's one-based index into them, and
  `paintedColorValues`, those a variant with an alt cell carried. The matrix
  carries the same three and gains `cellAltDosage`. The payload stamps the read
  it answered (`colorRead`), and a payload read for another field paints as
  though it read nothing.
- **`paintCellColors` repaints the alt cells** (`LinearMultiSampleVariantDisplay/paintCells.ts`): in
  allele-count mode every alt cell takes `cellFill(hue, altDosage, shade)`, in
  phased mode the alt cells a hue paints take it and the rest keep the worker's
  allele colours, and every other cell keeps the worker's colour. Under the
  default, no hue with shading on, the worker's array comes back as it is.
  `paintFeatureColors` gives the lane each variant's full-dose hue.
- **Colours, lane and rows are three computeds.** `regionCellColors`,
  `regionFeatureColors` and `placedRegionRows` each read only their own
  inputs, and `perRegionCellMap` joins them, so a recolour re-places no row,
  shading leaves the lane standing, and a reorder repaints nothing. The colour
  input is compared by value (`stableIdentityComputed` over
  `paintedColorEncoding`), so editing the key's title or labels repaints
  nothing.
- **The dosage is the byte.** A cell's dosage crosses as `altDosageByte`, so
  `cellFill` takes the byte and the key's het swatch takes `HET_DOSAGE`, a
  diploid het's 128/255, rather than 1/2.
- **A phase-set hue stays the worker's.** PS is per cell, not per variant, so
  there is no per-variant value to ship.

## Consequences

- An edit that keeps the field refetches nothing: a palette, a domain or
  range, a threshold's cuts, a switch between categorical and threshold, a
  key label, the shading checkbox, and a switch to a constant or the genotype
  colours and back. Naming another field, or a `jexl:` callback, refetches.
- With a hue set, a payload landing or a recolour costs a main-thread pass
  over the non-reference cells, 15-30 ms for 1,000 variants by 3,000 samples
  under jest (the spread is the collector, after a 12 MB copy), beside the
  5-8 ms row placement a landing already paid. The default costs none.
- The worker no longer clears its allele-count style memo per site, since no
  style carries a per-variant hue.
- A region's colour costs 4 bytes a variant and the distinct values as text; a
  matrix cell gains its dosage byte. The genomic layout already shipped it.
- A het in a hue whose lightness rounds differently at 128/255 than at 1/2 is
  one hex unit off its colour before; the default alt hue's het is unchanged.
- A multi-allelic INFO value with one missing member (`AF=0.1,.`) reads as
  `0.1` under a threshold, where it read as no number before, since the value
  crosses as text.

## Rejected alternatives

- **Shipping each cell's exact dosage as a float.** Four bytes a cell, which on
  a 3,000-sample cohort outweighs the colour it would make exact by one hex unit
  at most.
- **Shipping each cell's genotype code** and repainting through the worker's
  styler on the main thread. Phased mode needs each row's haplotype and each
  site's most frequent alt, which is the styler moved rather than the colour.
