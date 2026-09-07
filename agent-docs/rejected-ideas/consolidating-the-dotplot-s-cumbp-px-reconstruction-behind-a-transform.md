---
name: consolidating-the-dotplot-s-cumbp-px-reconstruction-behind-a-transform
description: Consolidating the dotplot's cumBp -> px reconstruction behind a transform OBJECT, or behind a projector CLOSURE
area: performance-and-measurement
---

# Consolidating the dotplot's cumBp -> px reconstruction behind a transform OBJECT, or behind a projector CLOSURE

measured 2026-08-15 and both
declined; the scalar-primitive form was taken instead. `(cumBp - viewBp) *
bpPerPxInv`, with the v axis flipped through the plot height, is written out
in `drawDotplotInstances`, `pickDotplotFeature` and
`hoveredFeatureHighlight` (plus the Slang shader, which cannot share), and the
draw loop runs over 10^5+ segments a frame on the no-GPU path.
`plugins/dotplot-view/benches/cumBpProjection.bench.ts`, five arms, controls
0.985-1.031:

- `projectSegment(g, i, transform, out)` — the shape that dedups the most, all
  four coordinates and the flip in one definition — **1.44-1.47x**.
- The same helper with every call site normalized to one hidden class, to test
  whether the cost was the three different transform shapes going megamorphic:
  **1.25-1.39x**. So it is mostly the call and the scratch tuple, not the
  polymorphism, and normalizing the shapes would not buy the dedup back.
- A projector closure built once outside the loop (`px`/`py` over captured
  primitives) — the best-reading option, and by far the worst: **3.4-3.7x**.
  V8 does not inline through it here.
- `cumBpToPxH(bp, viewBp, inv)` / `cumBpToPxV(bp, viewBp, inv, height)`,
  primitives only — **0.98-1.01x**, indistinguishable from the control.

Taken: the scalar pair (`DotplotDisplay/dotplotProject.ts`). It dedups the
formula and makes the v-axis flip an axis-typed name a caller cannot forget,
which is the failure that matters — draw and pick must agree pixel for pixel or
the cursor picks the wrong alignment. The price is that the per-axis argument
pair stays at each call site. The prior reasoning here, "extracting it would
put a polymorphic call in a hot loop", was right about the object form, wrong
about the scalar one, and would never have caught the closure.
