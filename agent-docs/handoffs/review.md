---
name: review
description: Open findings of two 2026-09-25/26 reviews nobody has taken up. Link mark (ADR-163) - a log size scale below 1, an alias-spelt breakend pair inside one region, the circular ring's link placement, a far circle's hover box. domainQuantile (ADR-179) - no range check, and Clip outliers re-ticking at the default.
---

# Open review findings

## Link mark (ADR-163)

1. **A log scale whose domain bottom is 0 or below floors at 1.** A link's
   `linkStrokeWidthPx(0.4, …, [0, 0.5], log)` is 1.5, the range minimum, since
   `normalizeScore` (`scoreScale.slang:48`) takes 1 as the floor and a maximum
   below 1 collapses the domain; the scan should take the least positive
   value on a log scale.
2. **A VCF breakend pair whose ALT spells `chr1` where CHROM says `1`, both
   records in one region**, draws twice: the `mate` step's key reads raw names
   in the worker (`featureTransforms.ts`), and the owner pass (`linkOwners.ts`)
   keeps every copy inside the owning region. Across two regions it pairs
   through the aliases.

Items 1 and 2 are real in code and triggered by nothing in the repo, an hour
or two each.
3. **On a circular ring the link regions are off by the slice spacing**:
   `viewRegionTable.ts` sums bp, while the ring host lays slices out with
   `spacingPx` between them (`circular-view/src/CircularView/slices.ts`), and a
   link across the strip's wrap point domes around the whole ring. Reached by
   default through `config_demo`'s dbsuper track. About half a day; the dome
   needs a call first — chords on the circle, or no links on a ring.
4. **A far-circle link's hover box is its whole bounding box** (852 px wide,
   the full band high, `linkMark.ts`'s `curveBox`) while two short legs are
   drawn. About half a day, and `ink` has to return several boxes.

## domainQuantile (ADR-179)

- No range check: 99 typed as a percent reads as the extremes, as 1 does, and
  anything under 0.5 as 0.5 (`quantileExtent.ts`). Only a hand-typed value
  reaches it.
- Clip outliers re-ticks at the scale's default, not a value a config wrote
  before the untick (`scoreMenuItems.ts`); the help text names the one in
  force.

Both are under an hour, and nothing reaches either by default.
