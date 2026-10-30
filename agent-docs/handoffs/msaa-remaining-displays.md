---
name: msaa-remaining-displays
description: "Which displays still allocate the 4x MSAA target, the largest per-display GPU allocation, and what each needs to draw at one sample. Feature tracks moved on 2026-10-28 and multi-sample variant tracks on 2026-10-30 (rows snapped to the device grid, awaiting Colin's review). Open: alignments, wiggle and the grammar marks, each trading some edges and each Colin's call; `scripts/gpu-pixels/run.ts` scores a flip. Hi-C and LD stay at four."
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
4. **The grammar marks, Colin's call: none flips cleanly.** A mark display
   samples at four if any mark it lists does, so a track listing only clean
   marks would move. `barMark` does NOT declare the directive either: its
   vertical cuts stay hard and lean on MSAA (its header says why). Numbers are
   mean error over reference ink, at dpr 1 / 1.5 / 2, from
   `node scripts/gpu-pixels/run.ts mark`:
   - **`pointMark`'s glyphs are clean.** Disc, triangle and diamond already
     ramp their own SDF in a padded quad: 1.97 / 1.31 / 0.90% at one sample
     against 1.98 / 1.32 / 0.92% at four. Two shapes in the same pass are not:
   - **The rule** is a flat fill whose four cuts sit at fractional px: 20.5 /
     11.5 / 4.2% at one sample, 3.2 / 3.5 / 3.6% at four. Ramping all four
     cuts (prototype, not landed) scores 3.6 / 1.9 / 1.35%, but two rules
     abutting at one value seam to alpha 0.75 in the shared column, at either
     sample count. Ramping only the y cuts, as `barMark` does, scores 4.5 /
     2.6 / 2.0% with no seam; the trade is ends rounded to the device grid,
     off by up to 0.5 there. That is `barMark`'s vertical-cut trade, so both
     marks want the same answer.
   - **The crisp square** snaps its corner to the CSS grid but its size is
     `2 * radiusPx`, so its far edges, and every edge at a fractional dpr, sit
     mid-pixel: 8.8 / 7.7 / 3.0% at one sample, 3.1 / 2.0 / 0.04% at four.
     Clean only if the square snaps to the device grid, which moves
     `crispSquareTopLeftPx` for wiggle and both painters too.
   - **`spanMark` tiles** (MAF, chromHMM), so ramping its x cuts seams it as
     the coverage band would. Left hard at one sample, a cell narrower than a
     device pixel either owns the pixel or vanishes: the MAF-like fixture
     scores 18.9 / 20.0 / 12.7% against 3.3 / 2.5 / 3.8% at four. One sample
     per pixel should also shimmer as the view pans (not filmed). Row edges
     round to the device grid at one sample, which the Canvas2D painter
     (`onDevicePx`) already does.
   - **`lineStepMark`'s quads overlap at every joint**, so ramping them
     double-blends there (the refusal `wiggleLine.slang` got). Left hard, a
     1 px step line snaps to whole device rows: 44.9 / 34.3 / 34.6% at one
     sample against 10.3 / 11.5 / 5.6% at four.
   - **Found on the way:** a translucent step line already blends its joints
     twice, at four samples as at one (14–208 pixels in the fixtures at alpha
     0.6): the horizontal's square cap, the collapsed third quad and the next
     rise all cover the corner.
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
