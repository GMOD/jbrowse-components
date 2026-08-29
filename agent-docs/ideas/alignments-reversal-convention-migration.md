---
name: alignments-reversal-convention-migration
description: "No-go, measured and declined 2026-08-28: migrating the alignments plugin from its positive-bpLen-plus-flipX reversal convention onto the tree's negated-bpRangeX convention. The blast radius is 13 of the plugin's 14 pass shaders, not the nine a census counted; the buys evaporate on measurement — packedColorQuad joining rowRect is blocked by the pixel-snap and row-band-anchor deltas too, so the convention is one of three blockers, the pileup row helpers cannot collapse while 8 other passes still read them, and MIN_DRAWN_ROW_PX is unreachable because the fit pitch floors at 1 CSS px — while the risks are concrete: gap's midpoint widening collapses a wide reversed deletion to 1px, overlap's signed width fades every reversed overlap to invisible, read's chevron/outline geometry is direction-laden, and not one test on any backend evaluates an alignments shader with u.reversed=1 or a negated span. Reopens if run-merged per-base cells land (per-base-wall candidate 4), or a GPU-side reversed-mirror gate exists first."
---

# The alignments reversal convention stays

**Verdict: no-go, measured and declined.** The alignments plugin keeps
positive `bpLen` plus a `reversed` uniform spent by `flipX` at the last line of
each vertex shader; the rest of the tree keeps the negated-`bpRangeX` pivot
(`bpRangeXTuple`, `writeBpRangeUniforms`). The warning at
`plugins/alignments/src/LinearAlignmentsDisplay/renderers/GpuAlignmentsRenderer.ts:118-123`
is correct as written and survives this review. Reopen conditions at the end.

The question this parks: `packedColorQuad.slang` (the modification and
per-base-quality cells) looks like render-core's `rowRect.slang` shape, and the
reversal convention was named as the one blocker on joining it. Measured, the
convention is one of three blockers, and the other two stand on their own.

## The two conventions

Both conventions produce the mirror image of the forward block. They differ in
where orientation lives.

- **Negated `bpRangeX`** (wiggle, MAF, variants, canvas, gwas, multi-row — the
  six renderers importing `bpRangeXTuple`/`writeBpRangeUniforms` from
  `packages/render-core/src/blockClipUtils.ts:53-83`): a reversed block pivots
  on `bpEnd` with a negated length, so `hpToClipX`
  (`packages/render-core/src/shaders/hpmath.slang:38-44`) maps bp to clip
  monotonically DECREASING. Orientation flows through every intermediate
  quantity: spans arrive backwards (`x2 < x1`), widths come out signed, and
  each shader's interior math must be orientation-tolerant —
  `extendToMinWidthPx` grows in the sign direction of `dx`
  (`hpmath.slang:124-135`), the canvas rect pass keeps its span signed and
  lerps (`plugins/canvas/.../passes/shaders/rect.slang:52-106`).
- **Positive `bpLen` plus `flipX`** (alignments): `bpToClipX` stays
  monotonically increasing, every shader builds its geometry in an unflipped
  frame, and the finished vertex is mirrored by one isometry —
  `flipX(x) = lerp(x, -x, u.reversed)`
  (`plugins/alignments/src/shaders/slang/alignmentsUniforms.slang:434-436`),
  usually via `flippedQuadPos` (`:800-802`) or `arcBandClipPos` (`:631-636`).
  Interior math never sees orientation.

One fact the "one convention tree-wide" framing misses: the negated convention
is itself two mechanisms. The canvas glyph passes negate `bpRangeX` for
POSITIONS and still carry a `reversed` uniform plus their own `flipX` for
DIRECTION scalars — strand arrows, intron chevrons, continuation markers
(`plugins/canvas/.../passes/shaders/featureGlyphUniforms.slang:26-27,58-62`).
A migrated alignments plugin would keep `u.reversed` regardless, because
`read.slang`'s chevrons are strand-laden. The migration deletes a spelling,
not a concept.

## Blast radius

13 of the 14 pass shaders on the shared alignments UBO call the flip family
(`flipX`, `flippedQuadPos`, `arcBandClipPos`); only `flatQuad.slang` (the
screen-px selection overlay) does not. A census that said nine counted the
pileup band and missed the four arc-band passes. Per shader, what the interior
assumes about monotonic bp→clip and what negated-`bpRangeX` would demand:

| Shader | Uses today | Under negation |
| --- | --- | --- |
| `read.slang` | `featWPx = (sx2-sx1)·canvasW/2` (:257), chevron caps built off `sx2 + chevronClip` / `sx1 - chevronClip` (:284-297), outline edge handoff keyed to `localPos.x` sides (:321-324) | The heavy one: abs the width, make both cap offsets and the `dxL`/`dxR` handoff sign-aware, and flip the strand gates the way canvas's arrow pass does |
| `mismatch.slang` | `pileupCellX` — both edges pixel-snapped, widened from the anchored start edge (`alignmentsUniforms.slang:668-674`) | Nearly free: `snapToPixelX` is orientation-neutral and `extendToMinWidthX` already grows in the sign of `dx`, so the anchor lands on the base's start edge (its right edge, reversed) by construction |
| `packedColorQuad.slang` | same `pileupCellX` (:35) | same — nearly free |
| `gap.slang` | `expandMinWidthX` about the midpoint (:58-59) | **Breaks silently**: `expandToMinWidthPx` demands an ordered span (`hpmath.slang:150-152` — "a span given backwards is always widened and comes back forwards"), so a 50px reversed deletion arrives as `dx = -50 < minWidth` and collapses to a 1px mark. Needs min/max first |
| `overlap.slang` | `pxW = clipLenToPx(sx2-sx1, ...)` feeds `overlapFade` (:77-79) | **Breaks silently**: negative width, `smoothstep(1.5, 12, negative) = 0`, every overlap on a reversed block vanishes. Needs abs |
| `insertion.slang` | point-centered bar + symmetric serifs (:117-120, :152-161) | nothing (drop the flip calls) |
| `clip.slang` | fixed 1px bar straddling a boundary bp (:35-41) | nothing |
| `connectingLine.slang` | two-edge quad via lerp (:31-38) | nothing — the HAL culls no backfaces, and `flippedQuadPos` already mirrors winding today |
| `linkedReadLine.slang` | endpoints to px, then a direction-agnostic segment frame (:81-103) | nothing |
| `arc.slang` | `arcBandX` (bpToLinear), then already `abs`/`min`/`max` on the pair (:273-282) | geometry survives; the arc UBO needs its own reversed pivot — `fillArcUniforms` pivots on `block.start` today (`GpuAlignmentsRenderer.ts:248,255-257`) — and the far-mate extrapolation through `blockStartPx`/`blockWidth` needs its precision re-checked against the bpEnd pivot |
| `arcFlat.slang` | `abs` on the span, midpoint center (:91-94) | same as arc |
| `arcLine.slang` | full-band tick at one x, symmetric dx pad (:82-100) | same as arc |
| `arcMarker.slang` | square centered on one x (:37-40) | same as arc |
| `flatQuad.slang` | screen px, no flip | untouched |

Instance buffers are untouched throughout: worker output is absolute genomic
uint32 (ADR-053 keeps layout on the main thread and coordinates absolute), so
no pack-time swaps exist on either side of the migration. The Canvas2D twins
are also untouched: `makeBpMapper`/`makeCellLeftMapper`/`spanLeft`
(`packages/render-core/src/canvas2dUtils.ts:452-567`) already carry
`block.reversed` and are convention-independent — the reversed-block family in
`packages/render-core/CLAUDE.md` serves the Canvas2D side and none of it
deletes.

Staging is the structural problem. All 13 shaders read one `Uniforms` struct
through one shared `bpToClipX`, so there is no per-pass switchover: either the
UBO write flips for every pass in one commit, or the struct temporarily
carries both `bpLen` and a signed `bpRangeX` with a second helper
(`bpToClipXSigned`) and each pass moves alone — which is the two-conventions-
in-one-plugin state the migration exists to end, held for the whole rollout.

## What it buys, measured

**(a) `packedColorQuad` joins `rowRect` — the join is blocked twice more, and
the line count is near zero.** The census estimate of ~40 collapsed lines
assumed `pileupRowTopPx`/`pileupY`/`pileupRowCenterPx`
(`alignmentsUniforms.slang:441-456`) and the JS twin `pileupRowY`
(`rendererTypes.ts:412-418`) fold into rowRect's row transform. They cannot:
eight other passes read them (every pileup shader plus the two line shaders
via `pileupRowCenterPx`), and those eight are not rowRect shapes — chevrons,
serifs, diagonal segment frames, centerlines. What actually deletes is
`packedColorQuad`'s ~10 vertex-stage lines, against a new
`RowRectUniforms`-bridge write in the renderer. And the convention is not the
only blocker:

- **Pixel snap.** `pileupCellX` snaps BOTH cell edges to pixel columns;
  `rowRectClipPos` (`rowRect.slang:128-144`) does not snap at all. Moving
  `packedColorQuad` onto rowRect geometry without moving `mismatch.slang` too
  re-opens the exact half-pixel disagreement between the five per-base layers
  that `pileupCellX`'s own header records fixing
  (`alignmentsUniforms.slang:659-667`).
- **Row-band anchor.** rowRect centers a floored band inside its row
  (`rowBandOffsetPx`, `rowRect.slang:110-118`); the pileup top-anchors the
  body inside the pitch. Mapping `rowHeight = featHeight + featSpacing`,
  `rowProportion = featHeight/rowHeight` shifts every cell down by
  `featSpacing/2` — 0.5px at default settings — and every Canvas2D twin and
  hit test would have to follow.

**(b) `MIN_DRAWN_ROW_PX` is theoretical here.** rowRect's 1px row floor
(`rowRect.slang:63`) exists for consumers whose rows genuinely go sub-pixel
(MAF at depth). Alignments rows cannot: fit mode floors the pitch at 1 CSS px
and scrolls instead (`fittedReadPitch`,
`LinearAlignmentsDisplay/groupLayout.ts:453-477` — `Math.max(1, pileupSpace /
rows)`), and the fixed-mode presets are integers ≥ 1. The benefit arrives only
if that floor is ever lowered, which nothing proposes.

**(c) One convention tree-wide — reduced to its real size.** The deletion set
is alignments' own `flipX`/`flippedQuadPos` wrappers and the five words of the
warning comment. The `reversed` uniform stays (chevrons), the render-core
reversed-block helpers stay (Canvas2D), the canvas plugin's direction-flip
`flipX` stays. What a reader must still learn — "positions negate, directions
flip" — is the same two-part lesson the canvas glyph passes already teach.

## What it risks

The reversed-region seam is the historically bug-rich one, and the migration
moves orientation from one audited line per shader into the interior of
thirteen. The existing coverage is real but sits almost entirely on the
Canvas2D side:

- `renderers/reversedMirror.test.ts` — the whole-draw-path mirror invariant,
  but it constructs `Canvas2DAlignmentsRenderer` (:302): reads/chevrons, gaps,
  the four 1bp-cell layers, soft-clip bases, insertions, overlaps, connecting
  and linked-read lines, coverage, and the SVG selection box, forward vs
  reversed. Its fixture carries no clip bars (`numSoftclips: 0`, :181-182) and
  an empty `arcsRpcDataMap` (:308), so the clip layer and the whole arc band
  have no reversed test even there.
- `renderers/cellPainterParity.test.ts` (:175, :190) — the five cell painters'
  reversed anchor, Canvas2D.
- `features/{gap,mismatch,softclipBases,perBaseQuality}/markParity.test.ts` —
  each sweeps `describe.each([false, true])` over reversed, Canvas2D/marks.
- `features/coverage/hitTest.test.ts:255` — reversed pixel widening, CPU.
- `blockClipUtils` and `canvas2dUtils` tests in render-core, and the canvas
  plugin's `reversedGlyphDirection.test.ts` — CPU and Canvas2D.
- Browser tests: `suites/hic.ts:102` is the only reversed-region scenario in
  the whole suite; no alignments browser test flips a view.

**Nothing on any backend evaluates an alignments shader with `u.reversed = 1`
or a negated span.** The GPU reversed path is pinned today by the review-level
argument that `flipX` at the last line is an isometry — an argument the
migration destroys and replaces with per-shader interior audits that no gate
checks. `reversedGlyphDirection.test.ts:1-13` names the reason the
cross-backend parity gate cannot stand in: both backends read the same genomic
field, so a missing flip is missing identically in both and the differential
sees two agreeing wrong answers. The three known breakage points (gap's
collapse, overlap's vanish, read's caps) would all land exactly there —
reversed-only, GPU-only, invisible to every existing test.

## The counter-case, answered

Is alignments' convention the better one the rest should envy? No — neither
dominates, and which is better is a property of the pass list. The negated
pivot is the right call for orientation-free rect grammars: rowRect's three
composers (MAF, multi-row, wiggle density) get reversal for free in the data
path, with `extendToMinWidthPx`'s sign rule as the one obligation. The
final-mirror is the right call for a plugin where 5 of 13 passes carry
direction or asymmetric geometry (read's caps and edge flags, insertion's
serifs, gap's centerline vs rect split, the arc band's leg frames): mismatch,
gap, overlap and read under negation each need the abs/min/max the warning
predicts, while under the mirror their interiors are orientation-blind. The
tree pays for this fit with a second convention — a documentation cost, paid
in the warning comment and in this file, not a defect cost: the GPU alignments
path has no reversed-region bug on record, while the Canvas2D side, which has
no final-mirror available, accumulated the entire reversed-block family.

## What would reopen this

- **Run-merged per-base cells land** —
  [per-base-wall-at-wide-zoom](per-base-wall-at-wide-zoom.md)'s fourth
  candidate gives the 1bp cell an explicit span. That dissolves `pileupCellX`
  (the snap blocker) and makes the cells genuine `[startBp, endBp)` runs —
  rowRect's exact instance shape, MAF's exact precedent. The join stops being
  a convention question and becomes the same composition wiggle density made;
  do it then, for the two cell shaders alone, leaving the other eleven on the
  mirror.
- **A GPU-side reversed gate exists first.** A mirror invariant over the
  vertex math (each pass's generated or emulated vertex stage run forward and
  reversed, marks compared as `x → W - x - w`), or a browser scenario table
  with a flipped view per alignments figure. Built BEFORE any convention
  change, this converts the main risk from unreviewable to testable — and it
  is worth building even with no migration, since the clip layer and the arc
  band have no reversed coverage today.
- **The 1px fit floor is lowered** (`LinearAlignmentsDisplay/groupLayout.ts:476`), making sub-pixel
  rows real and `MIN_DRAWN_ROW_PX` a live benefit rather than a theoretical
  one.

If reopened, the staging that survives this review: (1) the GPU reversed gate,
armed on the current convention and green; (2) the per-base cell shaders only,
riding the run-merged-cells change, parity gate `cellPainterParity` extended
to the GPU twins plus the mirror gate; (3) stop there unless a measured defect
in the mirror convention itself appears. Kill condition at every stage: any
reversed-only pixel diff the mirror gate attributes to an interior sign, or
the two-conventions-in-one-plugin bridge (`bpToClipXSigned` beside
`bpToClipX`) surviving longer than one release.
