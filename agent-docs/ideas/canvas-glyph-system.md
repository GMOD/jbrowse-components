---
name: canvas-glyph-system
description: The compact-mode subfeature-label overlap bug and why its fix belongs in main-thread packing, the per-glyph `{layout, emit}` registry rejected for four grounded reasons, and the per-gene isoform cap (top-N not first-N, main thread not worker).
---

# Canvas glyph system (plugins/canvas RenderFeatureDataRPC)

Context after the 2026-07 emit-dispatch unification (`emitGlyph` — one recursive
switch replacing the old top-level `GLYPH_EMITTERS` record + hand-written
`processSubfeaturesLayout` child if/else). Two follow-ups came out of that pass.

**Bug (deferred, documented in `labelUtils.ts`): compact/superCompact +
`subfeatureLabels: 'below'` under-reserves the label row → stacked transcript
labels overlap the next row.** `applyLabelDimensions` reserves a raw
`LABEL_FONT_SIZE` in the worker's normal-mode units, baked into child y offsets;
the main thread then scales *all* geometry by `HEIGHT_MULTIPLIERS`
(compact 0.6 / superCompact 0.3). But the label is drawn at
`labelFontSize() = LABEL_FONT_SIZE × LABEL_FONT_MULTIPLIERS`
(0.85 / 0.7 — deliberately gentler so superCompact labels stay legible). So the
reserved slot ends up smaller than the drawn label in dense modes. Correct in
normal mode (both ×1), which is why tests didn't catch it. **Why it's hard:** the
worker→main boundary is flat parallel arrays and the intra-gene stacking is
computed in the worker, which is intentionally mode-agnostic so a compact toggle
never triggers a re-fetch (see ARCHITECTURE.md). Passing the mode/ratio to the
worker would break that; the correct fix is to move the subfeature-label row
reservation to the main thread's `packRef` (LinearBasicDisplay/layout.ts), where
`labelFontPx` and the mode are already known — i.e. stop folding the label gap
into worker geometry entirely and add it as a separately-scaled row during
packing. Narrow cosmetic overlap, so left unfixed until it's worth a dedicated
browser-verified pass. Cross-ref
[display-height-redesign.md](display-height-redesign.md).

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

**Cap isoforms per gene at top-N, with a "show N more" affordance.** Absorbs the
old one-line "Isoform expansion" entry from the UI / UX section. The gap is
narrower than it first sounds, and the design turns almost entirely on *which
thread* the cap runs on.

`geneGlyphMode` already defaults to `auto`, which resolves (model.ts,
`effectiveGeneGlyphMode`) to `longestCoding` above 100 bp/px and `all` below. So
the zoomed-*out* case is handled and has been since the gene-glyph control
landed. The uncapped case is zoomed *in*: park on one 30 kb Gencode gene in a
1000 px window and you are at 30 bp/px, so `auto` gives you `all`, and a
40-transcript gene owns the track.

**"First N" is the wrong selector — it wants to be "top N."** GFF child order is
arbitrary, so a first-N cap routinely hides MANE Select and shows a
retained-intron fragment. The ranking already exists: `longestCodingTranscript`
(`glyphs/subfeatures.ts`) is top-1 by summed CDS length with a widest-span
fallback for non-coding genes, and it carries a CDS dedupe (Gencode duplicate CDS
rows) plus a tie-break that fixtures depend on. Generalizing that reduce to top-N
inherits all of it; anything else re-derives it worse.

**The cap belongs on the main thread, not in `layoutSubfeatures`.** Cross-gene
row packing is already main-thread (`LinearBasicDisplay/layout.ts`,
GranularRectLayout); only the within-gene isoform stack is computed in the
worker. And `rpcProps()` is the RPC cache key — `baseModel.ts` carries a long
list of slots that were silent refetch triggers, `height` among them, removed
because the resize handle wrote it every drag frame. A per-gene expanded-set in
`DisplayConfig` is exactly that mistake again: every "show 12 more" click clears
and refetches every visible region.

If instead the worker emits all isoform children with a rank, and the main thread
sums only the visible ones to get the gene's height, per-gene expansion is a
relayout with no round-trip — the same split `displayMode`'s compact scaling
already uses, for the reason stated at the top of `renderConfig.ts` ("displayMode
is NOT sent to the worker ... so switching modes skips an RPC round-trip"). Keep
worker-side `longestCoding` for the zoomed-out case, where cutting payload
genuinely matters; the cap is a zoomed-in concern, where it does not.

**The button is the expensive part, not the cap.** The track paints to canvas, so
"show N more" is not a DOM button — it needs a painted label, a hit region that
is not a feature, and click routing that does not open the feature detail widget.
That is the actual project. The cap itself is small.

So the order is: ship the cap as a fourth mode on the existing `GeneGlyphControl`
chip, reusing the chrome that is already built — no new hit-testing, no per-gene
state — and see whether that alone kills the annoyance before building the
per-gene button.

On the default, prefer generous: 10, not 3. Seeing every isoform is frequently
*why* someone zoomed into a gene, so a tight cap is a more opinionated default
than `auto` is today; at 10 it fires only on genuinely pathological genes. Side
benefit worth having either way — bounded per-gene height makes fit-to-height
much better behaved on Gencode than it currently is.

One concrete gap in the existing data: the worker emits `hasMultipleIsoforms` and
`isoformsCollapsed` as booleans, and "show 12 more" needs the count.
