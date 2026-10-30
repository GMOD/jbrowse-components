---
name: msaa-remaining-displays
description: "Which displays still allocate the 4x MSAA target, the largest per-display GPU allocation, and what each needs to draw at one sample. Feature tracks moved on 2026-10-28, multi-sample variant tracks on 2026-10-30 (cells snapped to the device grid on both axes, awaiting Colin's review), grammar points and rules the same day, and wiggle's step line too (by max blend; the grammar step line went back to four). Wiggle's bars and density stay at four by choice. Alignments draws at one sample since 2026-10-30, sub-pixel coverage segments drawing whole or not at all. Open: `spanMark` and `barMark`, each Colin's call. Hi-C and LD stay at four."
---

# Displays still at four samples

A display draws at one sample when every pass it registers declares
`//! coverage: analytic` (`deriveSampleCount`,
`packages/render-core/src/createRenderingBackend.ts`).

- **The survey:** why each display leans on MSAA, with captures, is in
  [ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md](../ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md).
- **The memory:** [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)
  §"The MSAA target is the largest per-display allocation". Measured resident
  on 2026-10-30, Intel and AMD alike: the tall dpr-2 track's target holds
  340 MiB, so the descriptor's figures understate it.
- **The ruling (2026-10-30):** for bars, cells and step lines one sample
  changes edge softness, not values. Two exceptions found by review: a pass
  that measures its own coverage can compound where its pieces overlap (the
  step lines; give it a dense fixture), and a stack of sub-pixel segments
  turns from a tint into a full pixel or nothing (alignments' coverage band,
  item 1, accepted: a common allele is many px tall). Wiggle keeps four by choice: ~8 MiB a track does not pay for its
  bars' and density's edges.
- **The pattern to copy:** the five feature passes under
  `plugins/features/src/LinearBasicDisplay/passes/shaders/`, and
  `featurePassCoverage.test.ts` beside them.

## Next, in order

1. **Alignments draws at one sample at every dpr** (`AlignmentsRenderer.ts`,
   2026-10-30, Colin's call after the trade below). One tall track at dpr 2
   held 340 MiB of MSAA. Pixels that moved against four samples, in Chrome
   WebGL2 (`products/jbrowse-web/browser-tests/probe-alignments-sample-count.ts`),
   dpr 1 / 1.5 / 2: base level 0.40 / 3.9 / 0.21%, long reads 0.38 / 0.74 /
   0.15%, zoomed out 2.3 / 6.3 / 1.3%, fit squeeze 7.7 / 13 / 4.3%. At 1.5
   most of that is row edges four samples had blended into a fringe, now
   crisp. What it costs:
   - **Coverage segments under a device px draw whole or not at all.** A
     segment's height is its share of depth times the band height, so a
     common allele is many px tall and keeps its value; a rare one (under
     max depth / band px reads) is a full-color pixel or nothing, by where it
     falls, where four samples gave a tint (and dropped one under ~1/4 px).
     Zoomed out, a pixel shows one allele's color, not their mix, while
     Canvas2D and SVG still blend.
   - **Hard read tips and coverage-bar tops**, and at a fractional dpr equal
     1 CSS px cells come out 1 or 2 device px wide.
   - A whole-dpr-only gate was tried first and dropped: the count is read at
     construction, and browser zoom reaches a fractional dpr after it.

   Mean error over reference ink, one sample against four, at dpr 1 / 1.5 / 2
   (`scripts/gpu-pixels/fixtures/alignments.ts`):
   - `alignments-coverage-bar`: 5.5 / 4.8 / 2.7% against 1.5 / 1.0 / 0.7%.
     All of it at the fractional bar tops and height steps; no seam between
     bars. The band (`coverageBar`, `coverageSnp`, `coverageMod`,
     `coverageInterbase`, `coverageClip`) cannot ramp, as its bars share
     edges, so this is the cost of flipping, and it is permanent.
   - `alignments-read`: 1.3 / 5.9 / 0.7% against 0.5 / 1.0 / 0.3%. Close at a
     whole dpr; the loss is at 1.5, where 7 px rows put y edges mid-pixel.
   - `alignments-mismatch` and `-subpixel`: byte-identical at dpr 1 and 2;
     16.2% and 36.5% at 1.5, where whole-CSS-px cells land on half device
     pixels.
   - Gap, insertion and connector have no fixture yet.
2. **Wiggle stays at four, by choice.** The step line (max blend,
   `wiggle-step-*` including `-dense-*`) and the scatter's square
   (`wiggle-scatter-square`) are ready for one sample, but a single-row wiggle
   saves only ~8 MiB at dpr 2, which does not pay for these two:
   - `wiggle-xyplot-bars`: 9.3 / 6.1 / 5.5% at one against 2.5 / 1.6 / 1.3%
     at four, all at the hard vertical cuts between bins of different heights.
   - `wiggle-density`: 5.9 / 4.1 / 3.1% against 1.7 / 1.2 / 0.9%, rows and bin
     edges both hard. Its rows tile, so they could snap through `rowSnap.slang`
     as the variant passes do; its sub-pixel bins would still own or miss a
     pixel, as `spanMark`'s cells do.
3. **The grammar marks: only `spanMark` and `barMark` remain.** A mark
   display samples at four if any mark it lists does. Numbers are mean error
   over reference ink at dpr 1 / 1.5 / 2, from
   `node scripts/gpu-pixels/run.ts mark` (8x8 supersample; see item 4 on
   what that hides).
   - **At one sample now:** `pointMark` (glyphs; the square inks its box by
     area; a rule ramps its y cuts and keeps its ends hard, so abutting rules
     share no seam). The square scores 0.6 / 0.4 / 0.6% and the rule 4.5 /
     2.6 / 2.0%, each at or under the old four-sample render except the
     square at dpr 2.
   - **`lineStepMark` is back at four.** Inking each quad by area compounded
     at dense joints (`mark-step-dense-flat`, header of `lineStepMark.slang`),
     and a max blend composites wrong over other marks. Making a joint's
     pieces disjoint would need hard internal cuts and ramped outer edges per
     fragment; nobody has built it.
   - **What moves:** the mark display and Manhattan when every listed mark is
     a point, rule, center line or link. MAF also registers `barMark` and the
     coverage band, and alignments' arcs and indicators stay with alignments.
     A 1266x100 CSS px track saves about 1.9 MiB at dpr 1 and 7.7 MiB at dpr 2.
   - **`spanMark` stays at four: its cells tile** (MAF, chromHMM). Ramping x
     seams them; left hard, a sub-pixel cell owns its pixel or vanishes: 11.8 /
     8.5 / 6.2% at one sample against rows on the device grid, 2.7 / 2.1 /
     1.5% at four. Widening it with alpha by true width, as
     `variantMatrix.slang` does, scores worse (12.8%): the next opaque cell
     overwrites the pixel. Its rows now snap through `rowSnap.slang`, as the
     Canvas2D painter's do.
   - **`barMark` stays at four:** its vertical cuts stay hard and lean on MSAA
     (its header says why).
4. **The GPU pixel harness exists:** `node scripts/gpu-pixels/run.ts`, written
   up in [GPU_SHADERS.md](../reference/GPU_SHADERS.md) §"Scoring a pass's
   pixels on a real GPU". Its `--base=bdc1f15242~1` run shows the feature
   flip: `rect` at dpr 1.5 and one sample went from 5.04% to 0.02%. Open:
   - **The 8x8 reference flatters MSAA on straight edges.** Every pixel along
     an axis-aligned edge sits at the same fraction, so 8's rounding does not
     average out, and 4x MSAA's sample rows round the same way. A pass that
     measures its own coverage reads up to ~5 points worse than it is. Judge
     one with `--supersample=32` (~16x slower). Hard-edged passes (bars,
     spans, density) barely move at 32.
   - It runs in CI (the Shaders job, lavapipe). The dense step-line
     fixtures' budgets fail it when the wiggle step line loses its max blend.

Also at four, each small, and none a free flip:

- **The sequence track (`sequenceCell.slang`).** It draws down to 10 bp/px, so
  its base cells tile at 0.1 px: the `spanMark` trade again.
- **alignments-core's `insertionMark.slang`.** Only MAF registers it, beside
  `barMark`, `spanMark` and the coverage band, so flipping it alone saves
  nothing.
- **The score example plugin's `score`.** Its boxes abut as coverage bins do.

The tree sidebar's `sampleDistance.slang` used to be listed here, but it is a
compute pass and allocates no target.

## Stays at four

Hi-C and LD (`hic.slang`, `ldGenomic.slang`, `ldUniform.slang`): their tiled
diamond cells seam under per-cell antialiasing. The idea doc records the
decision under its option 5.

## Checking a flip

- **Against MSAA:** a pass that measures its own coverage still draws
  differently at four samples, because the hardware multiplies its sample
  coverage in at the quad's edge. Judge the pass against an exactly covered
  shape, not against the 4-sample render.
- **In the built app:** `getContextAttributes().antialias` returns false on the
  WebGL2 canvas of a display drawing at one sample. Capture the WebGL2 and
  Canvas2D rungs side by side to see what moved.
