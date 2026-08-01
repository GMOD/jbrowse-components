# LinearSyntenyDisplay

- Shaders are authored in Slang (`shaders/*.slang`). Each source file has a
  sibling `*.generated.ts` emitted by `pnpm gen:shaders` containing WGSL,
  GLSL-ES-300, uniform/instance byte offsets, and `GL_ATTRIBUTES`. Never edit
  the `.generated.ts` files by hand.
- Shared types (the per-instance vertex layout, the `Uniforms` cbuffer,
  `computeCorners` and `isCulled`) live in `shaders/syntenyTypes.slang`. Every
  shader imports from this module so layouts stay in sync.
- **All four passes draw one of two polygons, and `syntenyTypes` owns both.**
  `straightGeometry` (one quad) and `curveGeometry` (`CURVE_SEGMENTS`
  tessellated bezier segments) are each shared by that mode's fill pass and its
  clicked-outline pass; the passes differ only in the fragment (`fillFs` vs
  `strokeFs`) and in the `extraPerpPx` they widen the polygon by. That sharing
  is load-bearing: it is why the outline traces the fill exactly instead of
  approximating it. The module also owns the `FillVsOut` varyings, the
  `fillVsBegin`/`fillVsEmit` prologue/epilogue, and `curveParamAtY`. Same split
  as render-core's `rowRect`. Put new shared work there, not in a second copy.
  New module functions go at the END of the file — inserting mid-module
  reshuffles every importer's generated `#line` numbers.
- The ribbon is the exact cubic bezier with both control points at mid-height;
  `sBlend`/`yCurve` are its two components, and `Canvas2DSyntenyRenderer` draws
  the same curve with `bezierCurveTo`. Don't approximate it with chords — the
  outline pass used to, and sat up to 11.7px off.
- `VERTS_PER_INSTANCE` in the curve passes is a literal (the codegen can't
  resolve an imported constant); `syntenyPassGeometry.test.ts` pins it to
  `CURVE_SEGMENTS` and pins the two passes of a mode to one instance layout.
- `u.height` is floored at 1 by `writeUniforms`, not by each shader.
- The vertex pads are pinned by `shaders/syntenyFillPad.test.ts`, which mirrors
  both `pad` blocks plus `perpCoverage`'s footprint and asserts the padded
  polygon never crops coverage. Change a pad, run it.
- `GpuSyntenyRenderer.ts` wires the four passes (`fillStraight`, `fillCurve`,
  `edgeStraight`, `edgeCurve` — curve vs straight live in separate shader files
  so there are no `isCurve` branches) via `slangPass()` from
  `@jbrowse/render-core/slangPass`. The edge passes reuse the matching fill
  pass's instance buffer/stride. `INSTANCE_STRIDE_BYTES` and attribute layout
  come from the generated module — do not hand-maintain a parallel copy.
- Picking is CPU-side: `syntenyPickEngine.ts` mirrors the shader's geometry
  (`projectCorners`, `isEdgeCulled`) and runs a Flatbush bbox query refined with
  `isPointInPath`. Both `Canvas2DSyntenyRenderer` and `GpuSyntenyRenderer` use
  it — the `// SYNC:` comments mark the JS↔Slang pairs that must stay in
  lockstep.
