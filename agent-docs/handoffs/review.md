---
name: review
description: The link-mark round (de0a383e01..c860b6e68f, ADR-163) reviewed on 2026-09-25. Five findings are fixed, the seam between two regions and the 256-region foot among them; open is that each block draws only its own payload, so a link crossing a region that holds neither foot, or whose far end has no record, draws in pieces — a placement design question, with probes below.
---

# Link-mark review

A review of `git diff de0a383e01^ c860b6e68f` probed the link mark with
throwaway jest tests. Fixed on main since: a link's shape reads the view's
width rather than each block's, so the halves of a link across two adjacent
regions join at the seam; a block's own foot places through a uniform of its
own, so a region past the 256-entry table places; a far foot on the block's own contig
past a sub-range region now places through that region instead of drawing a
stem, a far foot resolves to the block's own region before any other region
holding it, and the `mate` step's pair key reads both ends' spans, so two loops
sharing only their starts both draw.

## Open, confirmed by probe

1. **A link draws only in the blocks holding its feet**, each clipped to its
   column. A view sliced into many regions (a whole-genome view, a
   multi-locus search) shows the curve's ends as stubs, with nothing over the
   regions between: volvox.bedpe over ctgA and ctgB cut into 500 bp slices.
   The same cause as 5 below.
2. **A log size scale with a zero in the domain and a maximum below 1** draws
   every link at the range minimum: `linkStrokeWidthPx(0.4, …, [0, 0.5], log)`
   is 1.5, the floor, through `normalizeScore` (`scoreScale.slang:43`).
3. **A VCF breakend whose ALT spells `chr1` where CHROM says `1`** is not
   collapsed with its partner, so the pair draws twice and each gets a
   whole-region hit box (`markEncoding.ts:451`). The `mate` step runs in the
   worker, which has no alias table; the pair key would need names resolved
   before the RPC.

## Open, traced not probed

5. **A link whose far end has no record draws only in the block that fetched
   it.** A `<TRA>` with CHR2/END is one feature on chr1, so the chr2 block has
   nothing to draw; a single-ended BND likewise. A `<DEL>` spanning POS..END is
   fetched into a second region of its contig and drawn there through
   extrapolation, from a different ellipse than region 0's half. Each block
   drawing the instances of other payloads whose `x2Region` is its own would
   close both.
6. **A far-circle link's hover box is its whole bounding box** (852 px wide,
   the full band high) while two short legs are drawn.

## Leftovers of the arc plugin

- `website/scripts/figure-manifest.json:236` still names
  `LinearPairedArcDisplay` in `cancer_sv/k562_amplicon_dna`'s live url; the
  spec is rewritten, so `audit-figures` regenerates it.
- An SV VCF or BEDPE track offers no arcs from the display menu until
  [the default-plot TODO](../todo/a-paired-record-draws-its-links-with-no-config.md)
  lands.
