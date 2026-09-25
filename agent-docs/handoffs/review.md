---
name: review
description: The link-mark round (de0a383e01..c860b6e68f, ADR-163) reviewed on 2026-09-25. The seam, the 256-region foot, the per-block drawing that cut a link into pieces, and the display menu offering no arcs are fixed; open are a log size scale below 1, an alias-spelt breakend pair inside one region, the circular ring's link placement, and a far circle's hover box.
---

# Link-mark review

A review of `git diff de0a383e01^ c860b6e68f` probed the link mark with
throwaway jest tests. Fixed since: a link's shape reads the view's width; a
region's own foot places through a uniform of its own, so a region past the
256-entry table places; a far foot resolves to the block's own region first;
the `mate` step's pair key reads both ends' spans; and a link draws over the
whole canvas once per curve (ADR-163), so it crosses regions holding neither
foot and a record whose far end has none draws whole.

## Open

1. **A log size scale with a zero in the domain and a maximum below 1** draws
   every link at the range minimum: `linkStrokeWidthPx(0.4, …, [0, 0.5], log)`
   is 1.5, the floor, through `normalizeScore` (`scoreScale.slang:43`).
2. **A VCF breakend pair whose ALT spells `chr1` where CHROM says `1`, both
   records in one region**, draws twice: the `mate` step's key reads raw names
   in the worker, and the display's owner pass (`linkOwners.ts`) keeps every
   copy inside the owning region. Across two regions it pairs through the
   aliases.
3. **On a circular ring the link regions are off by the slice spacing**:
   `linkRegions` sums bp, while the ring host lays slices out with
   `spacingPx` between them (`circular-view/src/CircularView/slices.ts`), and
   a link across the strip's wrap point domes around the whole ring. Traced,
   not probed.
4. **A far-circle link's hover box is its whole bounding box** (852 px wide,
   the full band high) while two short legs are drawn.
5. **The GPU pass speckles a dome's stroke** at a few spots on WebGL2
   (SwiftShader) where Canvas2D draws clean, in `sdEllipse`'s fragment
   distance, which the view-scope draw leaves unchanged.

## Leftovers of the arc plugin

- `website/scripts/figure-manifest.json:236` still names
  `LinearPairedArcDisplay` in `cancer_sv/k562_amplicon_dna`'s live url; the
  spec is rewritten, so `audit-figures` regenerates it.
