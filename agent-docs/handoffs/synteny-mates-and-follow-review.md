---
name: synteny-mates-and-follow-review
description: Findings from two review passes (2026-09-20, 2026-09-21) of the off-screen mate strip and the synteny follow. A second pass confirmed seven more fixes on real data; two fixer worktrees were stopped mid-work and hold unreviewed commits. Start at "Next session". Read before touching `drawOffscreenMates`, `mateNavDestination`, the mate collection in `executeSyntenyFeaturesAndPositions`, or `SyntenyFollow/`.
---

# Off-screen mates and the synteny follow: review findings

Each item names its site and how it was checked. Mark an item **landed** with
its commit when it lands; file what nobody takes up into
[ideas/](../ideas/README.md) or [TODO.md](../TODO.md) and delete this file.

## Next session: start here

The 2026-09-21 session stopped two fixer agents mid-run. The M3 one is
superseded and gone; the other is kept, **unreviewed and unlanded**:

- `.claude/worktrees/agent-abd504f266bebcb9b`, branch
  `worktree-agent-abd504f266bebcb9b`: `05ffe7f378`, B9 (the overview freeze).
  Committed by the agent; its gates and sabotage run are unconfirmed.

Review the diff, rebase onto local `main`, run `pnpm verify` and the touched
suites, show each new test failing without its fix, and land by fast-forward.
Then the rest, in this order — each confirmed by the second pass on real data
or in the follow harness unless marked:

1. Follow: B9 (finish `05ffe7f378`), B3's backwards jump, B10 (Collapse introns
   undone on a following row).
2. Mates: the stale user guide (M16).
3. Follow: U1.
4. The comment thinning, S1.

Landed earlier: M1, M2, M7 (order 1), B1, B2 (order 2), S4, the stale-doc half
of the comment sweep, and M14 with M10 and M12.

### Landed in parallel, 2026-09-21, from `worktree-agent-docs-followups`

A second session worked the first pass's list at the same time and landed:

- M3: `7905990708`, with `984fbd9888` (a mid-flight click keeps its zoom
  through the LGV's new `flyToFit`; only a scroll under `linkViews`; the frame
  capped at the row's widest window).
- M5, M13 and U2: `67f1fcf187`. M4 and M6 (class C marks, and the identity fade
  no longer re-showing a hidden ribbon): `2598650df8`; a hidden ribbon's indels
  are hidden too in `984fbd9888`.
- B3, B4, B5, B6 and S3: `4d89cff7e9`. S6's `movingIndex` and S8: `c129862e7d`.
- U2's wheel half, U3 and U4: `984fbd9888`.

Six of those are items the second pass closed as intended: M4, M13, B4, B5,
U2 and U4. Colin kept U2: while following, a band gesture moves the anchor and
the follow places the rest. U4 is moot, since Colin dropped the pixel lock:
the view's row coupling is now the `followSynteny` boolean, and a band drag
with the follow off is the one way to pan every row together.

**The follow half has had no independent review**, and its full
`pnpm test-related` was stopped before it finished; the linear-comparative-view
and linear-genome-view suites ran green. Review `4d89cff7e9` for whether B3's
live-block read can skip a correction mid-flight (it may bear on "B3's
backwards jump"), whether the frame pass's `facing()` write of `spreadTargets`
breaks its rule of minting no state, and whether `bandGestureRows` goes empty on
a stale `followAnchorIndex`.

## Off-screen mates

Background: [reference/OFFSCREEN_SYNTENY_MATES.md](../reference/OFFSCREEN_SYNTENY_MATES.md),
[ADR-138](../architecture-decision-records/adr-138-aligned-bp-ranks-and-gates-the-off-screen-mate-marks.md).

### Bugs

- **M1. An alignment with no place on the facing axis can vanish without a
  mark.** Landed, `5946ccf31c`. Verified by scratch tests. The worker's class-A test asks whether the
  facing row displays the mate's CONTIG (`v2RefNames.has`), so a mate outside
  every displayed slice of a displayed contig passes it and is dropped later in
  the projection loop. Three drop sites: `!e2` (no slice contains the mate),
  `!e2` after `clipLargeBlockToWindow` moved the mate out of the slice its
  unclipped span overlapped, and `!trim` (the two slices share no part of the
  alignment). The target fetch has the mirror (`!v1RefNames.has`, then a
  flipped ribbon dropped at `e1`). Fix: collect at the drop sites with the
  clipped mate span, keep the contig test as the prefilter.
- **M2. In coloured mode the colour painted on top can disagree with the
  contig the hover names.** Landed, `cbf87a7906`: the hit ranks by paint order. Verified by reading. `fillMarks` orders colour
  groups by each group's strongest mark anywhere in the lane; the hit takes the
  longest mark at the pixel. ADR-138's "the composite ends on the contig the
  pointer would name" holds only where the lane's strongest mark sits. A sweep
  test through `recordingContext` (`@jbrowse/render-core/marks/drawAgainstHit`)
  pins it either way.
- **M3. The scroll class centres without framing.** `showOffscreenMateContig`
  `centerAt`s the union at the current zoom, so a 3Mb union on a 200kb window
  can land showing none of it; the add class frames with `navSpan`. Confirmed
  by probe: the hover promised ctgB:10,001..390,000 and the row landed on
  ctgB:180k-220k, holding neither alignment. Fix: frame the union with
  `flyTo`/`setWindow` when it is padded wider than the window, and keep the
  centring path (and `flyToCenter`'s in-flight heading) for one that fits. WIP
  in `d3a5217483`. A union spanning two displayed copies of one contig centres
  between them and raises a false "no longer lands on it" — hypothetical, it
  needs a hand-made multi-locus row.
- **M4. Closed 2026-09-21.** Confirmed, but it needs overlaid tracks or a
  sliced facing row, and what it hides is scraps under 4px that zooming in
  shows, which is the floor's job. **The contig floor is per dataset, not per contig**
  (`drawOffscreenMates.ts` `forEachMark`). Two tracks on one level can each
  hold 3px of a contig and draw nothing while the tooltip sums both. Since M1
  one contig can also sit in a lane's class A and class C datasets at once,
  which splits the same way.
- **M5. A refetch leaves the mark tooltip standing** — `LevelSyntenyCanvas`
  keys the hover on `bandTransformKey`, which a refetch does not change, and
  the click re-hit-tests, so it can do other than the tooltip said (reading).
  Fix, 3-4 lines: stamp the hover with the `model.offscreenMateStrips` array
  and compare identity, which subsumes the transform key.
- **M15. Closed 2026-09-21**: no demo or tutorial pairs a chain PAF with a
  sliced facing row, and framing the unclipped span would frame the whole chain
  (86Mb for chimp chr19). If it ever matters, apply the collapse rule before
  `markUnplaced` (2 lines). **A chain clipped inside a CIGAR gap is marked with a one-base mate
  locus** on a sliced facing row (probe on the `clipGapDrop.test.ts` fixture,
  facing row t1:5000+). The mark is truthful — the chain's aligned ends do map
  outside the slice — but a click frames 20kb around that base. Marking with
  the unclipped mate span when the clipped one collapses would frame the chain.
  Dropping the mark instead makes it blink as the fetch window pans.
- **M6. `hideUnlabelled` hides ribbons, not their marks.** Trigger: the ODP
  tutorial session sets `hideUnlabelled: true` and marks default on, so a pan
  marks hidden rows, counts them in the hover, and a click scrolls to an
  invisible ribbon (`culledRibbonMateData` takes no colours). Two leaks in
  `LinearSyntenyRPC/syntenyColors.ts` `computeSyntenyColors` go with it:
  `opacityByIdentity` overwrites the hidden row's zero alpha, and a hidden
  row's CIGAR I/D/N tiles and location markers keep their fixed colours. Fix:
  when `hideUnlabelled` and `colorFn(f)` has zero alpha, zero every instance of
  `f` before the identity override; `culledRibbonMateData` takes the colours and
  neither places nor counts a feature with instances but none visible. Class A
  carries no attribute lanes; close that half.
- **M16. The public user guide contradicts the landed click.**
  `website/docs/user_guides/linear_synteny_view.md` ~341 says a pointer answers
  with the longest alignment and a click follows it (it names the contig painted
  on top, and a click shows where that contig's alignments under the pointer
  land); ~352 says the hover says which of two things the click does (every
  hint is "Click to show <locus>"); ~356 describes a click that replaces the
  region list (none does since M14). The agent doc has the same at
  `OFFSCREEN_SYNTENY_MATES.md` ~263-270 and ~502-507.

### Simplifications

- **M7. One hit test.** Landed, `6e8e26c300`. `offscreenMateAt` and `offscreenMateSpanAt` are both
  full passes of the lane since before ADR-138, so the reason given for two
  (the click "cannot early-exit") is stale. Merging drops
  `OffscreenMateMark`/`OffscreenMateHit`, `stripHit` and the `displayed` flag,
  which disagrees with `mateCumBp` once M1 puts one contig in two datasets.
  The overlay bench's hover/click columns need a re-run.
- **M8.** Optional cleanup, 10-15 lines. A per-mark `bp` array on `LaneMarks` replaces
  `markAlignedBp`/`laneMarkAlignedBp`; the cross-lane `strongest` ordering is
  dead, since the two strips never share a colour other than grey.
- **M9. Closed 2026-09-21**: `ribbonDrawn` agrees with the facing half of
  `isCulled`, so projecting to px changes nothing. **One cull rule.** `ribbonDrawn`/`datasetMayHide` restate
  `isRibbonCulled`'s per-edge test in cumBp; projecting to px and calling the
  generated `spanOutsideBand` makes the mirror structural.

### UI

- **M10.** Landed, `dc3953f5da`. The tooltip can name the destination at no cost once M7 lands —
  print `mateNavDestination(...).loc` so it matches the snackbar, and warn on
  hover for a mark that resolves to `none`.
- **M11. Closed 2026-09-21**, a feature request needing a third hit path.
  **Labels are not hoverable or clickable**; the hit test covers the 6px
  strip only. Open: a measurer outside the draw (`canvasLabelMeasurer` is
  undefined in jsdom), what a label click means (the stretch's union, which
  `labelRuns` does not carry), and label boxes blocking the ribbon pick.
- **M12.** Landed, `dc3953f5da`: every hint is "Click to show <locus>". "The panel below has scrolled off it" is false whenever part of the
  contig is on screen.
- **M13. Closed 2026-09-21**: the 0.15-alpha, 5px shadow leaves the marks
  legible in every theme. The level's `::before` drop shadow sits over the whole top strip.
- **M14.** Landed, `dc3953f5da` and `3a31c3948a`: the click adds a slice in
  the gap holding the most of the locus, beside its neighbour, and removes
  nothing. With M1, a click on a mark for a sliced contig takes the add
  class's drop path every time, replacing the user's slices (a reversed one
  included) with the whole forward contig, and the hint says "Not on the panel
  below" about a contig that is. Appending a slice framed on the mate keeps
  the list append-only.

### Grammar of graphics

Checked against [reference/GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md)
and [reference/MARK_ENCODING.md](../reference/MARK_ENCODING.md). A declared
mark fails the parity floor: instanced alpha reintroduces the saturation the
single fill path removed, the `span` painter exports a rect per mark against
one path, label runs keep a CPU pass per frame, and the layer has no text mark.
What transfers is M2's sweep test, M9's shared cull, and stating M1 as one
predicate — no place on the facing axis's domain.

### Stale docs

Landed with M7 and M2: the duplicated-region "still open" paragraph, the
"click cannot early-exit" paragraph, and ADR-138's paint-order claim.

The overlay bench's hover and click columns want a re-measure on a quiet
machine; the 2026-09-20 A/B ran at load 7-10.

## The follow

Background: `plugins/linear-comparative-view/src/SyntenyFollow/CLAUDE.md`.

### Bugs

- **B1. Crossing a contig boundary mid-drag throws the moving row onto the
  whole union, then settle snaps it back.** Landed, `094796a1d3`.
  `installSyntenyFollow.ts` clears the spread decision whenever the anchor
  shows one contig, and `followRung` reads no decision as "spread", which the
  frame pass then applies. Fix: the frame pass calls `decideSpread` when there
  is no decision.
- **B2. Two view-wide commands move the anchor to the last row they touch.**
  Landed, `ea9ceda1bf`; centering hands the anchor to the first row that
  moved (`013b4b9a47`), since handing it to a row whose `navTo` threw let the
  follow pull the moved row back. When the moved row is the mate's, the
  snackbar still warns about the other while the follow brings it along. The stack's
  "Zoom to region(s)" (`LinearSyntenyView/model.ts`) and "Center view on this
  feature" (`SyntenyFeatureDetail/LinkToSyntenyView.tsx`) call `moveTo`/`navTo`
  per row from a click handler, and both are in `ROW_GESTURES`. Fix: make them
  stack actions, as `squareView` is.
- **B3. Settle re-navigates a row the frame pass already placed.** Verified in
  the harness. The plan reads the moving row's `coarseDynamicBlocks`, which
  refresh on their own 500ms timer after the anchor's, so it compares against a
  stale position; below 1bp/px it also snaps the row to whole bases. **The
  user-visible symptom is a backwards jump mid-drag**: on volvox_inv_indels the
  frame pass placed the row at ctgA:30618-30714 and 260ms later the settle sent
  it back to 30605-30699, the anchor's pre-drag place, ~112px at 0.12bp/px.
  `planLevel` pairs one row's fresh debounced window with the other's stale one
  (~:552, :625, :653). Fix, ~7 lines: keep the debounced reads as the trigger,
  plan from both rows' live `dynamicBlocks.contentBlocks` read untracked.
- **B9. Zooming or panning out of an overview freezes the other rows, then
  they jump.** Confirmed on volvox_contig_swap: the anchor went to
  ctgA:2337-10126 and the other row sat on ctgA+ctgB for 250ms+, then jumped.
  Default trigger: the grape/peach/cacao session opens on whole genomes. The
  frame pass steers only by the settle's pick, which rung 3 drops and an
  overview never makes, while the decision still says spreading
  (`installSyntenyFollow.ts` ~:879-897). Fix, ~1 line: take the spread branch
  when `decision?.spreading && !levelStates.pickFor(level)`. In `05ffe7f378`.
- **B10. "Collapse introns → Replace current view" on a following row is
  undone at once**, and so are alignments' "View mate region" and "View split
  alignment regions" (confirmed). All go through
  `plugins/linear-genome-view/src/LinearGenomeView/showRegionsWithUndo.ts`,
  whose top-level action is `showRegions`, which the follow holds
  (`ROW_NAVIGATIONS_HELD`, needed for `navToLocString`'s async tail). The
  follow re-places the row, its locstring fallback replaces the regions, and the
  Undo snackbar stays. Fix, ~4 lines: `setDisplayedRegions` then
  `fitAllRegions` in one transaction, a gesture, so the row takes the anchor.
- **B8. Closed 2026-09-21**: for collapsed introns the union is the gene span,
  the right answer; far-apart slices of one contig come only from a
  multi-locus search and get rung 2's wide answer anyway; the fix needs
  per-slice windows `followWindowsMapping` cannot take (~30 lines). **Two visible slices of one contig follow as one window.**
  `followAnchorWindow.ts` `measure()` unions blocks per refName, so an anchor
  row showing a contig twice — a collapsed-intron row, or a slice M14's click
  added — follows the span between them, and `coversContig` reads only the
  first region of the name (reading).
- **B4. Closed 2026-09-21**: a flip re-plans at once and clears the spread
  once the new anchor shows one contig; fold into S3 if that lands. **A level's pick and spread state survive a direction flip** (reading).
  `planLevel` hands the previous block id, target contig and spread decision
  over without the frame pass's direction check.
- **B5. Closed 2026-09-21**: one flip at a tie, the jump CLAUDE.md already
  accepts when a contig joins the union. **The multi-contig spread has no target hysteresis** (reading):
  `followSpreadSpans` calls `followWindowsMapping` with no incumbent.
- **B6. A spread where one window aligns still spreads**, dropping the block
  pick and the orientation key; `followRung` counts visible windows, where
  `decideSpread` counts aligned ones. Confirmed in the harness: the row is
  interpolated, the header says "approximate", and the dropped pick feeds B9.
  Fix, ~3 lines: `decideSpread` returns a refusal onto the one contig when
  `mapped.size === 1`.
- **B7. `followDebug` reads coarse blocks tracked**, so turning the log on
  changes what the follow reacts to. Landed, `9c8925c17d`.

### Simplifications

- **S1.** About a third of the module's non-test lines are comments, much of it
  restating the CLAUDE.md, and they have drifted (below).
- **S2.** The settle pass and the frame pass share one level-walk skeleton,
  spread branch included.
- **S3.** `pickFor`/`spreadFor`/`mapFor` become one non-minting `peek`, with a
  direction on the state for B4.
- **S4.** Landed, `be3a22e689`. The anchor take (`takeFollowAnchor`, `notifyStackMove`,
  `captureStackViewports`, `FollowAnchorHost`) lives in
  `LinearSyntenyViewHelper/offscreenMateNav.ts` and serves three features;
  it moves to `SyntenyFollow/`, and one `beginStackMove(stack, row)` replaces
  the capture-then-take pair each caller repeats.
- **S5.** `resolveFollowSpan` has one caller, `followAnswerCache`.
- **S6.** `FollowPair.movingIndex` is never read; `followUnaligned`,
  `followApproximate` and `followPartial` are read only by tests.
- **S7.** `followAnchorWindows` computes per-contig `widthPx` and drops it, and
  `decideSpread` rescans the blocks for it.
- **S8.** Two spellings of the navigation backstop key.

### UI

- **U1.** "Show all regions – same bp per pixel" does nothing lasting to rows
  the follow spreads: confirmed at 61.48 against 77.89 bp/px with "same"
  selected. Fix, ~7 lines: `positionViewOnSpans` takes a minimum bp/px, and the
  rung-3 callers pass the anchor's under same-scale. The "Square view" half is
  closed: at a locus, followed rows already match the anchor's scale.
- **U2. Closed 2026-09-21**: that is what a stack pan means. A band drag moves every row, so it shifts a holding row that a drag
  on the anchor leaves alone.
- **U3.** The tooltip's grammar breaks with several contigs ("chr2, chr3
  aligns"); fix ~2 lines at `FollowSyntenyToggle.tsx` ~:87. "Approximate" shows in the tooltip unless a partial report outranks
  it, and the icon leaves it out on purpose. The partial report is parked as
  [ideas/ready/follow-partial-report-parity.md](../ideas/ready/follow-partial-report-parity.md).
- **U4. Closed 2026-09-21**: the menu reaches the pixel lock in one click.
  Turning follow off always lands on `'independent'`, losing a pixel
  lock the user came from.

### Stale docs

Landed, `9c8925c17d`, except the claim in the CLAUDE.md and `followFrameSpan.ts`
that nothing navigates at settle, which states the intent B3 breaks.
