---
name: msaa-remaining-displays
description: "Which displays still allocate the 4x MSAA target, the largest per-display GPU allocation, and what each needs to draw at one sample. Feature tracks moved on 2026-10-28. Open: variant tracks (mechanical), alignments and wiggle (each trades some edges, Colin's call), the grammar marks, and a checked-in GPU pixel harness. Hi-C and LD stay at four."
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

1. **Variant tracks.**
   - `variant.slang` snaps x and leaves y fractional, the shape `rect.slang`
     had: ramp its edges in the fragment, and grow the quad only at a
     fractional dpr (`snappedEdgePadPx` in the features plugin's
     `featureGlyphUniforms.slang`).
   - Its inversion triangle (`triSdfRight`) reads 0.5 on the quad's own edge,
     per the idea doc.
   - `variantMatrix.slang` is already built to be MSAA-invariant and lacks only
     the directive.
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
4. **The grammar marks.** `barMark`, `pointMark`, `spanMark` and `lineStepMark`
   keep the mark display at four. `barMark` also keeps multi-way synteny there,
   beside the feature passes it reuses.
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
