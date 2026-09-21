---
name: synteny-mates-and-follow-review
description: Findings from a 2026-09-20 review of the off-screen mate strip and the synteny follow, the mate half re-checked by a second reviewer. The four ordered items have landed but the comment thinning; waiting on that and on every finding not marked landed — the follow's B3-B6, the mate UI items M3-M14, and the simplifications. Read before touching `drawOffscreenMates`, the mate collection in `executeSyntenyFeaturesAndPositions`, or `SyntenyFollow/`.
---

# Off-screen mates and the synteny follow: review findings

Each item names its site and how it was checked. Mark an item **landed** with
its commit when it lands; file what nobody takes up into
[ideas/](../ideas/README.md) or [TODO.md](../TODO.md) and delete this file.

## Order

1. ~~Mates: M1 (every silent drop), M7 (one hit test), M2 with its sweep
   test.~~ Landed.
2. ~~Follow: B2, then B1.~~ Landed.
3. ~~Follow: S4 (the anchor take moves into `SyntenyFollow/`).~~ Landed.
4. The comment sweep for both subsystems. The stale-doc half landed with B7;
   thinning the comments that restate `SyntenyFollow/CLAUDE.md` (S1) is open.

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
  can land showing none of it; the add class frames with `navSpan`. A union
  spanning two displayed copies of one contig centres between them and raises
  a false "no longer lands on it".
- **M4. The contig floor is per dataset, not per contig**
  (`drawOffscreenMates.ts` `forEachMark`). Two tracks on one level can each
  hold 3px of a contig and draw nothing while the tooltip sums both; M1 adds a
  second dataset per lane that splits the same way.
- **M5. A refetch leaves the mark tooltip standing** — `LevelSyntenyCanvas`
  keys the hover on `bandTransformKey`, which a refetch does not change.
- **M6. `hideUnlabelled` hides ribbons, not their marks.** Fixable on the main
  thread for class C (it carries a feature index; take the ribbon's zero-alpha
  mask, not its colour). Class A carries no attribute lanes.

### Simplifications

- **M7. One hit test.** Landed, `6e8e26c300`. `offscreenMateAt` and `offscreenMateSpanAt` are both
  full passes of the lane since before ADR-138, so the reason given for two
  (the click "cannot early-exit") is stale. Merging drops
  `OffscreenMateMark`/`OffscreenMateHit`, `stripHit` and the `displayed` flag,
  which disagrees with `mateCumBp` once M1 puts one contig in two datasets.
  The overlay bench's hover/click columns need a re-run.
- **M8.** A per-mark `bp` array on `LaneMarks` replaces
  `markAlignedBp`/`laneMarkAlignedBp`; the cross-lane `strongest` ordering is
  dead, since the two strips never share a colour other than grey.
- **M9. One cull rule.** `ribbonDrawn`/`datasetMayHide` restate
  `isRibbonCulled`'s per-edge test in cumBp; projecting to px and calling the
  generated `spanOutsideBand` makes the mirror structural.

### UI

- **M10.** The tooltip can name the destination at no cost once M7 lands —
  print `mateNavDestination(...).loc` so it matches the snackbar, and warn on
  hover for a mark that resolves to `none`.
- **M11. Labels are not hoverable or clickable**; the hit test covers the 6px
  strip only. Open: a measurer outside the draw (`canvasLabelMeasurer` is
  undefined in jsdom), what a label click means (the stretch's union, which
  `labelRuns` does not carry), and label boxes blocking the ribbon pick.
- **M12.** "The panel below has scrolled off it" is false whenever part of the
  contig is on screen.
- **M13.** The level's `::before` drop shadow sits over the whole top strip.
- **M14.** With M1, a click on a mark for a sliced contig takes the add
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
  Landed, `ea9ceda1bf`; centering hands the anchor to the feature's own row. The stack's
  "Zoom to region(s)" (`LinearSyntenyView/model.ts`) and "Center view on this
  feature" (`SyntenyFeatureDetail/LinkToSyntenyView.tsx`) call `moveTo`/`navTo`
  per row from a click handler, and both are in `ROW_GESTURES`. Fix: make them
  stack actions, as `squareView` is.
- **B3. Settle re-navigates a row the frame pass already placed.** Verified in
  the harness. The plan reads the moving row's `coarseDynamicBlocks`, which
  refresh on their own 500ms timer after the anchor's, so it compares against a
  stale position; below 1bp/px it also snaps the row to whole bases.
- **B4. A level's pick and spread state survive a direction flip** (reading).
  `planLevel` hands the previous block id, target contig and spread decision
  over without the frame pass's direction check.
- **B5. The multi-contig spread has no target hysteresis** (reading):
  `followSpreadSpans` calls `followWindowsMapping` with no incumbent.
- **B6. A spread where one window aligns still spreads** (reading), dropping
  the block pick and the orientation key; `followRung` counts visible windows,
  where `decideSpread` counts aligned ones.
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

- **U1.** "Square view" and "Show all regions – same bp per pixel" do nothing
  lasting to followed rows while following.
- **U2.** A band drag moves every row, so it shifts a holding row that a drag
  on the anchor leaves alone.
- **U3.** The tooltip's grammar breaks with several contigs ("chr2, chr3
  aligns"). "Approximate" shows in the tooltip unless a partial report outranks
  it, and the icon leaves it out on purpose. The partial report is parked as
  [ideas/ready/follow-partial-report-parity.md](../ideas/ready/follow-partial-report-parity.md).
- **U4.** Turning follow off always lands on `'independent'`, losing a pixel
  lock the user came from.

### Stale docs

Landed, `9c8925c17d`, except the claim in the CLAUDE.md and `followFrameSpan.ts`
that nothing navigates at settle, which states the intent B3 breaks.
