
  The plan's structure translates, but the scale is much smaller. Canvas has three GPU primitives —
  rect, line+chevron, arrow — each with:
  - An interleave function in interleaveBuffers.ts
  - A draw function in Canvas2DFeatureRenderer.ts
  - A shader in shaders/
  - Upload/draw calls scattered in GpuCanvasFeatureRenderer.ts

  Editing "the line glyph" currently means touching 3 files. A per-glyph folder would colocate all of
  that:

  glyphs/
    rect/
      interleave.ts   # interleaveRects — moves from interleaveBuffers.ts
      packGpu.ts      # PASS_RECT, slangPass call
      drawCanvas.ts   # drawRects — moves from Canvas2DFeatureRenderer.ts
    line/
      interleave.ts   # interleaveLines
      packGpu.ts      # PASS_LINE + PASS_CHEVRON (chevron shares line's buffer)
      drawCanvas.ts   # drawLines (includes chevron drawing)
    arrow/
      interleave.ts   # interleaveArrows
      packGpu.ts      # PASS_ARROW
      drawCanvas.ts   # drawArrows

  What stays shared: CANVAS_FEATURE_PASSES order, CANVAS_FEATURE_UNIFORM_BYTE_SIZE, bpMapper,
  drawFeatureBlocks, RegionMeta — all renderer-level, not glyph-specific. RegionRenderData /
  rpcTypes.ts stays as-is since it's shared with the RPC worker.

  The honest tradeoff: the current files are already small (interleaveBuffers.ts is 84 lines,
  GpuCanvasFeatureRenderer.ts is 187 lines). The clarity win is real but modest — mainly "add a new
  glyph type = create one folder." Hit testing doesn't split per-glyph (it's Flatbush over feature
  geometry, not glyph-type), so there's no hitTest.ts per folder.

  Recommendation: worth doing if you want to add a new glyph type soon (e.g., a dot glyph for point
  features), otherwise it's light but not urgent. The most natural starting step would be line/ since
  chevron's coupling to line's buffer is currently implicit and a folder makes it explicit.

  Want to proceed with a step-by-step plan like the alignments doc, or is this assessment enough to
  start?


