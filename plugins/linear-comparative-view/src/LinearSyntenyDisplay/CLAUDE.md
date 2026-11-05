# LinearSyntenyDisplay

## Shaders (`shaders/*.slang`)

- **Put shared geometry in `syntenyTypes.slang`** (the instance layout,
  `Uniforms`, `straightGeometry`, `curveGeometry`, the fill/edge prologue), and
  **append new module functions at the END** — inserting mid-module shifts every
  importer's generated `#line` numbers.
- **Match a corner to an edge only in `ribbonEdges`.** The vertex polygon and
  the fragment's clip must agree, and `syntenyFillPad.test.ts` can't catch a
  mismatch because it models both from one copy of `fillEdges`. Call it rather
  than re-spelling `lerp(c.x, c.w, s)`.
- **Draw the ribbon as the exact cubic bezier** (control points at mid-height),
  the same curve `drawSyntenyTrack` draws with `bezierCurveTo`, not chords.
- **After changing a vertex pad, run `syntenyFillPad.test.ts`**, and make the
  test model which X-blend each quad row takes as well as the pad itself.

## Packing and picking

- The outline is the backends' one intentional asymmetry: Canvas2D strokes it
  inside `drawSyntenyTrack`, so the edge marks paint nothing there.
- **Filter a string lane by integer.** Lanes are dictionary-encoded up to
  `getFeatureAtIndex`: resolve the name once with `dict.indexOf` and compare
  integers; -1 matches nothing, which is the right answer. `featureIds` stays a
  `string[]`.
