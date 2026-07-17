---
name: reversed-region-audit
description: Auditing rendering correctness on reversed (flipped) regions — the rule, the three mark shapes, what's already checked, and what isn't. Read before touching orientation code or when hunting this bug class.
---

# Reversed-region audit handoff

A reversed displayed region (`ctgA:1..7,720[rev]`, or the region menu's
"reverse") runs bp **leftward**: increasing genomic position maps to decreasing
screen x. Every Canvas2D painter has to cope, and two long-standing bugs from
this were found and fixed on 2026-07-16. This is the guide to finding the rest.

**Why this class hides so well.** The failure is invisible on forward blocks (the
overwhelming majority of use), invisible when zoomed out (widths floor to ~1px,
so a one-base error is a one-pixel error), and needs a flipped region to
reproduce. A 6,200-test suite was green through both bugs for years. Suite size
is not evidence about this axis; nothing was looking at it.

## The rule

`bpToScreenX(bp)` / `makeBpMapper(bp)` return the **left** edge of base `bp` on a
forward block and its **right** edge on a reversed one. Everything follows from
that. Marks come in three shapes, and only one is dangerous:

| Shape        | Example                                       | Correct form                                       | Safe?               |
| ------------ | --------------------------------------------- | -------------------------------------------------- | ------------------- |
| **1bp cell** | mismatch, modification, per-base qual/letter, soft-clip base, coverage bar, SNP segment, MAF cell | `makeCellLeftMapper` (render-core), or resolve both edges and order them | **NO — check it**   |
| **span**     | read, gap, overlap                            | `left = Math.min(x1, x2)`, `w = Math.abs(x2 - x1)` | Safe *if* min/abs   |
| **boundary** | insertion marker, clip bar, indicator         | centered on `bpToX(pos)`, e.g. `fillRect(px-0.5, y, 1, h)` | Safe by construction |

Three traps inside the "cell" row:

- `fillRect(bpToX(pos), y, w, h)` puts the cell one full base off when reversed.
  This was the alignments cell-painter bug (5 painters).
- `Math.max(px2 - px, 1)` goes **negative** when reversed and clamps to a 1px
  sliver, one bin off. This was the coverage-bar bug (`alignments-core`), which
  made the whole histogram nearly vanish past 1bp/px.
- A viewport cull written `if (px > viewWidth || px2 < 0)` assumes `px < px2`, so
  it compares the wrong edges when reversed and drops marks at either edge.
  Order the edges first.

The **GPU path is believed structurally immune**, and that's the model to copy:
shaders compute in forward space (`bpToClipX(pos)` → `bpToClipX(pos+1)`) and
mirror once at the end via `flipX`. The uniform-side pivot goes through
`writeBpRangeUniforms`. Canvas2D instead bakes orientation into the mapper, which
is why every consumer must know about it — see `render-core/CLAUDE.md`.

"Believed" is load-bearing: that immunity is an argument from reading the
shaders, never a measurement (item 1 below). Every Canvas2D finding this session
was framed against it, so if it's wrong the priorities here are wrong too.

## How to check (do not read — run)

Reading is how this class survives; every instance looked locally reasonable.
Both real bugs, and two flaws in my own tests, were found by executing code and
printing output. Probe shape:

```ts
// scratch test next to the helper; delete after
const fwd = (bp: number) => ((bp - START) / SPAN) * W
const rev = (bp: number) => W - ((bp - START) / SPAN) * W // reversed mapper
// ... call the draw fn with a recording ctx, then:
console.log('forward :', JSON.stringify(run(fwd)))
console.log('reversed:', JSON.stringify(run(rev)))
```

Pick a zoom where **1bp is many px** (e.g. 20 px/bp). At 1px/bp a one-base error
is a one-pixel error and you will not see it. That is the whole reason this
hides.

The coverage bug looked exactly like this:

```
forward : [[100, 5, 20.8, 90]]
reversed: [[900, 5,    1, 90]]   ← 1px sliver, and anchored 20px off
```

## This bug class is well known here — alignments was the laggard

Read this before assuming a display is unaudited. Roughly 30 test files
repo-wide already exercise reversed regions, and two displays carry explicit
reversed **cell-geometry** tests that name this exact failure:

- **wiggle** — `Canvas2DWiggleRenderer.test.ts`: "reversed block fills the full
  mirrored cell (left=min, w=|x2-x1|), not collapse to the WIGGLE_MIN_PX floor
  anchored at the wrong edge."
- **variants** — `Canvas2DVariantRenderer.test.ts`: "reversed it mirrors to the
  right edge … with the same 80px width — **not a collapsed sliver**."

Both hit the identical bug and fixed it with a regression test. MAF hand-rolled
the correct pivot before `makeCellLeftMapper` existed. So four displays had this
right; alignments had it wrong in two places. The lesson isn't "nobody knows" —
it's that the knowledge lived in each plugin's scar tissue instead of in one
shared helper. That's what `makeCellLeftMapper` is for now.

**Corollary for auditing: existing reversed coverage ≠ coverage of this class.**
Plenty of those ~30 files merely *exercise* a reversed block (nav, hit-test,
block math) without asserting cell geometry at a zoom where a one-base slip is
visible. Grep tells you a file touches `reversed`; only reading the assertion
tells you whether it would catch a sliver. That distinction is the audit.

## Already checked — don't redo

Clean (verified this session):

- alignments spans: `drawReads`, `drawGaps`, `drawOverlaps` — min/abs.
- alignments boundary marks: insertion (`drawInsertionMarker`, centered), clip
  bars (`px - 0.5`), indicators.
- arcs (`features/arcs/drawCanvas.ts`) — radius from `Math.abs(sx2 - sx1)`.
- per-base draws in **sequence**, **gwas**, **canvas** — all resolve two edges.
- **MAF** cells — had the pivot right independently; now shares
  `makeCellLeftMapper`.
- **wiggle** and **variants** — both hit this bug historically and both carry a
  reversed cell-geometry regression test (see above).
- hit-testing — `canvasXToGenomicPos` is the exact continuous inverse of
  `bpToScreenX` and round-trips in both orientations; `hitTestModification`
  applies its half-base shift in genomic space, where base B centers at B+0.5
  regardless of orientation. Clicks/tooltips were always correct; only pixels
  were wrong.

Fixed (don't re-fix, but they're the pattern to recognize):

- `makeCellLeftMapper` in `render-core/canvas2dUtils.ts` — the shared pivot.
- `alignments-core/rendererUtils.ts` — coverage/SNP/modcov bar spans + all four
  culls. Edges ordered **inline**: these loops run per covered bp and a returned
  `{left,right}` allocates per bin (see `alignments-core/CLAUDE.md`).
- `SvgCanvas.transformRect` — negative scale anchored rects on the wrong corner.
  Latent (nothing scales negatively today).

## Not checked — the actual work

Roughly highest value first:

1. **The GPU path's reversed correctness.** Asserted all session, never tested.
   `flipX` is believed to make it immune, and the whole "Canvas2D is the risky
   one" framing rests on that belief. `MockHal` can assert uniforms/buffers, not
   rasterization — so consider whether a browser test is the only real check
   (`products/jbrowse-web/browser-tests/`, see `guides/TEST_INFRASTRUCTURE.md`).
2. **Nobody has looked at a reversed pileup.** Force the **Canvas2D** backend
   (`?renderer=`) — on GPU it renders correctly and tells you nothing. Navigate
   `ctgA:1..7,720[rev]` on `volvox_alignments_pileup_coverage`, zoom past 1bp/px,
   compare against the same locus unflipped.
3. **Displays whose reversed tests may not assert cell geometry.** dotplot,
   synteny (`linear-comparative-view`), maf, canvas, gwas and sequence all have
   *some* reversed test; whether any pins a cell's span at a zoom where one base
   is many px is unverified — that's the read-the-assertion pass described above.
   **hic** has no `reversed` handling anywhere in its source and no reversed
   test. It draws through a rotated/scaled context (`translate` + `scale` +
   `rotate(-π/4)`) over worker-computed positions, so the open question isn't
   "does it have the cell bug" but "what does hic do in a flipped region at all
   — render unflipped, or is it unreachable?" Answer that before assuming
   either.
4. **Reversed SVG export for alignments.** The only reversed *integration* tests
   are `ReversedRegionLabels.test.tsx` (gene labels) and `LaunchSynteny.test.tsx`
   (three flipped-synteny views) — neither touches a pileup. Copy the former and
   swap the track. Assert a property, not a snapshot — a snapshot of a reversed
   pileup would have recorded both of this session's bugs as expected output.
5. **The wiring above the renderer.** `reversedMirror.test.ts` hands
   `reversed: true` straight to `renderBlocks`; nothing asserts the model
   delivers it (displayedRegion → `renderBlocks` → `renderState`).
6. **Soft-clip bases and insertions** aren't reached by the mirror fixture.

## Writing the test

Use the **mirror invariant**, not a snapshot: a feature at bp `[b, b+len]` lands
at `[f(b), f(b+len)]` forward and `[W-f(b+len), W-f(b)]` reversed, so every mark
has a mirrored twin. It's data-independent (no expected coordinates to
hand-compute and get wrong) and a snapshot would just bake in whatever's broken.
`renderers/reversedMirror.test.ts` is the worked example.

Four traps that made earlier drafts of that test prove less than they looked
like:

- **Reads paint via `fill()` on a path, never `fillRect`.** A rect-only recorder
  scores them as zero marks and mirrors them vacuously. Capture path vertices.
- **Gated layers silently don't draw.** Overlaps and both line layers need
  `linkedReads !== 'off'`; the mirror then compares two empty sets and passes.
  Assert marks are non-empty per config.
- **Fudge factors don't mirror.** The seam fudge (+0.5) and coverage bar fudge
  (+0.8) always overdraw rightward *in local space*, bounding mirror error under
  1px. Tolerate ~1px — and keep the tolerance far below one base width, or the
  test goes blind to the bug it exists for.
- **Don't exclude a layer for being noisy.** The mirror test originally disabled
  coverage because its fudge "would only add noise". That exclusion is the sole
  reason it missed the coverage bug. An exclusion added for tidiness is an
  untested region, and a comment justifying it makes it look considered rather
  than load-bearing.

**Mutation-verify everything.** A passing test proves nothing here. Break the
code on purpose (neutralize the shift in `makeCellLeftMapper`; force
`dirSign = 1` in `chevronApexX`; restore `const left = x1` in `drawOverlaps`) and
confirm the test fails, then restore. Every guard in this area was checked this
way; two of them were vacuous until that check caught them.
