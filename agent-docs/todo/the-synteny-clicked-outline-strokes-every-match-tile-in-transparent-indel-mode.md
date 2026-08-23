---
name: the-synteny-clicked-outline-strokes-every-match-tile-in-transparent-indel-mode
description: get the visual call — hull silhouette or per-tile
metadata:
  area: synteny
  category: visual-call
---

# The synteny clicked outline strokes every match tile in transparent-indel mode

In transparent-indel mode (`drawCIGARMatchesOnly`), `cigarSegmentKind` tags each
match segment `KIND_BASE_TILE`, and the outline gate is "not CIGAR, not marker"
(`isClickedSilhouette` in `syntenyTypes.slang`, mirrored in
`Canvas2DSyntenyRenderer`), which a tile passes. So a clicked feature gets the
side edges of *every* match tile stroked instead of one silhouette — a ribbon
with 300 visible indels draws ~600 black hairlines. The shader comments say the
intent is the clicked feature's BASE silhouette, so this is accidental kind
reuse, not a chosen look.

The kind is no longer the missing piece: `KIND_BASE_TILE` exists, added so the
renderers could fade a tile by its own width, and teaching the edge pass to skip
it is one predicate. What still needs the visual decision first is what a tiled
feature is outlined WITH once it does — skipping the tiles leaves it **no outline
at all**, because pass 1 deliberately lays down no full-span base in that mode
(that is what keeps the indels see-through) — `isTiled` in
`buildSyntenyGeometry.ts` is the predicate. Doing it properly means emitting an
outline-only instance carrying the feature hull, which the fill passes must
discard and the pick engine must skip, or it breaks the documented
"pickable ⟺ drawn as a solid fill" invariant. **The call to make: silhouette of
the hull, or per-tile outlines.**

The perf argument that used to ride along with this is gone — the edge pass no
longer draws every instance. `packClickedOutlineInstances` builds a buffer of
just the clicked feature's instances (`GpuSyntenyRenderer.ensureOutlineUploaded`),
so don't reintroduce the HAL `firstInstance`/`instanceCount` range on `drawPass`
for this reason. The corner-order convention these passes read is spelled out at
the top of `syntenyTypes.slang`.
