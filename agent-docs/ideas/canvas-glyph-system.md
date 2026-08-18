---
name: canvas-glyph-system
description: The per-glyph `{layout, emit}` registry rejected for four grounded reasons, and the lighter layout-switch variant skipped with it. Read before proposing that a glyph's layout and emit live in one file.
---

# Canvas glyph system (plugins/canvas RenderFeatureDataRPC)

Context after the 2026-07 emit-dispatch unification (`emitGlyph` — one recursive
switch replacing the old top-level `GLYPH_EMITTERS` record + hand-written
`processSubfeaturesLayout` child if/else). Three follow-ups came out of that
pass; two have since landed and left only this one parked.

The compact-mode `subfeatureLabels: 'below'` overlap is **fixed**: the row is
counted in the worker and spent on the main thread at `labelFontPx`, which is
where this doc said the reservation belonged — see `reservesBelowLabelRow` in
`RenderFeatureDataRPC/labelUtils.ts`. The per-gene isoform cap **shipped**, and
in the worker rather than on the main thread as argued for here; the reasons
that reversed it are
[ADR-075](../architecture-decision-records/adr-075-the-isoform-cap-runs-in-the-worker.md).

**Evaluated and rejected: co-locating each glyph's layout+emit into one
`{layout, emit}` module (a `Record<GlyphType, Glyph>` registry).** Not a win, for
four grounded reasons — don't re-litigate without new information:
1. **Real one-way layer boundary.** `glyphs/` (layout) imports *zero* rendering
   deps (no color/theme/peptide/Collector) — only `Feature`, `types.ts`, geometry
   helpers; `glyphEmitters.ts` (emit) is saturated with them (~41 refs). They
   communicate purely through the `FeatureLayout` tree + `glyphType` tag, and
   layout output (heights) feeds main-thread row packing *before* emit runs — a
   genuine phase split, not incidental file layout. Co-location forces every glyph
   module to straddle both worlds.
2. **Detection stays centralized regardless.** `findGlyph` is a precedence-ordered
   decision tree (`guide_rna` → CDS+mature → repeat → containerTypes →
   container-children → CDS-child → segments → box) — routing logic about relations
   *between* glyphs, inherently central. So "everything about a glyph in one file"
   is unachievable anyway.
3. **Reintroduces the indirection just removed.** A registry brings back the
   `Record` and makes `Subfeatures`' recursion dispatch *through* it
   (`GLYPHS[child.glyphType].emit(...)`) instead of a visible recursive call. Two
   readable switches (`findGlyph` routing, `emitGlyph` emit) beat a registry of
   paired objects that call back into the registry.
4. **No drift pressure to relieve.** After unification, adding a glyph touches
   `types.ts` (tag) + `findGlyph` (route) + one `emitGlyph` case, and the
   `never`-default makes a missing emit case a compile error — the compiler already
   enforces the coupling proximity would. The remaining "two dispatches" are two
   *different concerns in two layers*, not a redundant dual-dispatch over the same
   thing (which the old `GLYPH_EMITTERS`/`processSubfeaturesLayout` pair *was*).

   Lighter variant also considered and skipped as lateral: collapsing the five
   one-line layout wrappers (`box/segments/processed/crisprGuide/repeatRegion.ts`)
   into a layout `switch` symmetric with emit — trades small dependency-free files
   (preferred) for a switch with no correctness/drift benefit.
