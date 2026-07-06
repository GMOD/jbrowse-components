# ADR-033: Synteny/dotplot LOD — prune at the data layer, draw survivors crisp at the shader

## Status

Accepted (threshold + label changes). The "extend the density width-fade to
CIGAR indel tiles" alternative is **Rejected** for now (see Reasoning); a
smaller follow-up is **Deferred** pending concurrent shader work.

## Context

The linear-comparative-view (and dotplot) level-of-detail system was pruning
CIGAR detail too aggressively. The desired behavior, in the user's words: get
"frission" from seeing small details — "even 1px details can be interesting" —
without "overload by rendering a 1 base pair insertion when viewing a 1 million
base pair window." The user also found the `Auto`/`Fine`/`Coarse` menu labels
uninformative.

"LOD" here is actually **three independent mechanisms**, only one of which is
the menu:

- `lodMode` (Auto/Fine/Coarse) — a *data-tier* switch, PIF-with-coarse-tier
  only (`make-pif --coarse`). Fetches the no-CIGAR tier when
  `bpPerPx >= coarseBpPerPxThreshold` (default 10000). Extreme zoom-out only.
- `MIN_CIGAR_PX_WIDTH` — per-*block* gate. A feature whose on-screen span is
  below this parses/emits no CIGAR at all
  (`buildSyntenyGeometry.ts`, `dotplotGeometry.ts`, and the parse gate in
  `executeSyntenyFeaturesAndPositions.ts`).
- `MIN_INDEL_PX` + the `span <= bpPerPx` accumulation in
  `visitCigarRenderedSegments` (`packages/cigar-utils/src/cigarOpsVisitor.ts`) —
  per-*op* gate. Individual indels below ~1px merge into surrounding match
  context.

## Decision

1. **Relax the two hard gates**, keeping the true sub-pixel guards:
   - `MIN_CIGAR_PX_WIDTH`: synteny `8 -> 2`, dotplot `4 -> 2`.
   - `MIN_INDEL_PX`: `2 -> 1` (shared visitor; synteny + dotplot only — not the
     alignments pileup, which does not use `visitCigarRenderedSegments`).
   - Left untouched: `coarseBpPerPxThreshold` and the `span <= bpPerPx`
     match-accumulation — these are the correct whole-genome guards.

2. **Relabel the menu** (synteny + dotplot) from adapter-tier jargon to what the
   viewer sees: `Automatic (by zoom)` / `Indels + mismatches` /
   `Alignment blocks only`, with matching helpText.

3. **Frission-vs-overload is resolved by layering, not by a single tunable:**
   overload is pruned at the **data layer** (block gate + op merge decide *what*
   geometry exists); survivors render **crisp** at the shader layer. Do **not**
   add the BASE-ribbon density width-fade to CIGAR indel tiles.

## Reasoning

### The block gate is a parse/perf change, not a frission lever

Verification (isolated A/B, real WebGL harness) showed `MIN_CIGAR_PX_WIDTH`
`8 -> 2` produces **no visible change** even on a view whose blocks sit squarely
in its target window (grape-peach zoomed dotplot, blocks ~2-3px): a 2-8px
block's *internal* indels are themselves sub-pixel, so parsing them adds nothing
on screen. Lowering it is still worth doing (it aligns the block gate with the
op gate and trims redundant hiding) but its real payoff is avoiding parse of
multi-MB CIGARs, not detail.

### `MIN_INDEL_PX` is the actual frission lever, and it is conservative

The change surfaces indels in the (1px, 2px) band — ones OLD merged, NEW draws.
A/B on volvox two-row synteny: **86 px changed at ctgA:1..1200 (~1.5 bp/px),
0 px at ctgA:1..600, and 0 px across all 18 corpus snapshot tests** (whole-genome
to high-zoom). The effect is real, localized, and inherently small — which is
correct: it only ever surfaces 1-2px detail.

The old 2px floor existed to suppress 1bp-indel aliasing on noisy long reads;
the concurrent CIGAR-fill rework fades sub-pixel indels by true coverage instead
of aliasing, so `1` is safe.

### Why NOT extend the density fade to indels (the rejected "ideal")

`fillCoverage` already has a density-honest width-fade for BASE ribbons
(`WIDTH_FADE_FLOOR`, opt-out via `fadeThinAlignments`): a lone thin ribbon stays
faintly locatable, a dense hairball fades and only reads bright where alignments
genuinely pile up. It is tempting to give CIGAR indels the same treatment so a
lone small indel pops and a dense field self-regulates.

This is the wrong layer:

- Overload from small indels is **already** prevented upstream — the block gate
  emits no indel geometry for sub-2px blocks (so a 1Mb window is clean by
  construction), and the op merge folds sub-pixel indels into match context.
  The "1bp insertion in a 1Mb window" never reaches the GPU.
- Anything that survives those gates is genuinely ~1px+ and *is* the frission —
  fading it would blur exactly the detail we want to pop. The shader's current
  choice ("indels are zoomed-in detail that should stay solid") is correct
  given the data-layer pruning.

So the density-honest goal is met by **prune-then-draw-crisp**, not
**draw-everything-then-fade**. Adding a shader fade would reduce frission to
solve an overload that no longer exists at that layer.

### Shared-worktree constraint

The residual polish — unifying indel and ribbon density behavior under one
`fadeThinAlignments` toggle — lives in `fillCoverage`, which was being actively
rewritten by concurrent work during this change (it moved from
solid-fill+MSAA to shared-analytic-AA mid-session). Forking it now risks a
merge conflict and the seam-bleed bug that rework exists to fix. It is left for
coordination once that work lands.

## Consequences

- Small blocks and 1-2px indels now show detail; sub-pixel detail and
  whole-genome views are unchanged (no regression, no flood).
- `MIN_CIGAR_PX_WIDTH` and `MIN_INDEL_PX` are intentionally kept in step; a
  future change to one should reconsider the other.
- **Deferred:** once the concurrent `fillCoverage` rework lands, revisit whether
  a dense mid-zoom rearrangement (BASE ribbons fade via `fadeThinAlignments`
  while their indels stay solid) warrants unifying both under one density path.

## Related

- ADR-005 (shader codegen — never hand-edit `*.generated.ts`)
- ADR-012 (synteny worker output split)
- ADR-023 (synteny per-instance pad memory)
- ADR-024 (per-backend snapshots on real GPU — the verification harness used here)
