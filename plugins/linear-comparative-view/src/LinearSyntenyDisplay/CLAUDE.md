# LinearSyntenyDisplay

## Shaders (`shaders/*.slang`)

- **`syntenyTypes.slang` owns the shared geometry**: the instance layout,
  `Uniforms`, both polygons (`straightGeometry`, `curveGeometry`) and the
  fill/edge prologue. Put new shared work there, and **append new module
  functions at the END** — inserting mid-module shifts every importer's
  generated `#line` numbers.
- **`ribbonEdges` is the only place a corner is matched to an edge.** The vertex
  polygon and the fragment's clip must agree, and `syntenyFillPad.test.ts` can't
  catch a mismatch because it models both from one copy of `fillEdges`. Don't
  re-spell `lerp(c.x, c.w, s)`.
- **The ribbon is the exact cubic bezier** (control points at mid-height), the
  same curve `drawSyntenyTrack` draws with `bezierCurveTo`. Don't approximate it
  with chords.
- **Changing a vertex pad means running `syntenyFillPad.test.ts`**, and the test
  has to model which X-blend each quad row takes as well as the pad itself.
- `u.height` is floored at 1 in `writeUniforms`, not per shader.

## Packing and picking

- `instanceInterleave.ts` hand-writes the pack loop on purpose: `featureId` is
  `instanceFeatureIdx[i] + 1`, which the generated `packInstances` can't
  express; dotplot's twin hand-writes its loop for the same reason.
- **The pick context is never the render context.** `makePickCtx` gives each
  picker a private offscreen context, because `isPointInPath` ignores the render
  context's `setTransform(dpr, …)` and HiDPI picks miss. No mock ctx applies a
  transform, so no hit-coordinate test can catch a regression.
- "Drawn" and "pickable" share their predicates (`syntenyRibbonPath.ts`,
  `spanOutsideBand` exported from Slang). `// SYNC:` marks the JS↔Slang pairs
  that must change together.
- The outline is the backends' one intentional asymmetry: Canvas2D strokes it
  inside `drawSyntenyTrack`, so the edge marks paint nothing there.

## Payload

- **String lanes are dictionary-encoded up to `getFeatureAtIndex`.** Filter on a
  name by resolving it once with `dict.indexOf` and comparing integers; -1
  matches nothing, which is the right answer. `featureIds` stays a `string[]`.
- Fixtures come from `testUtils.ts`'s `packSyntenyFeatureData`.
