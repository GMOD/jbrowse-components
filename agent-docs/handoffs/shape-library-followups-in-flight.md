---
name: shape-library-followups-in-flight
description: Four follow-ups to the a-shape-composes-a-scale plan died mid-flight on a rate limit (2026-08-28), each in its own uncommitted-or-partial worktree under .claude/worktrees/ — a capsule shape module (early, and the cap policy REVERSED mid-run is recorded only here), the MAF/MAPQ/wiggle defect batch (item 1 committed, item 2 mid-emitter-change), the legend seam closure (complete but uncommitted, "all green" untypechecked), and the bpLen-convention assessment (idea doc drafted, unverified). Landing order, per-thread resume instructions, and the decisions that live nowhere else.
---

# Shape-library follow-ups in flight

Four worktrees hold work interrupted by a session rate limit on 2026-08-28,
after the whole `ideas/a-shape-composes-a-scale` plan landed (ADR-094, Steps
2–4 resolved on main through `83ac4507cf`). **Do not remove these worktrees
until each thread lands or is deliberately abandoned.** Each subsection gives
the state, what remains, and the decisions a resuming agent cannot recover
from the tree. Delete this file thread by thread as they land.

Landing order when resuming: **defects → legend → capsule → assessment.** The
defects and capsule threads both edit `alignmentsUniforms.slang` (directive
header vs the `:260-291` capsule region) and both run `gen:shaders` — land
defects first, rebase capsule, regenerate rather than merge any
`*.generated.ts` conflict. The legend thread is disjoint from both except for
distinct sections of the idea doc.

## 1. Defects batch — `.claude/worktrees/agent-a09786b1a37aa04af`

**State**: item 1 of 4 committed (`c93b7bc3e0` — MAF's `rowBandGeometry` now
takes the shader's 1px floor via the generated `rowBandPx` twins). Item 2
(MAPQ hue parity test) died in progress with uncommitted edits to
`alignmentsUniforms.slang` (adding `hueRampHalfSat` to `js-export`) **and to
`packages/shader-tools/src/shader-codegen/wgslToJs.ts`** — the export
evidently needs an emitter change; the agent's last words were "Now the
emitter changes", so treat the wgslToJs diff as unfinished and verify it
against a fresh `gen:shaders` run before trusting it.

**Remains**: finish item 2 (parity test sweeping MAPQ 0..255 against
`colorUtils.ts` `hsl(${mapq},50%,50%)` — HSL L=0.5,S=0.5 ⇒ C=0.5, m=0.25);
item 3 — the missing wiggle reorder-no-refetch test (templates:
`variants/.../rowPlacement.test.ts:102-109`,
`maf/.../singleFetchPerRegion.test.ts:279`); item 4 — retire Level 2 of
`ideas/a-display-declares-itself` with the 2026-08-28 re-census verdict.

**The Level 2 verdict, recorded nowhere else**: the placement primitive is
dead on current evidence. Packing already merged the narrow way
(`packages/core/src/util/layouts/placeRect.ts`, whose header `:9-34` argues
against merging further; canvas's packer is stateful and self-seeding —
`layout.ts` `seedRowsFrom` :865, probe interaction :891-899). The unplaced-row
conflict is five consumer-correct conventions: MAF drops at `-1`
(`placeMafRows.ts:22-26`), variants keeps `HIDDEN_ROW` `0x00ffffff`
(`constants.ts:34-40`), multi-row returns `undefined` because its walkers
branch per feature anyway for legend toggles (`featurePainting.ts`), wiggle
silently omits (`buildSourceRenderData.ts:171-209`), canvas packing uses
`OFFSCREEN_Y` `-1e6` with `isPlacedRow` (`rowPlacement.ts`). Opposing named
tests pin the two original sides (`placeMafRows.test.ts:65` vs
`rowPlacement.test.ts:141`); eleven behavioral tests already enforce the
reorder-never-refetches invariant. Item 3's new wiggle test is the census's
one residue. Also update the doc's description and its "Only Levels 2 and 4
stand" bullet — after this, only Level 4 stands. Verify each cite before
writing; re-check against the worktree, not this file.

## 2. Legend seam — `.claude/worktrees/agent-ae6b962b342f8592c`

**State**: no commits, but the change set looks complete and the agent
reported "All green. Now typecheck." — it died before typecheck, `build:esm`,
`test-related`, and committing. Uncommitted: `stopsFromRampLut` in
`packages/core/src/util/colorRamp.ts` (+test), HiC's `getLegendStops` and
LD's `LDColorLegendContent` moved onto it, wiggle's `ScoreLegend.tsx` +
`wiggleDisplayViews.ts` threading `densityColorRamp` into `scoreRamp` (the
actual defect: the legend described the default fade under a named ramp),
parity-test extensions, and the idea doc's seam paragraph.

**Remains**: the full verification ladder (typecheck, `test-related`,
`lint --fix`, `build:esm` since core's exported surface changed), then commit.
Constraints that still bind: HiC's `colorRamp.test.ts:123-142` must stay green
untouched; synteny joins only with zero format flags (its LUT is packed-ABGR
feeding an instance lane, not an RGBA texture — check whether the diff
included it, and drop it if it needed a flag); labels/ticks/applies-predicates
stay per-display.

## 3. Capsule module — `.claude/worktrees/agent-a9e2663f8be45775d`

**State**: no commits. Uncommitted: new
`packages/render-core/src/shaders/capsule.slang` plus edits to
`dotplot.slang`, `wiggleLine.slang`, `alignmentsUniforms.slang`. Early —
gen:shaders had not been run, no exports-map entry, no tests. It is unknown
whether the agent processed the mid-run direction change below; audit the
draft against it before continuing.

**The cap policy, REVERSED mid-run by the user and recorded only here**: no
rounded caps on alignments arcs/linked reads. Do NOT add `lineCap:'round'` to
`features/arcs/drawCanvas.ts` or `features/linkedReads/drawCanvas.ts`. Round
caps stay only where mechanical: dotplot (the width slider modulates line↔dot;
the dot IS the degenerate round cap) and wiggleLine linecenter (coincident
round caps make its max-blend joins seamless). For the alignments pair, either
make the GPU coverage butt-capped to match Canvas2D as-is, or — if that is
awkward — fix the misleading "butt-capped" comments (the GPU math inks a
capsule) and record the ≤halfWidth overhang as a known divergence. A cap-style
flag parameter is a kill; two named coverage entry points with two consumers
each (the `rampColor`/`rampColorPremultiplied` pattern) is the acceptable
shape.

**Design brief that still stands**: four primitives (`capsuleFrame`,
`capsuleQuadLocal`, `capsuleDist`, `capsuleCoverage`) taking bare floats — no
`Uniforms` struct, no mode flags, no single-caller parameter. Four consumers:
dotplot, wiggleLine linecenter, `arcFlat`, `linkedReadLine` (the alignments
pair already extracted the math locally at `alignmentsUniforms.slang:260-291`
citing ADR-040). Unify the degenerate-guard threshold (1e-3/1e-4/1e-4 is
drift) and prefer the pad at `aaHalfPx(dpr)` (all three AA ramps are the same
`1/dpr` width; wider pads change no drawn pixel — verify via parity suites).
`STROKE_AA_PX` stays in alignments (dashCoverage and `arc.slang` size off it).
Fix `strokeCoverage`/`strokeAaRamp` taking `Uniforms u` against ADR-040's
granularity rule. Gates: `dotplot.slang` 75 → ~59-61 non-comment;
wiggleLine sheds its `import pointGlyph` (used only for `AA_PAD_PX`);
alignments parity suites untouched-green. Results go in a dated block after
Step 4's "Stopped 2026-08-28" block in `ideas/a-shape-composes-a-scale.md`.

## 4. bpLen-convention assessment — `.claude/worktrees/agent-a78e15a55facee98c`

**State**: investigation complete, and the untracked draft
`agent-docs/ideas/alignments-reversal-convention-migration.md` exists but the
agent died while writing it — read it as possibly truncated and verify every
cite. Nothing else in the worktree.

**Remains**: finish/verify the doc (verdict at top — go with staged gates, or
no-go with a reopen condition), frontmatter, `pnpm autogen`, commit. The
question it answers: is migrating alignments off positive-`bpLen`-plus-`flipX`
onto negated-`bpRangeX` worth a nine-shader change (the warning at
`GpuAlignmentsRenderer.ts:117-122`), where the prize is `packedColorQuad`
joining `rowRect` (~40 lines), `MIN_DRAWN_ROW_PX` for alignments, and one
reversal convention tree-wide — argued against the honest counter-case that
alignments' convention may be the better one.

## Resuming any thread

Each worktree is on branch `worktree-agent-<id>`, based on main at
`83ac4507cf` or earlier. Enter it (`EnterWorktree` with `path`), audit the
uncommitted diff against this file's brief before adding to it,
`git rebase main`, and finish to the repo's definition of done
(`agent-docs/CLAUDE.md`): `gen:shaders` exit-code-checked where shaders
changed, typecheck, `pnpm test-related`, `lint --fix`, `build:esm` where an
exported surface moved, `pnpm autogen` where descriptions or slots moved.
Land as fast-forwards in the order at the top.
