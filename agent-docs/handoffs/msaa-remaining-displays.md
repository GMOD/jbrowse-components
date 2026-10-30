---
name: msaa-remaining-displays
description: "Which displays still allocate the 4x MSAA target, the largest per-display GPU allocation, and what each needs to draw at one sample. Feature tracks moved on 2026-10-28. Open: variant tracks, alignments and wiggle (each trades some edges, Colin's call; variant rows tile, so they flip only to hard row edges), the grammar marks, and a checked-in GPU pixel harness. Hi-C and LD stay at four."
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

1. **Variant tracks, Colin's call.** Each layout is one pass, `cell`
   (`variant.slang`) and `matrixCell` (`variantMatrix.slang`), so each flips
   alone. Neither is mechanical: sample rows tile at fractional y, the shape
   that keeps Hi-C at four.
   - **Ramping rows seams them.** Two rows meeting mid-pixel each paint 0.5 and
     composite to 0.75, so the background shows through every row boundary.
   - **Draw order rules out the usual repair** (ramp the later cell's edge, run
     the earlier one hard to the pixel): `computeVariantCells.ts` draws every
     ref cell before any alt cell, so a cell cannot tell which neighbour drew
     first.
   - **So a flip means hard row edges**: each device pixel takes the row over
     its centre, where four samples blend up to four rows. Rows at least a
     device px tall change only along their boundaries. A cohort with more
     rows than device px shows one row per pixel instead of up to four.
   - `variantMatrix.slang` already paints one pure cell per pixel in x by
     design, so hard rows would make y match it.
   - The win is size: a tall cohort track is the canvas the target costs most
     on.
   - A sharp corner's ramp reaches `aaHalfPx / sin(half its angle)` past the
     corner, not `aaHalfPx`; the inversion glyph's tip needs the
     `arrowReachPx` treatment.
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
   about all three renderings.
4. **The grammar marks.** `pointMark`, `spanMark` and `lineStepMark` keep the
   mark display at four. `barMark`, which multi-way synteny also draws with,
   already declares the directive.
5. **A checked-in GPU pixel harness.**
   - Each flip so far was measured with a throwaway Deno WebGPU script. It
     renders a generated WGSL with `multisample: { count: 4 }` and a resolve
     target, against one sample and against an exactly covered shape.
   - The same script found the circular ribbon's band/cap seam (ADR-177).
   - A small `scripts/` tool reading each pass's `*.iface.generated.ts` would
     make "pixels unchanged" checkable. Whether CI can run it on a software
     Vulkan is untested.

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
