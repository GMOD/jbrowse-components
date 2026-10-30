---
name: msaa-remaining-displays
description: "Which displays still allocate the 4x MSAA target, the largest per-display GPU allocation, and what each needs to draw at one sample. Feature tracks moved on 2026-10-28 and multi-sample variant tracks on 2026-10-30 (rows snapped to the device grid, awaiting Colin's review). Grammar points, rules and step lines on 2026-10-30. Open: alignments, wiggle, `spanMark` and `barMark`, each trading some edges and each Colin's call; `scripts/gpu-pixels/run.ts` scores a flip. Hi-C and LD stay at four."
---

# Displays still at four samples

A display draws at one sample when every pass it registers declares
`//! coverage: analytic` (`deriveSampleCount`,
`packages/render-core/src/createRenderingBackend.ts`).

- **The survey:** why each display leans on MSAA, with captures, is in
  [ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md](../ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md).
- **The memory:** [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)
  §"The MSAA target is the largest per-display allocation".
- **The pattern to copy:** the five feature passes under
  `plugins/features/src/LinearBasicDisplay/passes/shaders/`, and
  `featurePassCoverage.test.ts` beside them.

## Next, in order

1. **Variant tracks: look at it in the app.** Both passes snap rows to the
   device grid and declare the directive (the idea doc's `variant.slang`
   paragraph has the numbers). Not yet checked:
   - A capture of a dense cohort (1000 Genomes, 2,504 rows) on the WebGL2 and
     Canvas2D rungs, beside a 4x capture from before the change.
   - x still snaps to whole CSS px, so at a fractional dpr a cell's sides sit
     mid-device-pixel: hard on the GPU, a seam between abutting cells on
     Canvas2D. Snapping x to the device grid needs `scissorX`'s device offset in
     the shader. The pixel harness's `variant-cells` fixture prices it at dpr
     1.5: one sample off the exact scene by 7.05% of the ink (569 pixels over
     0.1), four samples by 0.03%. Its budget holds today's number, so tighten
     it with the fix.
   - The DOM overlays (hover box, row separators) still place rows at
     fractional y, up to half a device pixel off the snapped row.
2. **Alignments, Colin's call.** One tall track at dpr 2 holds about 316 MiB.
   - The read, mismatch, gap, insertion and connector passes can be made
     analytic as the feature passes were.
   - The coverage band (`coverageBar`, `coverageSnp`, `coverageMod`,
     `coverageInterbase`, `coverageClip`) cannot: its bars share edges, and
     ramping each bar seams them.
   - So flipping draws hard bar tops at one sample.
3. **Wiggle, Colin's call.** `wiggle.slang` (its crisp point square),
   `wiggleDensity.slang` and `wiggleLine.slang` keep it at four, and the idea
   doc lists density and the step line as refusals. The flip is one judgement
   about all three renderings. Density's rows tile, so they could snap through
   `rowSnap.slang` as the variant passes do.
4. **The grammar marks: only `spanMark` and `barMark` remain.** A mark
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
     wrong over other marks. `wiggle.slang`'s square is still hard, so it now
     differs from the mark display's.
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
5. **The GPU pixel harness exists:** `node scripts/gpu-pixels/run.ts`, written
   up in [GPU_SHADERS.md](../reference/GPU_SHADERS.md) §"Scoring a pass's
   pixels on a real GPU". Its `--base=bdc1f15242~1` run shows the feature
   flip: `rect` at dpr 1.5 and one sample went from 5.04% to 0.02%. Open:
   - CI. It runs on lavapipe here (`--adapter=llvmpipe`, within 0.1 point
     of the Intel GPU, 27 s for every fixture); a runner needs
     `mesa-vulkan-drivers`, untested.
   - Fixtures for the alignments and wiggle passes, before either flip.

Also at four, each small: the sequence track (`sequenceCell.slang`), the tree
sidebar's distance matrix (`sampleDistance.slang`), alignments-core's
`insertionMark.slang`, and the score example plugin.

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
