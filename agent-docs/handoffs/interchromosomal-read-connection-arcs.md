---
name: handoff-interchromosomal-read-connection-arcs
description:
  Reviewed proposal to let a read connection between two chromosomes draw as an
  arc when both ends are on screen — the mechanism verdict, the four gaps the
  review found (read-cloud axis, two settings ungated, a two-refName tooltip, a
  refName-keyed bucket), the option that was rejected for the wrong reason, and
  which flank the size premise actually fails on.
---

# Handoff: interchromosomal read-connection arcs

**Nothing here has landed.** The proposal has now had the fresh reading it asked
for (2026-08-14), against `main` and against the branch. **The direction and the
mechanism hold.** What changed in review: one of the three rejected alternatives
was rejected for the wrong reason, the size premise fails on the opposite flank
from the one the proposal defended, and four gaps would each have shipped a
silently wrong picture. Those are [Gaps found in review](#gaps-found-in-review),
and they are the part to read.

## Where the pieces are

- **A prior thread's work**: branch `worktree-split-read-sashimi-arcs`, worktree
  `.claude/worktrees/split-read-sashimi-arcs`, 7 commits ahead of an older
  `main`. Two separable pieces on one branch — a **counted sashimi arc over the
  coverage band** (new feature, `showSplitJunctionArcs`) and a **cross-region
  arc fix** for the arc band (bug fix). Green in `plugins/alignments`.
- **That thread's own handoff is stranded on that branch**:
  `git show worktree-split-read-sashimi-arcs:agent-docs/handoffs/split-read-junction-arcs.md`.
  It carries the measurements this doc cites and its own list of what it left
  broken.
- **This doc supersedes it on the question of what to do**, not on the
  measurements.

## The bug, stated correctly

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

| drawn by | left foot | right foot | what survives its clip                        |
| -------- | --------- | ---------- | --------------------------------------------- |
| block A  | 250 ✓     | **900** ✗  | left leg from 250, climbing to an apex at 575  |
| block B  | **100** ✗ | 750 ✓      | right leg from 750, apex at 425, off-clip      |

The 300 bp the view skips is 150 px of error, in opposite directions. Two
different curves with two different apexes, neither of them the arc. That is the
"two dangling halves".

The clip itself is correct and is not the problem: it is a plain rect clip on a
**shared, full-width canvas** (`Canvas2DAlignmentsRenderer.ts:435`) or a
viewport+scissor over one (`GpuAlignmentsRenderer.ts:1035`). Had both blocks
drawn the *same globally-correct curve*, each clip would keep its own half and
the halves would join. Nothing about the clipping forbids a cross-region arc.

This is the precision missing from the rule in
[`LinearAlignmentsDisplay/CLAUDE.md`](../../plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md)
— "No GPU pass can join two displayed regions" — which is true of the passes we
have, for a reason that reads as a clipping limit and is not one. See
[the escape hatch](#the-escape-hatch-if-the-set-ever-does-get-big) for what it
would take to make it false.

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
(**still true**, and it is why the arc keeps the ticks' colour rather than
following `colorByType`), and that nothing could join the two regions anyway
(**the half this removes**).

### What the change is actually worth, stated properly

The display can **already** draw an interchromosomal connection across two
displayed regions: the per-read bezier overlay does it, and that is what the
k562 figure shows today (`bezierArcScope` = `crossRegion` in chain mode). What
no pass can draw is that connection **coalesced and counted** — one mark whose
stroke width is how many molecules say so.

That is the whole value, and it is worth saying in exactly those words, because
it is also the sentence that settles [open decision 1](#open-decisions): a
coalesced, counted, cross-chromosome junction mark is precisely what piece A was
built to be, so once the arc band can draw one there are two producers of it.

## The four ways to draw it, and which lose

1. **Draw once in view space — an overlay.** The proposal, and still the answer.
   Costs are under [Known costs](#known-costs-of-the-overlay).
2. **Rewrite the foreign foot's bp into the drawing block's frame.** Loses, and
   the four reasons were re-checked and all hold. `arcX1/arcX2` stop meaning
   "where this arc is" while `arcHitAt` reads them straight back into the
   tooltip's coordinates (`hitTest.ts:158`, `formatArcTooltip`); the rewritten
   bp goes **negative** when the foreign region is left of a block whose region
   starts near bp 0, and these are `Uint32Array`; the arc lands in both regions'
   buffers so `hitTestArcBand` finds it twice at two reported coordinates; and
   `arcIsFar` (`arc.slang:159`) branches on `u.canvasW`, which
   `fillArcUniforms` sets to **`scissorW`** — the clipped block's width
   (`GpuAlignmentsRenderer.ts:212`) — so a partly-scrolled-off block picks
   circle where its neighbour picks ellipse and the halves are different marks.
3. **Per-region offset table in the uniforms.** Option 2 in the shader instead
   of the packer — more work for the same result, same `arcIsFar` defect.
4. **Upload resolved screen px instead of bp.** **The proposal's reason for
   rejecting this is wrong, and it matters for the fallback rather than for the
   decision.** "Px means repacking every pan frame" is not true of the px that
   would be uploaded: `view.bpToPx` returns a **layout** `offsetPx`
   (`packages/core/src/util/Base1DUtils.ts:247` — cumulative bp / `bpPerPx`),
   and `view.offsetPx` is subtracted only at draw time (`makeBpToScreenX`). A
   view-space buffer is therefore **pan-invariant** and repacks on **zoom**.
   It still loses to the overlay at the sizes measured, on cost rather than on
   correctness — but it is the escape hatch, not a dead end.

### The escape hatch, if the set ever does get big

One extra **view-space GPU pass**, reusing `arc.slang` unmodified: pack the
cross-region arcs against layout px instead of bp (they are the same axis — the
displayed regions are laid out **contiguously**, `calculateDynamicBlocks.ts:115`
advances by `regionWidthPx` with no inter-region padding except the two boundary
blocks, which is also why the SVG overlay lines up with the canvas exactly), set
`blockStartPx`/`blockWidth`/`bpLo`/`bpLen` so the "bp" axis IS layout px, and
set `canvasW` to the **view's** width so `arcIsFar` is asked once for the whole
mark. Scissor to the band over the full canvas rather than per block.

What it costs: a repack on zoom, a second uniform-fill path, and the split of
"drawn coordinate" from "reported coordinate" that the tooltip needs — the scar
`arcYBp` / `arcSpanBp` already records, one axis over. Write it down rather than
build it now.

## Proposal, as revised by the review

1. **Take the branch's cross-region overlay as the drawing mechanism**, and land
   it on its own — it is a bug fix, correct on today's `main` with no
   interchromosomal change at all. The overlay is not a novel mechanism here:
   it is what `bezierArcScope`'s `crossRegion` and the sashimi band already are,
   its projection already exists (`makeBpToScreenX`), and
   `crossRegionOverlay.ts` already passes the **view's** width as
   `screenWidthPx` so `arcIsFar` is asked once — keep that and its comment.
2. **One decision point, not an emit-then-partition pair.** `resolveArcs` should
   resolve each foot's region index ONCE and return three things — within-region
   arcs, cross-region arcs, ticks — rather than emitting arcs and partitioning
   them in a second pass with a second region lookup. That is what makes
   "an interchromosomal arc is always in the cross-region set" structural rather
   than incidental, which [gap 4](#4-grouparcsbyref-is-keyed-on-p1refname) shows
   is load-bearing. It is also the answer to the prior thread's complaint that
   "which arcs does this lane draw" stopped having one answer.
3. **The region list is the view's DISPLAYED regions, not `loadedRegionInfos`.**
   The criterion is "can both feet be projected", and the projector is
   `view.bpToPx`, which reads `displayedRegions`. Keying on the loaded set does
   not merely produce the transient the proposal accepted — it leaves the
   original bug alive for a displayed-but-unfetched partner: foot 2 resolves to
   no region, the arc falls into the within-region half, `arcTouchesRegion`
   hands it to foot 1's block on a raw bp comparison, and it is extrapolated and
   clipped exactly as before. The read scan still needs the loaded list, so
   these become two parameters. `arcsByGroup` then depends on `displayedRegions`,
   which changes on navigation and **not on pan** — the property
   `loadedRegions`' own comment is written to protect — so the tier survives.
4. **`resolveArcs` builds an interchromosomal arc when both feet land in a
   displayed region, ticks otherwise, decided per connection** — so a breakpoint
   reaching one displayed and one undisplayed chromosome gets an arc **and** a
   tick, and both counts stay honest. Colour is `ARC_COLOR_INTERCHROM`, slot 3 of
   `ARC_SLOT_CATEGORY`, already the `interchrom` legend swatch, so no palette or
   legend plumbing. Height is the band ceiling. **Arc mode only** — see
   [gap 1](#1-read-cloud-mode-must-keep-the-ticks-and-this-one-is-severe).
5. **Cross-group facts become outputs of the pass that holds both halves.**
   `arcLegendCategories` and `arcsYDomainBp` walk `arcsByGroup` today, so
   removing arcs from it broke both; they are not two slips. Compute them inside
   `computeArcsByGroup`, **after** regionization, not before — an arc that
   reaches no displayed region at all is dropped by `arcTouchesRegion`, and
   keying a legend swatch off the pre-regionization set would name a colour
   nothing draws, which is the same failure one level up.
6. **Cap the overlay, ordered by support descending, with the drop counted.**
   Size it for the same-chromosome case, not the interchromosomal one — see
   below.
7. **Then** verify the SVG export and a dark-mode frame, which are unverified
   for both pieces.

## The size premise fails on the other flank

The proposal asked for this to be attacked, on the ground that
interchromosomal arcs break the "inherently small" premise the overlay was
chosen on. **They do not. Multi-seam same-chromosome views at depth do.**

**Interchromosomal is bounded by an enormously selective filter.** Only pairs
joining the two *displayed windows* qualify. The 865 interchromosomal
connections measured at 1:2,000,000 on HG002 300x have their far ends spread
over the rest of the genome, so a second 200 kb window catches ~0.06 of them by
chance; reaching even 60 would take a ~1000x enrichment at that exact window,
which is a segdup pair — i.e. exactly the connection a reader wants drawn.
The other way to get a lot is a real event, and a translocation at 300x recruits
**~100 pairs** (`reference/DEEP_COVERAGE.md`). 100 paths is nothing.

Two consequences worth carrying:

- Those ~100 will **not** coalesce. 862 of 865 interchromosomal connections were
  the sole occupant of their coordinate (`compute.ts`, `clusteredInterchrom-
  Support`'s comment), so a deep translocation draws as a **fan of ~100
  hairlines**, not one thick arc. That is exactly what its ticks look like
  today, and the refusal to invent a merged position is the same refusal
  `arcKey` already states — so this is consistent rather than a regression. It
  does mean "one counted arc for a translocation" is true of split-read evidence
  and not of mate-pair evidence.
- k562 goes from 8 ticks to roughly 4 arcs, and the 4 is microhomology jitter
  across the same junction, not four events. That is the input to
  [open decision 1](#open-decisions).

**The same-chromosome case is the one to bound.** Cross-region arcs at a seam
are the fragments straddling it, so the count scales with *physical* coverage
and with the number of seams. The measured 52 of 381 (13.6%) is one seam on a
~30x paired-end sample; the same seam at 300x is ~10x that, and an N-region view
multiplies it again. Unmeasured — and cheap to measure now that the partition
exists: read `crossRegion.length` off the model on the HG002 300x window split
in two. Note the user-facing mitigation already exists and is the one a reader at
that depth is already using: `drawProperPairArcs: false` drops 9138 of 9204 arcs.

## Gaps found in review

### 1. Read-cloud mode must keep the ticks, and this one is severe

In cloud mode `computeArcShape` returns a FLAT shape for every arc and computes
`spanBp = |tlen| || |p2Bp - p1Bp|`. An interchromosomal pair carries TLEN 0 (SAM
sets it so across refs), so it falls to the gap — `|chr9bp - chr22bp|`, about
1.07e8 for the k562 junction. That number is a genuine `maxFlatArcSpanBp`, and
`arcsYDomainBp` maxes it across every group, and `insertSizeTickSections`
**labels the top of the axis with it**. One interchromosomal connection would
rescale the whole read cloud to a 107 Mb "insert size" and print it on the
ruler.

The principle behind the fix rather than the fix alone: **the read cloud's Y
axis IS insert size, and an interchromosomal connection has none.** Arc mode's
axis is genomic radius, where the band ceiling is already where a maximally-far
same-chromosome pair clamps, so the ceiling is not an invented position there.
So: arcs in arc mode, ticks in cloud mode. This also removes the
`maxFlatArcSpanBp` hazard entirely rather than guarding against it.

### 2. `drawInter` and `minInterchromSupport` must gate the new arc branch

Both currently sit inside the interchromosomal branch that pushes ticks. An arc
branch added beside them inherits neither: "Show inter-chromosomal pairs" off
would still draw arcs, and the clustered mismapping floor that protects the
ticks would be bypassed for connections that now draw a **bigger** mark than the
ticks it replaced. `clusteredInterchromSupport` is the right count for the
floor for the same reason it already is — the exact-coordinate count is 1 for
essentially every one of these.

### 3. The tooltip payload has one refName and needs two

`formatArcTooltip` builds `{refName, start: min(x1,x2), end: max(x1,x2)}`. For a
same-chromosome cross-region arc that is right. For an interchromosomal one it
prints `chr22:23,290,313-130,853,964` — a locstring naming one chromosome and a
coordinate from another. `CrossRegionArcShape` on the branch already carries
`endRefName`; the payload throws it away. Fix the payload before the arcs exist,
not after.

This is also the one thing the tick's hover was worth more than the arc's for
(it is the whole content of a translocation marker), so an arc replacing ticks
must not lose it.

### 4. `groupArcsByRef` is keyed on `p1.refName`

…under a comment stating that an arc's two ends always share a refName, and
`arcTouchesRegion` compares raw bp with no refName test. Both are correct today
because the interchromosomal branch returns before either. An interchromosomal
arc that reaches either one is silently drawn at a garbage x in a region it does
not belong to. Proposal step 2 (one decision point, one region lookup) is what
makes that unreachable; the comment needs rewriting to say *why* it holds rather
than that it does, and it wants a test.

## Known costs of the overlay

- **SVG is a separate z-layer**, so a cross-region arc paints above every canvas
  arc and tick regardless of `arcPaintRank`. Defensible — nothing cross-region
  is routine — but write it down rather than let it be discovered.
- **The hovered-arc highlight differs**: canvas arcs go through
  `hoveredArcHighlight`, these thicken their own stroke. Worth fixing not for
  cosmetics but because `ArcHoverOverlay` is its own z-layer too, so two hover
  mechanisms in one band can show a hover twice.
- **The arc/tick decision depends on region state.** Proposal step 3 moves it
  from fetch state to view state, which removes the transient and closes a live
  hole; what remains is that adding or removing a displayed region can turn an
  arc into ticks, which is the honest answer.

## Already checked — do not re-litigate

- **The overlay does not break the click / right-click guard**, and the reason
  is that the handlers are on the `<canvas>` element itself
  (`PileupComponent.tsx:384-388`), not on the `position: relative` container the
  overlays are siblings in — so a path's events cannot bubble to
  `handleClick` / `handleContextMenu`. Re-verified in review; had the handlers
  been on the container this would have been `93af1f54f0` again. "Nothing on
  click, browser menu on right-click" is what a canvas arc does by design.
- **The colour needs no palette or legend work.** `ARC_SLOT_CATEGORY[3]` is
  `interchrom` and every draw path already indexes through `arcColorSlot`.
- **The overlay aligns with the canvas.** Displayed regions are laid out
  contiguously in both `bpToPx` and the block layout; only the first and last
  boundary padding blocks exist.

## Open decisions

### 1. The counted sashimi arcs (`showSplitJunctionArcs`, the branch's piece A)

**Do not decide this as keep-or-drop. The defect is that there are two
coalescers, and the fix is to have one.**

The contradiction is real and disqualifying on its own: the arc band coalesces
on exact coordinates (`arcKey`), piece A clusters within 10 bp and takes the
modal site, so at a junction with microhomology jitter the two print **12 and
28 at one locus**. One junction with two counts is a defect.

But "drop it and re-aim the figure onto the arc band" is a bigger change than it
sounds, and the review turned up why: **the k562 figure does not enable the arc
band at all.** `readConnections` has `promotedBase: 'off'`, the k562 spec's
`SPLIT_READS` is `{featureHeight: 4}`, and the fan in that figure is
`showBezierConnections` in chain mode. So the swap is not "same figure, better
mark" — it turns on a whole additional band in an RNA figure, and that band then
shows ~4 arcs where piece A shows one labelled 28.

The landing that resolves both:

- **Move piece A's clustering into the arc path** as a pre-pass over the
  `isSplit` pending arcs — snap each junction to its cluster's modal site before
  `arcKey`. `splitJunctions.ts` already is that code. Then both producers read
  one junction set and cannot print two numbers, and the arc band draws k562's
  fusion as **one** arc with support 28 across two chromosomes.
- **The tolerance must be split-junction-only.** On mate links a 10 bp window is
  a density merge, which is what `DEEP_COVERAGE.md` measured and declined. And
  it does not contradict `arcKey`'s exact-coordinate defence: the five HG002
  chr12 fold-back events it cites are 309–788 bp apart, so a 10 bp window merges
  none of them. A split read knows its breakpoint to the base; what it does not
  know is which base the aligner picked inside the microhomology.
- **Then piece A's overlay is redundant** and goes, and the count *label* — the
  one thing genuinely lost — becomes a small option on the arc band, sourced
  from `ComputedArc.support`, serving same-chromosome junctions too.

If that is more than this thread should carry: keep piece A, land the
interchromosomal arcs, and accept that the two bands can disagree at one locus.
Don't ship that silently — a reader seeing 12 and 28 has no way to know which to
believe.

### 2. Does the arc replace the ticks, or draw with them?

**Replace, when and only when both feet are displayed.** The tick's whole job is
"there is a connection to somewhere you cannot see", which is *false* in exactly
this configuration — that, rather than aesthetics, is the argument. No position
is lost: the arc's feet are the two tick positions. What must survive is the
partner refName ([gap 3](#3-the-tooltip-payload-has-one-refname-and-needs-two)).

### 3. Split reads vs mate pairs

**Paint both `ARC_COLOR_INTERCHROM`**, and the reason is stronger than "keep the
ticks' colour". As a tick, "crosses chromosomes" was readable from the mark
itself. As an arc it is not — a same-chromosome cross-region arc crosses the
same panel divider and looks the same. The colour is now the **only** channel
carrying that fact, so spending it on `splitInversion` / `splitDeletion` would
delete the one distinction this family exists to make.

## Next, in order

1. Rebase the branch onto `main` (it predates ~12 commits, and the diff shows
   main-only work such as `overlapLegendKind` as removals).
2. Land piece B alone: the partition reworked per proposal steps 2, 3 and 5, the
   overlay, and the cap.
3. Then the interchromosomal arcs: steps 4 and 6 plus gaps 1–4.
4. Then the single junction resolver, and piece A's overlay goes.
5. SVG export + dark-mode frame; re-aim the k562 figure; `figures:push`.

## Not verified by me

- Every number here other than the config defaults, the worked example and the
  code references is the **prior thread's measurement**, re-read but not re-run:
  52 of 381 arcs (13.6%) cross-region on the HG02768 inverted duplication split
  into two regions 300 bp apart; 0 for that view as one region and for two
  regions 2 Mb apart; 0 arcs and 8 ticks in the k562 view; 865 of 9204 arcs
  interchromosomal at 1:2,000,000 on HG002 300x.
- The 300x same-chromosome cross-region count, which is the number the cap
  should be sized from, is an **estimate scaled from the 30x measurement**, not
  a measurement.
- The k562 figure PNG on that branch is regenerated but not pushed, so the site
  would show the old figure against a new caption until
  `pnpm figures:push --exact --filter cancer_sv/k562_bcr_abl_split` runs and
  `figures.lock` is committed. That regeneration is moot under open decision 1's
  recommendation; the figure wants re-aiming instead.
