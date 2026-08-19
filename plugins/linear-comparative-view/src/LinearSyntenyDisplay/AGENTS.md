# LinearSyntenyDisplay

- Shaders are authored in Slang (`shaders/*.slang`). Each source file has a
  sibling `*.generated.ts` emitted by `pnpm gen:shaders` containing WGSL,
  GLSL-ES-300, uniform/instance byte offsets, and `VERTEX_ATTRIBUTES`. Never
  edit the `.generated.ts` files by hand.
- Shared types (the per-instance vertex layout, the `Uniforms` cbuffer,
  `computeCorners` and `isCulled`) live in `shaders/syntenyTypes.slang`. Every
  shader imports from this module so layouts stay in sync.
- **Corners are a bare `float4` (x1, x2, x3, x4), and `ribbonEdges` is the only
  place a corner is matched to an EDGE** (edge 0 runs x1→x4, edge 1 runs x2→x3).
  `edgeSpan` (vertex polygon), `fillEdges` (fragment's analytic clip),
  `ribbonEdgeDeltas` (slope pads) and `ribbonWidths` (`thinRibbonPad`) all go
  through it. The polygon and the clip MUST agree or the geometry crops the
  shape the fragment draws, and `syntenyFillPad.test.ts` cannot catch that — it
  models both from one copy of `fillEdges`. Don't re-spell a
  `lerp(c.x, c.w, s)`.
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
- The curve passes spell `VERTS_PER_INSTANCE` as `CURVE_SEGMENTS * 6u` — the
  codegen resolves identifiers through the import, so the count follows
  `syntenyTypes` by construction. `syntenyPassGeometry.test.ts` pins the two
  passes of a mode to one instance layout, which is what lets a record packed
  for the fill be read by the edge.
- `u.height` is floored at 1 by `writeUniforms`, not by each shader.
- The vertex pads are pinned by `shaders/syntenyFillPad.test.ts`, which mirrors
  both `pad` blocks plus `perpCoverage`'s footprint and asserts the padded
  polygon never crops coverage. Change a pad, run it.
- **A quad's two rows sit a pixel outside the ribbon, and the pad is only half
  of what the test has to model.** The other half is which X-blend each row
  takes its x from, because a quad's sides are straight in SCREEN Y: rows at
  s=0/s=1 but y=-1/height+1 lean across the ribbon's travel by up to a full
  perpendicular pixel, which is the entire coverage footprint.
  `straightGeometry` extrapolates (s=-1/height and 1+1/height) and its fragment
  does not clamp `t`; `curveGeometry` does not need to, because its end segments
  sit where the x-curve is momentarily vertical. The test modelled the rows as
  spanning exactly `[y(t0), y(t1)]` and read zero over all of it for as long as
  that was wrong.
- `GpuSyntenyRenderer.ts` wires the four passes (`fillStraight`, `fillCurve`,
  `edgeStraight`, `edgeCurve` — curve vs straight live in separate shader files
  so there are no `isCurve` branches) via `slangPass()` from
  `@jbrowse/render-core/slangPass`, each from its own generated module — no
  `bufferStride`/`bufferAttributes` overrides, because every pass now owns its
  buffer.
- **The edge passes get their own one-instance buffer**, packed by
  `packClickedOutlineInstances` (in `instanceInterleave.ts`) from the clicked
  feature's record and uploaded under the edge pass id, from `render()` — the
  clicked id is a render parameter, so nothing knows what to pack until the
  frame that draws it. They used to be drawn against the fill pass's buffer via
  `drawPass`'s `bufferPassId`, which ran the vertex shader over the whole region
  — 24M invocations per frame in curve mode on a 500k-instance view — to outline
  one ribbon. `isClickedSilhouette` stays in the shader as the safety net, and
  `syntenyPassGeometry.test.ts` pins each mode's two passes to one instance
  layout, which is what lets a record packed for the fill be read by the edge.
- `instanceInterleave.ts` hand-writes the pack loop instead of calling the
  generated `packInstances`, because `featureId` is `instanceFeatureIdx[i] + 1`
  and the generated packer only takes flat arrays. Its `patchInstanceColors`
  twin is the recolor fast path — dotplot's
  `DotplotDisplay/instanceInterleave.ts` is the same two functions for the same
  reason.
- **The pick context is never the render context.** `makePickCtx` (in
  `syntenyPickEngine.ts`) hands each backend a private 1x1 offscreen 2D context,
  because `isPointInPath` takes its point in the canvas coordinate space
  _unaffected by the current transformation_ while the path it tests was built
  through it — so on the Canvas2D backend's own context, which carries
  `setTransform(dpr, …)` from `clear()`, hover and click missed by the device
  pixel ratio on every HiDPI screen. No mock ctx applies a transform, so no
  assertion about hit coordinates can catch a regression here; what the suites
  pin instead is that the pick builds no path on the drawing context.
- Picking is CPU-side: `syntenyPickEngine.ts` mirrors the shader's geometry
  (`projectCorners`, `isRibbonCulled`) and runs a Flatbush bbox query refined
  with `isPointInPath`. Both `Canvas2DSyntenyRenderer` and `GpuSyntenyRenderer`
  use it — the `// SYNC:` comments mark the JS↔Slang pairs that must stay in
  lockstep, and `syntenyRibbonPath.ts` is where the shared predicates
  (`isRibbonCulled`, `ribbonPerpWidth`, `isInstanceInvisible`) live so "drawn"
  and "pickable" cannot answer differently. The cull's own comparison is not a
  SYNC pair: `isRibbonCulled` asks its three questions through
  `spanOutsideBand`, `//! js-export`ed from syntenyTypes.slang, so both sides
  run the shader's function and choose only what they pass it — the pads, and
  where the `minAlignmentLength` cull is applied.
- **Per-feature string lanes are dictionary-encoded, and `getFeatureAtIndex` is
  where the encoding stops.** `nameDict`/`nameIds` and the four refName/assembly
  pairs replace what were five `string[]` of length n — the only part of the
  payload that was not a zero-copy transfer, measured at ~44ms of structured
  clone per lane at 500k features, so ~220ms per whole-genome fetch. Two rules
  come with it: `featureIds` stays a `string[]` (genuinely distinct per feature,
  so a dictionary costs the same clone plus an index array — see
  `makeStringDict` in synteny-core for where the line is), and a consumer
  FILTERING on a name resolves it to an id ONCE with `dict.indexOf` and then
  compares integers, which is what `pickFollowFeature` and `followWindowMapping`
  do per block, per frame. `dict.indexOf` answering -1 for an absent name is not
  a special case to guard: -1 is not a valid id, so it matches nothing, which is
  the answer the string compare gave.
- Payload fixtures are `testUtils.ts`'s `packSyntenyFeatureData`. Four suites
  each had their own `data(blocks)` spelling out all fourteen fields, so the
  string lanes going encoded would have been a four-file edit that said nothing
  about any of the four tests.
