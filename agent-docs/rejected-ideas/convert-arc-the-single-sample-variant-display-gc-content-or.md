---
name: convert-arc-the-single-sample-variant-display-gc-content-or
description: Convert arc, the single-sample variant display, GC content or the synteny displays onto render-core's mark shapes
area: rendering-and-displays
---

# Convert arc, the single-sample variant display, GC content or the synteny displays onto render-core's mark shapes

probed 2026-09-05, one read-only
agent per display, against the admission rule the earlier rounds converged
on: a display converts when its two backends walk the same data differently,
and not when its packer is already one walk both consume. None converts, each
for a reason the rule names. Arc has one backend: main-thread Canvas2D with a
vector `<path>` export, and one derivation (`arcShape.ts`) already feeds
stroke, hit test and SVG; a mark would add a GPU pass and a block frame it
does not have, and `MarkContext2D` has no `bezierCurveTo`. The variant display
is a thin subclass over the canvas feature pipeline, which packs one worker
array set once, paints Canvas2D and SVG through one painter, and hit-tests a
Flatbush rather than a third walk; its five passes share one uniform block,
the blocker above, and two of them borrow another pass's vertex buffer, which
`Mark.drawRegion` cannot say. GC content registers wiggle's component and
composes wiggle's model, so the wiggle decline transfers whole. Synteny's
ribbon needs two axis transforms and a keyed backend where a shape gets one
clip, one block and one bp mapper, and its geometry is already single-sourced
by codegen with `syntenyShaderParity.test.ts` pinning it; `LGVSyntenyDisplay`
is the alignments display by composition. What the probes found instead, as
the alignments probe did, is the per-instance cost each display owns: GC
content boxed every bin into a `SimpleFeature` for `featuresToRaw` to unbox
four `get()`s at a time, and `getFeatureArrays` on the adapter landed the same
day at 2.5x on 200K bins; the canvas painter's `paintedRectSpan` tuple pair
and synteny's per-instance `ResolvedFill` literal are allocation-shaped and
stay unmeasured: an allocation alone has priced at 1.00x in this tree.
**Later the same day the canvas feature pipeline converted after all** —
the variant display with it, being that subclass — once the two things the
rule named became declarations: `bufferOf` on `defineMark` says which mark's
buffer a pass borrows, and `params(state, region)` carries the per-region
uniform. What made it a convergence rather than a port was the second
consumer: `MultiWaySyntenyDisplay` drew the same five glyph passes through
its own renderer pair, and both now declare `featureGlyphMarks`. The
shared uniform block is written once per mark rather than once per block,
five small writes for one; the alignments decline above stands, because
thirteen passes over a zoom-resolved block is a different sum.
