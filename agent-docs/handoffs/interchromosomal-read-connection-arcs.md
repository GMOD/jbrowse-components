---
name: handoff-interchromosomal-read-connection-arcs
description:
  Proposal, for review before it is written, to let a read connection between
  two chromosomes draw as an arc when both ends are on screen — including the
  precise reason no per-region pass can draw one today, the three fixes that
  lose and why, and the premise the change invalidates.
---

# Handoff: interchromosomal read-connection arcs

**Nothing here has landed and nothing here has been written.** This is a
proposal wanting a fresh reading before any of it is implemented. The section
that most wants attacking is [What this change
invalidates](#what-this-change-invalidates).

## Where the pieces are

- **A prior thread's work**: branch `worktree-split-read-sashimi-arcs`, worktree
  `.claude/worktrees/split-read-sashimi-arcs`, 7 commits ahead of an older
  `main`. Two separable pieces on one branch — a **counted sashimi arc over the
  coverage band** (new feature, `showSplitJunctionArcs`) and a **cross-region
  arc fix** for the arc band (bug fix). Green in `plugins/alignments`.
- **That thread's own handoff is stranded on that branch** and is not on `main`,
  which is why a path to it does not resolve in the primary checkout. Read it
  with
  `git show worktree-split-read-sashimi-arcs:agent-docs/handoffs/split-read-junction-arcs.md`;
  it carries the measurements this doc cites and its own list of what it left
  broken.
- **This doc supersedes it on the question of what to do**, not on the
  measurements.

## The bug, stated correctly

The prior handoff and the branch's comments both say the arc "is cut by the
scissor". That is the visible half and it points at the wrong fix. Precisely:

**An arc with a foot in another displayed region is not clipped away. It is
drawn in the wrong place, and then clipped.**

Both renderers project bp to x through **the block they are currently drawing**:

- Canvas2D — `features/arcs/drawCanvas.ts:199` → `bpToScreenX(bp, block, …)`
  (`renderers/rendererTypes.ts:436`)
- GPU — `shaders/slang/arc.slang:251` →
  `u.blockStartPx + bpToLinear(inst.x1, u) * u.blockWidth`, off that block's
  `bpLo/bpHi`

That formula is valid only for a bp inside that block's own region. Given a
coordinate from another displayed region it extrapolates linearly, as though the
bp the view skips at the seam did not exist.

Worked, on one chromosome shown as two regions `[1000,2000]` and `[2300,3300]`,
contiguous on screen at 2 bp/px, 500 px each — an arc from bp 1500 to bp 2800,
which should run x=250 → x=750:

| drawn by | left foot | right foot | what survives its clip                     |
| -------- | --------- | ---------- | ------------------------------------------ |
| block A  | 250 ✓     | **900** ✗  | left leg from 250, climbing to an apex at 575 |
| block B  | **100** ✗ | 750 ✓      | right leg from 750, apex at 425, off-clip  |

The 300 bp the view skips is 150 px of error, in opposite directions. Two
different curves with two different apexes, neither of them the arc. That is the
"two dangling halves".

The clip itself is correct and is not the problem: it is a plain rect clip on a
**shared, full-width canvas** (`Canvas2DAlignmentsRenderer.ts:435`) or a
viewport+scissor over one (`GpuAlignmentsRenderer.ts:1035`). Had both blocks
drawn the *same globally-correct curve*, each clip would keep its own half and
the halves would join. Nothing about the clipping forbids a cross-region arc.

This is the precision missing from the rule already written in
[`LinearAlignmentsDisplay/CLAUDE.md`](../../plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md)
— "No GPU pass can join two displayed regions" — which is true, and true for a
reason that reads as a clipping limit and is not one.

## Why an interchromosomal arc is the same problem

`resolveArcs` (`features/arcs/compute.ts:1189`) short-circuits on
`p1Ref !== p2Ref` and drops a vertical tick at each endpoint instead of ever
building an arc. The data is already there: with two chromosomes displayed,
`groupReadsByName` buckets both mates/segments together and
`mateLinkArc`/`splitJunctionArc` already emit a `PendingArc` spanning them. The
refusal is one `if`.

But two feet on two refNames are necessarily in two different displayed
regions — so **whatever answer is chosen for cross-region arcs is the only place
an interchromosomal arc could ever be drawn.** The two are one issue, and the
cross-region fix is a prerequisite rather than an adjacent cleanup.

The documented rationale for the tick rule is two claims bundled: that insert
size, long-range distance and pair orientation are meaningless across refs
(**still true**, and it is why the arc should keep the ticks' colour rather than
follow `colorByType`), and that nothing could join the two regions anyway
(**the half this removes**).

## The four ways to draw it, and why three lose

1. **Draw once in view space — an overlay.** The proposal. Costs are real and
   are listed under [Known costs](#known-costs-of-the-overlay).
2. **Rewrite the foreign foot's bp into the drawing block's frame.** For block A
   drawing a foot in region B, `b' = end_A + (bp - start_B)` — constant per
   (block, foreign region) pair, so it survives panning and needs **no shader
   change**. This is the strongest alternative and the one worth re-checking.
   It loses on four counts: `arcX1/arcX2` stop meaning "where this arc is" while
   the hit test reads them back to build the tooltip's coordinates (the scar the
   `arcYBp` / `arcSpanBp` split already records); `b'` goes **negative** when the
   foreign region is to the left and this block's region starts near bp 0, and
   these are `Uint32Array`; the arc lands in both regions' buffers so
   `hitTestArcBand` finds it twice at two different reported coordinates; and it
   still does not fix `arcIsFar` (`arc.slang:159`), which branches on
   `u.canvasW` = the **block's** width, so a partly-scrolled-off block can pick
   circle where its neighbour picks ellipse and the halves mismatch anyway.
3. **Per-region offset table in the uniforms.** Option 2 done in the shader
   instead of the packer — strictly more work for the same result, and carries
   the same `arcIsFar` defect.
4. **Upload resolved screen px instead of bp.** Looks simplest, is worst: bp is
   uploaded once today and re-projected from uniforms every frame, so panning is
   free. Px means repacking and re-uploading the arc buffers every pan frame.

## Proposal

1. **Take the branch's cross-region overlay as the drawing mechanism**, and land
   it as a bug fix on its own — it is correct on today's `main` with no
   interchromosomal change at all.
2. **`resolveArcs` builds an arc when both feet land in a loaded displayed
   region, ticks otherwise, decided per connection.** So a breakpoint reaching
   one displayed and one undisplayed chromosome gets an arc **and** a tick, and
   both counts stay honest. Colour is `ARC_COLOR_INTERCHROM`, which is slot 3 of
   `ARC_SLOT_CATEGORY` — already in the palette every draw path indexes through
   `arcColorSlot`, and already the `interchrom` legend swatch — so the colour
   needs no new plumbing. Height is the **band ceiling**: there is no genomic
   span to plot, and a maximally-far same-chromosome arc already clamps there,
   so it is not an invented position.
3. **Rework the partition so it stops being a removal.** The branch takes
   cross-region arcs *out* of `arcsByGroup`, which is what broke
   `arcLegendCategories` and `arcsYDomainBp`; those are not two slips, they are
   "which arcs does this lane draw" ceasing to have one answer. The cross-group
   facts should be computed once inside `computeArcsByGroup`, where both halves
   are in hand, so both getters are right by construction. Note the split is
   otherwise clean: of six consumers, three are per-region (correctly see the
   upload feed alone) and three are cross-group (must see both).
4. **Re-derive the size claim on real data** — see below — before calling it
   done.
5. **Then** verify the SVG export and a dark-mode frame, which are unverified
   for both pieces.

## What this change invalidates

**Attack this first.** The overlay's justification is "the set is inherently
small — a fragment can straddle only one seam — so SVG costs nothing". That is
true for *same-chromosome* cross-region arcs, and it is where the prior thread's
zeroes came from, including **0 cross-region arcs in the k562 two-chromosome
view**.

It is not true once interchromosomal connections become arcs. In a
two-chromosome SV view every pair joining the two windows is cross-region by
construction, and that k562 zero was zero *because* interchrom never became an
arc. **The change is precisely what breaks the premise the mechanism was chosen
on**, and no measurement in this thread covers the after state.

Two things bound it, neither measured here:

- `minInterchromSupport` defaults to **2** (`configSchema.ts:509`) and counts
  over a clustered window, so singleton mismapping is already filtered before
  anything is drawn.
- Only pairs joining the two *displayed* windows qualify; the 865
  interchromosomal connections measured at 1:2,000,000 on HG002 300x were from a
  single-region view, where all of them stay ticks.

If it does turn out large, the answer is a cap with a logged drop count, not a
redesign — but that is a guess until someone counts.

## Known costs of the overlay

- **SVG is a separate z-layer**, so a cross-region arc paints above every canvas
  arc and tick regardless of `arcPaintRank`. Defensible — nothing cross-region
  is routine — but it should be written down rather than discovered.
- **The hovered-arc highlight differs**: canvas arcs go through
  `hoveredArcHighlight`, these thicken their own stroke. Cosmetic, and fixable
  by routing the overlay's hover through the same state.
- **The arc/tick decision depends on fetch state**, not just on what is
  displayed: the regions handed to `computeArcsByGroup` are `loadedRegionInfos`
  (`model.ts:1837`), so a displayed-but-unfetched partner gives ticks until its
  data lands and then arcs. Transient and self-correcting, but visible.

## Already checked — do not re-litigate

- **The overlay does not break the click / right-click guard.** I expected it to
  (an arc outside the hit test falling through to the interbase menu beneath is
  the bug `93af1f54f0` fixed, and this display's CLAUDE.md writes it up at
  length). It does not: the overlay is a **sibling** of the canvas, not a child,
  so a path's events never reach `handleClick` / `handleContextMenu` — and
  "nothing on click, browser menu on right-click" is exactly what a canvas arc
  does by design. This is a point in the branch's favour.
- **The colour needs no palette or legend work** — see proposal step 2.

## Open decisions

1. **The counted sashimi arcs (`showSplitJunctionArcs`, the branch's piece A).**
   Built as a workaround for exactly this gap. Recommendation: **drop it** once
   interchromosomal arcs land. It is a second producer of junction geometry with
   a different coalescing rule — the arc band coalesces on exact coordinates
   (`arcKey`), it clusters within 10 bp — so at a junction with microhomology
   jitter the two print **12 and 28 at one locus**. One junction with two counts
   is a defect, not a redundancy. What is lost is the count *label* and the
   position over the coverage band, neither of which the arc band has an
   equivalent for. This deletes working, eye-verified code and re-aims the k562
   figure and tutorial prose, so it wants a decision rather than an assumption.
2. **Does the arc replace the ticks, or draw with them?** Recommendation:
   replace, when and only when both feet are displayed — the tick's whole job is
   "there is a connection to somewhere you cannot see", and the arc says it
   better when you can. k562 goes from 8 ticks to roughly 4 arcs.
3. **Split reads vs mate pairs.** The proposal paints both
   `ARC_COLOR_INTERCHROM`. A split read physically crosses the junction, so its
   two segments' strand relationship *is* meaningful across chromosomes and
   could justify `splitInversion` / `splitDeletion` instead. Left uniform
   deliberately: it keeps an arc the same colour as the ticks it replaces, and
   "deletion" is the wrong word for a translocation. Worth a second opinion.

## Not verified by me

- Every number in this doc other than the config default and the worked example
  is the **prior thread's measurement**, re-read but not re-run: 52 of 381 arcs
  (13.6%) cross-region on the HG02768 inverted duplication split into two
  regions 300 bp apart; 0 for the same view as one region and for two regions
  2 Mb apart; 0 arcs and 8 ticks in the k562 view; 865 of 9204 arcs
  interchromosomal at 1:2,000,000 on HG002 300x.
- The branch has not been rebased onto current `main` (12 commits behind at the
  time of writing, 2026-08-14).
- The k562 figure PNG on that branch is regenerated but not pushed, so the site
  would show the old figure against a new caption until
  `pnpm figures:push --exact --filter cancer_sv/k562_bcr_abl_split` runs and
  `figures.lock` is committed. If piece A is dropped that regeneration is moot
  and the figure wants re-aiming instead.
