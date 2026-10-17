---
status: Accepted
summary: "A categorical color's deal (ADR-205) keeps the values on screen together apart by perceptual difference: two palette entries are twins under a CIEDE2000 difference of 15 (`DEAL_COLOR_DIFFERENCE`, `colorDifference`) rather than OKLab 0.05, and a value with no free entry takes the entry farthest from the ones it avoids, not its raw hash. A display that deals everything it shows at once (`dealShownKeyColors`, `CategoricalScale.among`) avoids only those values' colors, so a session's earlier values do not use up the palette; the multi-way display deals every lane's genes so. `dealKeyColors`, which the canvas, mark and variant displays call per region, still avoids every held color. Held colors still never move, and the map is still shared per session and never persisted. Amends ADR-205"
---

# ADR-233: A categorical deal keeps the colors on screen apart

## Status

Accepted (2026-10-17). Amends
[ADR-205](adr-205-a-categorical-color-is-dealt-once-on-first-sight.md): its
first decision bullet's twin test and its "past the palette's length, the
hash".

## Context

Coloring the HPRC portal's haplotype lanes by gene name painted three of the
ten genes at GSTT1 green. A measurement against the real deal (palette
investigation, 2026-10-17) found the case typical:

- **The twin test missed most look-alike pairs.** `similarColors`, OKLab under 0.05,
  caught 14 of the wide palette's 57 pairs under CIEDE2000 15 (59 in CSS's D50
  CIELAB), none wider than 9.1. Dark2's and category10's greens, 7.8 apart, were
  not twins.
- **A session's deal fills up.** `held` never shrinks, and a new value avoided
  every slot it held, so after about 40 values a session's deal was the plain
  hash again: 10-gene windows panned through averaged 1.1 pairs of identical
  colors, the rate with no deal at all.
- 97% of 10-gene windows on chr1 had a pair under 15, against 0% for any
  curated qualitative palette the deal draws on (tableau10 18.1, category10
  without grey 16.2, set1 without grey 15.4).

## Decision

- **Twins are entries under `DEAL_COLOR_DIFFERENCE` (CIEDE2000 15) apart.** The
  color scale's `isNear` reads `colorDifference`, cached per pair.
  `similarColors` stays for the callers that ask whether two colors read as
  one.
- **Everything shown deals around itself.** `dealShownKeyColors` hands each
  key the batch it is dealt in (`CategoricalField.colorAmong`,
  `CategoricalScale.among`), and a new value avoids the slots of the batch's
  held values and their twins. Its keys must be every value the display
  shows. `dealKeyColors` and a value dealt alone (`field.color`,
  `scale(value)`) avoid every held slot, as before, since the canvas, mark
  and variant displays deal one region at a time.
- **With no free entry, the farthest.** A value whose every entry is taken
  takes the entry with the largest least difference from the slots it avoids
  (`categoricalScale`'s `distance`), first in slot order on a tie, instead of
  its hash. A scale with no `distance` (the mark display's shapes) keeps the
  hash.
- **The multi-way display deals every lane's genes as one shown batch** before
  any lane paints (`dealGeneColors`), which ADR-205 left to feature order. A
  cluster field deals as it paints.

## Consequences

- At GSTT1 the ten names' least difference goes from 7.8 to above 15. Dealt
  as shown batches, 10-gene windows keep every pair above 15 fresh and while
  panning (measured 16.4 and 16.7 least on chr1).
- **The per-region dealers gain the twin test and the farthest entry, not the
  scoping.** A fresh view keeps its pairs apart, but a long session on the
  canvas, mark or variant displays still runs out of free entries once its
  held values cover the palette. Moving them to `dealShownKeyColors` needs each
  to deal the union of its loaded regions' values, which none assembles at
  deal time today.
- **More values leave their hash.** About 15 values on screen together take
  colors that read apart, against 30 under the old twin test, so 5 of 30
  biotypes dealt one by one keep their hashed color where more did. A gene's
  color depends on the genes the session met it with; ADR-205 accepted that
  for collided values, and it now covers most values.
- **Two values off screen from each other may share a color.** A shown batch
  avoids only its own colors, so a value dealt in one window may take the
  color a value from another window holds, and the two keep it when they later
  meet.
- **Figures recolor** wherever a key had a pair under 15: about half of 5-value
  keys, nearly all keys of 8 or more. Every channel that deals into `held`
  moves (canvas feature color, marks, multi-sample variant cells, multi-way
  genes, synteny text columns); the hash path with no `held` (`categoricalColor`,
  the worker, alignments' baked tag colors) does not.

## Rejected alternatives

- **Scoping `dealKeyColors` itself to its keys.** Built first. The canvas
  display deals each region's values as their own batch, so a second region's
  `snRNA` took the first region's `protein_coding` color and the key merged
  the two (`colorLegend.test.ts`).
- **ADR-160's row dealer** (tableau10 by sorted position, re-lit laps). Best
  fresh numbers, but it moves every value off its hash, which ADR-205 rejected
  for feature colors.
- **Hashing into tableau10 first, or `range: tableau10`.** Both break at the
  tenth value, since tableau10 has nine colors without its grey.
- **Only dealing multi-way's genes in sorted order.** The GSTT1 pair is the
  same in every deal order, so order alone fixes nothing.
- **An OKLab cutoff of 0.11-0.12** in place of CIEDE2000. It tracked perceived
  difference worse (GSTT1 least 14.5, 36% of 10-gene windows with a pair).
