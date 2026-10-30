---
name: msaa-remaining-displays
description: "Which displays still allocate the 4x MSAA target, the largest per-display GPU allocation, and what each needs to draw at one sample. Feature tracks moved on 2026-10-28, multi-sample variant tracks on 2026-10-30 (cells snapped to the device grid on both axes, awaiting Colin's review), and grammar points, rules and step lines the same day, and wiggle's step line too. Open: alignments, wiggle's bars and density, `spanMark` and `barMark`, each trading some edges and each Colin's call; `scripts/gpu-pixels/run.ts` now has a fixture scoring each one. Hi-C and LD stay at four."
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
- **The ruling (2026-10-30):** none of these flips is a correctness question.
  One sample changes edge softness; values and colors draw right. Since the
  memory is real, flip wiggle (bars and density) and alignments, accepting
  hard coverage-bar tops. Before alignments flips, snap reads and mismatches
  to the device grid at a fractional dpr. Colin looks at the pixels per
  display.
- **The pattern to copy:** the five feature passes under
  `plugins/features/src/LinearBasicDisplay/passes/shaders/`, and
  `featurePassCoverage.test.ts` beside them.

## Next, in order

1. **Alignments, Colin's call.** One tall track at dpr 2 holds about 316 MiB.
   Mean error over reference ink, one sample against four, at dpr 1 / 1.5 / 2
   (`scripts/gpu-pixels/fixtures/alignments.ts`):
   - `alignments-coverage-bar`: 5.5 / 4.8 / 2.7% against 1.5 / 1.0 / 0.7%.
     All of it at the fractional bar tops and height steps; no seam between
     bars. The band (`coverageBar`, `coverageSnp`, `coverageMod`,
     `coverageInterbase`, `coverageClip`) cannot ramp, as its bars share
     edges, so this is the cost of flipping, and it is permanent.
   - `alignments-read`: 1.3 / 5.9 / 0.7% against 0.5 / 1.0 / 0.3%. Close at a
     whole dpr; the loss is at 1.5, where 7 px rows put y edges mid-pixel. Needs
     `rect.slang`'s fractional-dpr ramp, or rows snapped, first.
   - `alignments-mismatch` and `-subpixel`: byte-identical at dpr 1 and 2;
     16.2% and 36.5% at 1.5, where whole-CSS-px cells land on half device
     pixels. Needs the variant cells' `snapCellEdgePx` first.
   - Gap, insertion and connector have no fixture yet.
2. **Wiggle's bars and density, Colin's call.** The step line and the
   scatter's square draw at one already (`wiggle-step-*`,
   `wiggle-scatter-square`), so these two decide the display:
   - `wiggle-xyplot-bars`: 9.3 / 6.1 / 5.5% at one against 2.5 / 1.6 / 1.3%
     at four, all at the hard vertical cuts between bins of different heights.
   - `wiggle-density`: 5.9 / 4.1 / 3.1% against 1.7 / 1.2 / 0.9%, rows and bin
     edges both hard. Its rows tile, so they could snap through `rowSnap.slang`
     as the variant passes do; its sub-pixel bins would still own or miss a
     pixel, as `spanMark`'s cells do.
3. **The grammar marks: only `spanMark` and `barMark` remain.** A mark
   display samples at four if any mark it lists does. Numbers are mean error
   over reference ink at dpr 1 / 1.5 / 2, from
   `node scripts/gpu-pixels/run.ts mark` (8x8 supersample, so under ~1% is
   noise).
   - **At one sample now:** `pointMark` (glyphs; the square inks its box by
     area; a rule ramps its y cuts and keeps its ends hard, so abutting rules
     share no seam) and `lineStepMark` (each quad inks its box by area). The
     square scores 0.6 / 0.4 / 0.6%, the rule 4.5 / 2.6 / 2.0% and a 1 px step
     line 8.2 / 5.6 / 5.2%, each at or under the old four-sample render except
     the square at dpr 2. A translucent step line still blends its joints
     twice, as it did at four; a max blend would union them but composites
     wrong over other marks.
   - **What moves:** the mark display and Manhattan when every listed mark is
     a point, rule, line or link. MAF also registers `barMark` and the
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
   - CI. It runs on lavapipe here (`--adapter=llvmpipe`, within 0.1 point
     of the Intel GPU, 27 s for every fixture); a runner needs
     `mesa-vulkan-drivers`, untested.

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
