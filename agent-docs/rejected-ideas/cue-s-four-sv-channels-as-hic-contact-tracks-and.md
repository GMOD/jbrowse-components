---
name: cue-s-four-sv-channels-as-hic-contact-tracks-and
description: Cue's four SV channels as `.hic` contact tracks, and the tutorial built on them
area: data-and-demos
---

# Cue's four SV channels as `.hic` contact tracks, and the tutorial built on them

the tutorial, its two build scripts under scripts/, its demo config
and five figures, all deleted on 2026-08-31 (grep the history for
sv_contact_maps). Cue (Popic et al. 2023) images a locus as a square
with genome interval on both axes and one channel per signal, and a binned
channel IS a contact matrix, so the encoding maps onto `HicTrack` with no new
code. It was built, measured and then removed, and the pair channels are the
half that worked. **The depth channel is the half that does not, and it is why
the page went.**

Its cell is `|depth[a] - depth[b]|`, which fails four independent ways on real
human WGS. Measured on the demo's own chr5 slice of the GIAB HG001 300x BAM:

- **Mappability swamps it, at every bin size.** The share of cells with no
  relation to the call that are as dark as the median boundary-crossing cell:
  10.5% at 750 bp, 11.2% at 1.5 kb, 11.1% at 3 kb, 11.1% at 6 kb. The noise is
  spatially correlated and does not average away, so coarsening buys nothing —
  do not reach for `resolutionBias` to fix a plaid.
- **It has no valid coarse resolution.** juicer `pre` SUMS the fine cells into
  a coarser bin, and a sum of absolute differences is not the absolute
  difference of the sums. Every level above the base bin is wrong by
  construction, which also rules out the multi-resolution `.hic` doing the
  zooming for you.
- **It is dense, O(n x reach).** Full reach over 5 Mb at 750 bp bins is 44M
  records against 2.7M at the 400-bin reach the script shipped.
- **That reach is a hard cap on what it can represent.** `--max-bin-span 400`
  is in BINS, so at `--bin 750` a junction wider than 0.30 Mb gets no cell
  written at all. The pair channels have a `min_span` floor and no ceiling, so
  only the depth channel is capped.

**And at the scale where it would matter it is redundant.** A copy-number
block over 1 Mb is a step you can read off a BigWig, which is multi-resolution,
range-queryable and already what `sv_visualization.md` §"Working with large
SVs" recommends.

The dataset was against it too: the three loci are 18-43 kb, and **only chr7
has junction pairs at all**, so a page about read-pair channels demonstrated
them once and showed empty panels twice. The demo was also never deployed —
every `jbrowse.org/demos/sv_contact_maps/` URL 404'd for the page's whole life.

**What survived, and where it went**: the feature worth having was
`groupBy: pairOrientation` with arcs — one band per orientation class — which
was already documented in `user_guides/sv_visualization.md` §"SV channels" and
`user_guides/alignments_track.md` §"Grouping reads", on a better locus (an
HG02768 INVdup whose same-strand bands actually hold bundles). It gained
`diagrams/sv_channels_bands.svg` in the same pass.

**What would earn a second attempt**: a page about SVs too large to load reads
for, on a dataset with megabase-scale events, built on the PAIR channels only
— sparse, one cell per junction, no span cap — beside a BigWig for depth. The
contact triangle's required height is `(span / window) x 743 px`, independent
of absolute size, so it is scale-free and the geometry is not the obstacle.
Rebuilding the depth-difference channel is what to avoid.
