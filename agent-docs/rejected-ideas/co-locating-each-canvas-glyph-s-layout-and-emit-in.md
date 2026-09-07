---
name: co-locating-each-canvas-glyph-s-layout-and-emit-in
description: Co-locating each canvas glyph's layout and emit in one `{layout, emit}` module
area: rendering-and-displays
---

# Co-locating each canvas glyph's layout and emit in one `{layout, emit}` module

(a `Record<GlyphType, Glyph>` registry) — proposed as
`ideas/canvas-glyph-system.md` after the 2026-07 emit-dispatch unification,
and closed there. Four grounded reasons, so don't re-litigate without new
information. **(1) A real one-way layer boundary.** `glyphs/` (layout) imports
*zero* rendering deps — no color, theme, peptide or Collector, only `Feature`,
`types.ts` and geometry helpers — while `glyphEmitters.ts` is saturated with
them (~41 refs). They communicate purely through the `FeatureLayout` tree plus
the `glyphType` tag, and layout output (heights) feeds main-thread row packing
*before* emit runs. That is a genuine phase split, not incidental file layout,
and co-location forces every glyph module to straddle both worlds. **(2)
Detection stays centralized regardless.** `findGlyph` is a precedence-ordered
decision tree (`guide_rna` → CDS+mature → repeat → containerTypes →
container-children → CDS-child → segments → box) — routing logic about
relations *between* glyphs, inherently central — so "everything about a glyph
in one file" is unachievable anyway. **(3) It reintroduces the indirection
just removed.** A registry brings back the `Record` and makes `Subfeatures`'
recursion dispatch *through* it (`GLYPHS[child.glyphType].emit(...)`) instead
of a visible recursive call; two readable switches beat a registry of paired
objects calling back into the registry. **(4) No drift pressure to relieve.**
Adding a glyph touches `types.ts`, `findGlyph` and one `emitGlyph` case, and
the `never`-default makes a missing emit case a compile error — the compiler
already enforces the coupling proximity would. The remaining two dispatches
are two different concerns in two layers, not the redundant dual-dispatch over
one thing that the old `GLYPH_EMITTERS`/`processSubfeaturesLayout` pair was.

Skipped with it as lateral: collapsing the five one-line layout wrappers
(`box`/`segments`/`processed`/`crisprGuide`/`repeatRegion.ts`) into a layout
`switch` symmetric with emit — it trades small dependency-free files
(preferred) for a switch with no correctness or drift benefit.

See [draw-pass-registries](../mechanisms/draw-pass-registries.md) §"Where it
stops" for why this is a different argument from the shared-pass-list rule,
and
[ADR-075](../architecture-decision-records/adr-075-the-isoform-cap-runs-in-the-worker.md)
for the isoform-cap placement the same doc got wrong — except it turns out it
did not: the placement it argued for is where the trim lives now
([ADR-092](../architecture-decision-records/adr-092-isoform-trimming-is-a-rung-of-the-fit-ladder.md)),
and what the doc got wrong was the cost of building it there.
