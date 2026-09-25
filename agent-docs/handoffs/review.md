---
name: review
description: The link-mark round (de0a383e01..c860b6e68f, ADR-163) reviewed on 2026-09-25. Three findings are fixed; a cross-region link breaks at the seam and never joins in a whole-genome view, GPU blocks past displayed region 255 misplace their own foot, and a link whose far end has no record of its own draws in one block only — each a placement design question, with a probe below.
---

# Link-mark review

A review of `git diff de0a383e01^ c860b6e68f` probed the link mark with
throwaway jest tests. Fixed on main since: a far foot on the block's own contig
past a sub-range region now places through that region instead of drawing a
stem, a far foot resolves to the block's own region before any other region
holding it, and the `mate` step's pair key reads both ends' spans, so two loops
sharing only their starts both draw.

## Open, confirmed by probe

1. **A cross-region link breaks at the seam, and in a whole-genome view its
   feet never join.** `packages/render-core/src/marks/linkMark.ts:218` and
   `linkMark.slang:223` pick the dome or the far-circle legs from each block's
   own width (`g.screenW`, `u.blockPxW`), so two blocks holding one pair choose
   differently. Regions of 900 px and 100 px with a pair at px 100 and px 950:
   block 0's ellipse is 47 px high at the seam (px 900), block 1's legs come no
   nearer than about px 938. Twenty 50 px regions with a link from region 0 to
   region 9: block 0 draws a leg from (25,100) to (48.9,−1) and nothing meets
   it. The SVG export shares `paintBlock`, so it has the same seam. Deciding
   from the canvas width, or the pair's span against it, gives every block the
   same shape.
2. **A log size scale with a zero in the domain and a maximum below 1** draws
   every link at the range minimum: `linkStrokeWidthPx(0.4, …, [0, 0.5], log)`
   is 1.5, the floor, through `normalizeScore` (`scoreScale.slang:43`).
3. **A VCF breakend whose ALT spells `chr1` where CHROM says `1`** is not
   collapsed with its partner, so the pair draws twice and each gets a
   whole-region hit box (`markEncoding.ts:451`). The `mate` step runs in the
   worker, which has no alias table; the pair key would need names resolved
   before the RPC.

## Open, traced not probed

4. **A block for displayed region 256 or later places its own foot through an
   out-of-range uniform** (`linkMark.slang:199`, `regionPx(inst.x,
   u.ownRegion, u)` unguarded; only x2 checks `regionCount`). Canvas2D draws it
   right. A whole-genome view of an assembly past 256 contigs hits it.
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
- `website/release_announcement_drafts/v5.0.0.changelog.md:1161` lists a
  lineWidth slot on `LinearPairedArcDisplay`.
- An SV VCF or BEDPE track offers no arcs from the display menu until
  [the default-plot TODO](../todo/a-paired-record-draws-its-links-with-no-config.md)
  lands.
