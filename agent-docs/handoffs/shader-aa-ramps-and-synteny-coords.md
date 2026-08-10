---
name: shader-aa-ramps-and-synteny-coords
description: Six landed shader commits (2026-08-10) fixing antialiasing ramp width and vertex padding across synteny, dotplot, the point glyphs and hi-C, plus a synteny hover-alpha inversion — all verified by unit tests and reasoning only, with NO visual or cross-backend check run. Read before touching an AA ramp in any 2D mark shader. Also holds the one decision left open and deliberately declined: whether synteny should stop baking window-relative coordinates into its worker output and adopt dotplot's absolute-Float64 shape, with the byte cost that motivated the refusal.
---

# Shader AA ramps, and the synteny coordinate question

Two threads, and they are independent. §1 is a **decision left open** that wants
a second opinion. §2–3 are **landed work that has never been looked at**, which
is the other reason this file exists.

Everything below is on `main` in the primary checkout as of 2026-08-10.

## 1. The open decision: synteny's window-relative worker output

**Nothing in the six commits changes any coordinate scheme.** This is a question
that came up while reading, not a change under review. Establish that first,
because the thread started from the opposite impression.

### The state of things

`agent-docs/reference/BP_PRECISION.md` §"Synteny + dotplot" is canonical and
current. Both plugins store corners relative to a per-axis fetch-time base
(`base = offsetPx * bpPerPx`) and reconstruct screen X as
`bpRel * bpPerPxInv + panPx`. It replaced a hi/lo hp-math split, in
`dccb316fa0` (synteny) and `46d76babc7` (dotplot).

The two **diverge on where the relative form lives**, and that is the whole
question:

| | geometry arrays | base subtracted at |
| --- | --- | --- |
| dotplot | absolute Float64 cumBp | GPU upload (`instanceInterleave.ts`) |
| synteny | window-relative Float32 + `base0`/`base1` | the worker, at emit |

So synteny is the one that puts relative coordinates into the data model and
across the RPC boundary. Dotplot's Canvas2D/SVG renderers read absolute cumBp
directly; synteny's CPU pick path was built to read the window-relative values,
so its `base` is load-bearing in a way dotplot's is not.

It brushes against the repo `CLAUDE.md` line "Worker output is absolute genomic
uint32 — no regionStart-relative arithmetic crosses the worker boundary", but
does not straightforwardly violate it: synteny's base is a **viewport** base, not
a regionStart, it is refetched when the window moves, and `base0`/`base1` travel
with the data so no consumer has to guess it.

### Why it was declined

Asked to use judgment, I declined to move synteny onto dotplot's shape. The
reasoning, so it can be argued with rather than re-derived:

- Corners are synteny's largest per-instance array. Absolute means Float64:
  **16 bytes/instance of corners becomes 32**. The plugin's own comments size the
  target at 500k instances on whole-genome PAF (`instanceInterleave.ts`,
  `syntenyPickEngine.ts`), so roughly **+8 MB per region**, across the RPC and
  then resident in `SyntenyGeometryCache`, per level.
- `BP_PRECISION.md` names "half the position bytes" as a goal of the refactor
  that introduced the scheme. Undoing it buys consistency and spends a measured
  win.
- It is not a buffer-format change. The CPU pick path
  (`syntenyPickEngine.ts` / `projectCorners`) reads the relative values today, so
  it moves too.

### What would change the verdict

Any of these, and it should be done:

- A decision that one coordinate story across the fleet is worth the bytes
  regardless — a legitimate call, and not mine.
- Evidence the 500k-instance case is not the one to optimize for.
- A third consumer arriving that needs absolute cumBp on the main thread, at
  which point synteny is paying the conversion anyway.

**Do not** split the difference by leaving the worker relative and converting on
arrival: that is the current cost plus a copy.

## 2. What landed, and what has NOT been checked

Six commits. Every one is a **rendering** change, and every one was verified by
unit test and by argument. **None was visually verified, and no cross-backend or
browser test was run on any of them.** That is the single biggest gap here and
the main thing a second pair of eyes is for.

| sha | what |
| --- | --- |
| `f96108bad9` | synteny: `fillShade` hover cap applies to the boost, not the alpha |
| `75e0db7602` | synteny: `ribbonEdges` is the one corner→edge pairing; `Corners` struct dropped for `float4` |
| `f082bad29f` | synteny: `clipSyntenyFeature` early-out for off-window CIGAR blocks |
| `333477b51c` | dotplot: analytic AA half-width, and a quad padded to hold the ramp |
| `c7ebdf6d9b` | glyphs: `glyphEdgeAlpha` sizes the ramp from the SDF's own gradient |
| `4261bbfe40` | hi-C: discard bins the Canvas2D/SVG path already skips |

### The unifying finding

Four of the six are the same bug in different shaders: **an AA ramp whose width
was measured with `fwidth` and/or whose geometry had no room for it.** `fwidth`
is `|ddx| + |ddy|`, which overshoots a true gradient by up to √2 — worst on
diagonals, which is what all of these marks are made of. Where it was also used
as the smoothstep's *half*-width, the ramp came out 2–2.83 output pixels instead
of 1.

The right ramp width depends on what the SDF is measured in, and the three cases
are genuinely different — this is the transferable part:

- **Distance already in pixels** (synteny `perpCoverage`, dotplot capsule):
  `|∇d| = 1`, so the half-width is the constant `0.5/dpr` and there is nothing to
  differentiate. Needs a `devicePixelRatio` uniform.
- **SDF in quad-local units** (`pointGlyph`, manhattan): the conversion to pixels
  *is* the gradient, and it differs per shape — the disc and triangle carry unit
  gradients, the diamond's L1 norm carries √2. Must be measured:
  `length(ddx, ddy)` taken as the **full** width.
- **Tiled cells** (hi-C bins): no per-quad AA at all, deliberately. Bins share
  exact edges after a linear transform; antialiasing them individually produces
  seams.

`wiggle.slang`'s capsule already had this right and says so in a comment that
names synteny. It was the corroborating case, not a target.

### Where to look hardest

Ranked by how likely I am to be wrong:

1. **Nothing has been looked at.** Suites exist for every view touched:
   `synteny.ts`, `grape-peach-synteny.ts`, `hs1-mm39-synteny.ts`,
   `multi-way-synteny.ts`, `dotplot.ts`, `hic.ts`, `gwas.ts`,
   `gwas-locuszoom.ts`, `wiggle-color.ts` under
   `products/jbrowse-web/browser-tests/suites/`. `pnpm test:browser:compare`
   is the differential oracle and needs no golden — see
   `handoffs/cross-backend-gate-ci.md` before reading its output, especially the
   part about blank captures.
2. **The dotplot quad grew and was never measured.** Every capsule quad is now
   `halfWidth + aaHalf` on both axes instead of `halfWidth`. At the default
   `lineWidth` 2.5 that is ~40% more rasterized area per instance. A `discard`
   was added for the fragments the pad introduced, but the **net** effect on a
   dense plot is reasoned, not measured. If it is negative, the pad is still
   correct and the discard is the lever.
3. **The glyph ramp got narrower** (2–2.83 → 1 device px), so discs and diamonds
   will read crisper than before. I believe 1px is right because it matches every
   other mark in the app and `SMALL_POINT_MAX_DIAMETER` already routes ≤3px
   points to crisp squares — but it is a visible change and nobody has seen it.
4. **`fillShade` at high opacity.** The fix stops hover *reducing* alpha, but for
   `a ≥ 0.35` it now leaves alpha untouched and hover shows only as `hoverDarken`'s
   0.7 on the rgb. Whether that is enough feedback at opacity 1.0 is a design
   question, not a correctness one. A small relative boost is the alternative.
5. **`clipLargeBlockToWindow`'s new pre-gate assumes the CIGAR's span matches
   `end - start`.** A malformed CIGAR that walks past `end` could have an op
   inside the window that the gate now skips. Every other consumer would already
   be mis-drawing such a block, so this was accepted — but it is an assumption
   that was not there before.

### Verifying the landed work

```
pnpm test plugins/linear-comparative-view/src plugins/dotplot-view/src \
         plugins/hic/src plugins/gwas/src plugins/wiggle/src \
         packages/render-core/src
pnpm typecheck
```
190 suites / 1709 tests green at the time of writing, typecheck exit 0. The new
model tests are
`shaders/dotplotCapsulePad.test.ts` and `shaders/glyphEdgeAlpha.test.ts`, both
built like the pre-existing `syntenyFillPad.test.ts`: they mirror the shader in
TS and assert the geometry contains everything the fragment shades, each with
the retired spelling pinned as a counterexample. They model the shader; they do
not read it, so a `SYNC` comment is what keeps them honest.

## 3. Do not re-derive

Checked during this session and closed. Each cost real time.

- **Hi-C is not a precision problem.** `diagonalGrid.slang` says its grid units
  are "genomic bp for Hi-C", which reads like the Gbp-scale Float32 hazard
  synteny and dotplot both had to solve. It is not: positions are built as
  `u = (contactBin + off) * w` with `w = res / (bpPerPx * √2)`
  (`executeRenderHicData.ts`), so they are viewport-pixel-scale. Float32 is fine
  and no base/pan scheme is wanted.
- **The hi-C ramp texel pick differs between GPU and CPU by up to half an entry**
  (sampler texel-center convention vs `round(t * 255)`). Sub-visible on a
  256-entry smooth ramp. Deliberately not closed; closing it adds machinery for
  no effect.
- **Synteny's instance-capacity bound cannot be tightened to the emit window.**
  It looks loose (`buildSyntenyGeometry`, `cigarBudget` from the full feature
  width) but `segmentOffScreen` drops a segment only when it is off-window on
  *both* axes, so a segment can survive on axis 1 while far off axis 0. The bound
  really is `widthPx0 + widthPx1`.
- **A GPU-side cull for dotplot is not obviously worth it.** `drawDotplotInstances`
  culls on the CPU and notes 87% of a fetch is offscreen, but dotplot quads are a
  few px, so the rasterizer discards them about as cheaply as a vertex test
  would. Synteny's `isCulled` earns its place because its quads span the track.
- **`syntenyFillPad.test.ts` could not catch a corner→edge pairing drift** — it
  models the polygon and the analytic clip from one copy of `fillEdges`, so it
  assumes the agreement it appears to test. That is why `ribbonEdges` exists;
  the property is now structural rather than tested.

## 4. Shared-checkout hazards hit while doing this

All in the primary checkout, all with other agents active. Recorded because each
cost a diagnosis:

- **`git commit -- <pathspec>` takes the working tree at those paths**, so
  `f96108bad9` swept in a refactor its message doesn't name. Amending is barred
  here (it rewrites whatever is at the tip, possibly another agent's commit), so
  the overlap is named in `75e0db7602`'s message instead.
- **`pnpm gen:shaders` regenerates every shader in the repo**, not just yours.
  Another agent's `chore(shaders): regenerate after the js-skip directives`
  (`81ff0cb2dc`) landed *my* `pointGlyph.generated.ts` and
  `manhattan.generated.ts` under their commit while my `.slang` sources were
  still uncommitted. Commit sources promptly, or work in a worktree.
- **`jest.config.js`'s `.claude/` ignore is essential and recent**
  (`824e95eda3`). Without it a nested agent worktree gives jest-haste-map
  duplicate `packages/__mocks__/**` and duplicate `plugins/*/package.json`, and
  the latter is a hard `_assertNoDuplicates` throw that fails every
  cross-package suite. Already fixed; do not re-diagnose.

## Related

- [reference/BP_PRECISION.md](../reference/BP_PRECISION.md) §"Synteny + dotplot"
  — the canonical account of the coordinate scheme in §1.
- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  — why `fillShade`, `mapHicCount` and `MIN_VISIBLE_ALPHA` are generated rather
  than mirrored. Three of the six commits lean on it.
- [handoffs/cross-backend-gate-ci.md](cross-backend-gate-ci.md) — read before
  interpreting any `test:browser:compare` run, particularly on blank captures.
