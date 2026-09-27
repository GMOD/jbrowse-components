---
name: multiway-ribbons-paint-the-darkest-not-the-sum
description: The "starbursts" cluttering the multi-way 17p figure are inversions whose ~150 translucent ribbon tiles cross at one point and stack to near-black; painting each pixel of a gutter with its darkest ribbon instead of the sum of all of them removes them without moving any geometry. A Canvas2D probe shows the look; the call is whether to lose overlap multiplicity, and whether the pairwise synteny view follows.
---

# Multi-way ribbons paint the darkest ribbon, not the sum

## What the 17p clutter is

`multiway_synteny/hg38_vertebrates_17p_break` shows hg38 chr17:15.2–16.4 Mb over
eight lanes. The dark "starbursts" between lanes are **inversions**: ADORA2B,
TTC19, NCOR1, PIGL and UBB run left to right on the human lane and right to left
on the marmoset and rhesus lanes, so their ribbons cross in an X. That crossing
is what the figure's caption points to.

What makes it clutter is the paint, not the geometry. The marmoset X is one
liftOver record — hg38 chr17:15,821,140–21,551,968 against calJac4
chr5:63,127,540–83,574,040, minus strand, 43,988 CIGAR ops — drawn as ~150
one-pixel tiles. Every tile passes through nearly the same point, and at the
default `rgba(130,130,130,0.3)` the point stacks to `1 - 0.7^n` opacity:
near-black, with no information in the darkness.

Merging the tiles into one band per record misplaces genes, since the record is
not linear (20 Mb of marmoset against 5.7 Mb of human). Merging indels under
3 px and putting every lane at the anchor's scale were tried and reverted.

## The proposal

Paint each pixel of a gutter with its **darkest** ribbon (its lightest on a dark
ground) rather than stacking every ribbon's alpha. Each ribbon is its colour
pre-blended over the band's ground, drawn opaque under a `min` blend. The band's
ground is already opaque and known to both backends
(`syntenyRibbonMarks.ts`, "OPAQUE AND KNOWN"), which is what makes the pre-blend
exact.

The Canvas2D probe is commit `ec4f69507f`: `drawSyntenyTrack` pre-blends each
fill and stroke over `ground` and draws under `globalCompositeOperation =
'darken'`. Shot with `?renderer=canvas2d` on the 17p window, it changes 14% of
the frame: every starburst becomes a uniform light-grey crossed band. On
`primate_chr17_inversions`, coloured by strand, the crossing points lighten and
red and blue overlaps stay readable.

## What it costs

- **Overlap multiplicity.** Two duplicated copies stacking on one pixel draw
  like one. On gene-level multi-way ribbons that is rarely what the reader is
  counting; on a pairwise all-vs-all PAF at whole-genome zoom, the stacking is
  the density picture. So the pairwise view keeps summing unless decided
  otherwise.
- **Texture inside a crossing.** The individual tiles inside an inverted band
  are no longer traceable; only the band's outline is.
- **The GPU paths.** render-core's `BlendState` has `op: 'max'`
  (`webgl2Hal.ts`, `deviceGpuCache.ts`) and needs `'min'` beside it; the
  synteny fill shaders need a pre-blended opaque output under a flag, as their
  CIGAR branch already produces against `u.ground`; and blend state is per
  pipeline, so the flattened fill is its own pass. The SVG export draws its
  gutters opaque inside a group carrying the alpha. `multiwayBackendParity.test.ts`
  holds the backends to each other.

## The call

Whether multi-way gutters should give up multiplicity for this, and whether the
pairwise `LinearSyntenyView` — the same ribbons between two rows — should
follow.
