# LinearSyntenyDisplay

- Shaders are authored in Slang (`shaders/*.slang`). Each source file has a
  sibling `*.generated.ts` emitted by `pnpm gen:shaders` containing WGSL,
  GLSL-ES-300, uniform/instance byte offsets, and `GL_ATTRIBUTES`. Never edit
  the `.generated.ts` files by hand.
- Shared types (the per-instance vertex layout, the `Uniforms` cbuffer,
  `computeCorners` and `isCulled`) live in `shaders/syntenyTypes.slang`. Every
  shader imports from this module so layouts stay in sync.
- The two fill passes differ **only** in geometry — one quad vs 8 tessellated
  bezier segments. `syntenyTypes` owns everything else: the `FillVsOut`
  varyings, the `fillVsBegin`/`fillVsEmit` vertex prologue/epilogue, and the
  whole fragment (`fillFs`), which each pass calls with its own `(s, sd, dydt)`
  basis. Same split as render-core's `rowRect`. Put new shared work there, not
  in a second copy. New module functions go at the END of the file — inserting
  mid-module reshuffles every importer's generated `#line` numbers.
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
