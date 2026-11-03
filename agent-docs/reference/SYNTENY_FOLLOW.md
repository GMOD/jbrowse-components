---
name: synteny-follow
description: How does the synteny follow keep every row on the anchor row's window? The two passes, the rungs, the anchor handoff, canonical refNames and approximate states. Read before touching SyntenyFollow.
kind: spec
---

# SyntenyFollow

`plugins/linear-comparative-view/src/SyntenyFollow/CLAUDE.md` points here. Bare paths
below are relative to `plugins/linear-comparative-view/src/SyntenyFollow/`.

## Two passes, because the exact answer costs an RPC

A CIGAR walk happens in the worker, so the **exact pass** can only ask once the
anchor settles, woken by the debounced `coarseDynamicBlocks`. A **frame pass** on
live `dynamicBlocks.contentBlocks` does everything except the RPC, so the row
moves during the drag instead of jumping after it. Exact supplies correctness,
frame supplies motion.

The exact pass wakes on the coarse blocks and reads the live ones, for the
anchor's window and for where the moving row is. Mid-drag the coarse blocks name
where the anchor was a moment ago.

**The frame pass replans; it does not extrapolate the last exact answer.** The
answer is affine inside a single alignment (`FollowTransform`) and an
**envelope** once the window is wider than any one alignment, which is not affine
in the window. The affine shortcut is taken only where it is true, and the cached
transform may only be built from a **single-block** answer: an envelope carries
no one strand, and a forward transform derived from one mirrors the row inside an
inverted alignment.

## The map is what makes the two clocks agree

Inside one block the frame pass reads a **`CigarMap`**: the block's CIGAR reduced
in the worker to a few thousand bend points, two `Uint32Array`s of offsets, one
`SyntenyGetCigarMap` per block. `applyFollowTransform` is the fallback beneath it
and `interpolateFollowSpan` beneath that; `followFrameSpan` runs the three
best-first. An affine fit drifts by whatever indels lie between the settle's
window and the one the user panned to, and the settle corrects it visibly. With
the map the settle finds the row already there, `alreadyShowing` says yes, and
nothing navigates.

- **Asked for on an envelope settle too.** The envelope reads no map, but the
  pick is the widest block under the window, and a zoom into it mid-drag needs
  the map in hand.
- **Once per block, where the resolve is once per window.** The map answers every
  window inside the block at the price of walking the whole CIGAR.
  `LevelCigarMap` outlives the pick, and a miss is recorded too, or a CIGAR-less
  block is asked about every settle.
- **A map is refused unless it names this block**: by track, feature id and tier
  where the frame pass reads it, and by the block's own coordinates in
  `cigarMapSpan`. Two PAF tracks for one pair mint the same row-index ids, a v2
  PIF gives an alignment's coarse and fine rows one id, and an all-vs-all file has
  several rows over one extent. The tier is the payload's own `lodTier`, the one
  its ids were fetched at; the display's live `lodTier` moves with the zoom ahead
  of the refetch.
- **A map request carries the store's own abort signal**, so dropping the store
  stops the work and not merely the answer. The signal is scoped to the
  generation, not rotated per call, because a later window inside the same block
  wants the map already in flight.
- **The row's scale is not constant through a pan**, so `offsetPx` can move
  backwards over a step the row moved forwards through. Assert a follow's motion
  in bp.

The map is not the whole answer: a matching region on another contig is still the
exact pass's `navTo`, which the frame pass may not do, and a block with no CIGAR
has no map.

## Three rungs, coarsening as the anchor's window widens

- Inside one alignment: the CIGAR walk, exact.
- Wider than one alignment, inside one contig: `followWindowMapping`'s envelope,
  approximate.
- Wider than one contig: `followSpreadSpans`, the union of what each visible
  contig maps to, placed as an interval of the moving row's own layout.

Rung 3 makes a whole-genome overview a place a row can be. One `ResolvedSpan`
names one contig, so without it "show all regions" sent every row to whichever
chromosome aligned to the anchor's widest contig.

**Rung 2's target contig is a vote, and the vote carries the block pick's
margin.** A window wider than one alignment reaches several of the mate's contigs,
and `followWindowsMapping` picks the one most of the window aligns to. At a
fusion the two are equal at the join, so a bare comparison flips chromosome every
frame; `preferIncumbent` holds it at the block's 1.5x. The incumbent is
`LevelPick.target`, where the last settle placed the row, so it dies with the
pick (a rung-3 pass or a held row clears it), and an incumbent no block under the
window reaches totals zero and cannot hold the answer on the bias alone.

## The third rung is offered, not taken automatically

**A union is refused when it is mostly filler.** `positionViewOnSpans` places an
interval, and a row lays its regions end to end, so two answers that are not
neighbours in the moving row's layout put every contig between them on screen.
`decideSpread` measures coverage against the bounds `positionViewOnSpans` will
use, and under half the row hands the level back to the rung below, on the widest
window by pixel.

**Demotion, not trimming.** Falling through to rung 2 inherits the block pick, the
CIGAR map, the settled resolve, `alreadyShowing` and the hysteresis. Dropping the
smaller span would be a new placement mode with none of them, and a cliff.

**Coverage cannot decide this alone**: an honest whole-genome overview can cover
under a quarter of what it places. What separates them is structural: an
overview's windows are whole contigs, a straddle's are cut on both sides of a
junction, so `partialShare` gates the coverage test and the overview never reaches
it. The tolerance in that test is load-bearing: block edges come off pixels, so
contigs on a `showAllRegions` panel report an end a hair short of their region's.

**A carried spread is never re-judged.** Its windows are spans, partial by
construction, so the gate would open on every one and demote the second row of an
honest overview. The level that decided it already judged it.

**The decision is made once and followed.** The rung's answer is recomputed per
frame; whether to take the rung is not, since a per-frame re-decision flips
between the two furthest-apart placements across a threshold the user is panning
along. `FollowLevelState.spread` carries it, with a band on the way back up and
`preferIncumbent` on the window kept. The settle makes it, except where a drag
carries a second contig on screen before any settle has: the frame pass then
decides once by the same `decideSpread` and records it, and the settle inherits
that answer.

**It dies with its window set.** `planSpread` runs only on two windows or more, so
`planLevel` clears the decision, its incumbent and its band once the anchor is
down to one window. Kept, a refusal outlives the anchor zooming into one contig,
and `followReport.partial` names a region the anchor no longer spans.

**The frame pass follows the decision, not the contig it names.** A drag can carry
the kept contig off screen; the pass then falls through to the widest window,
which is what the settle keeps too.

**`partial` is a field of the header's `FollowReport`** (`following`,
`elsewhere`), written in `planLevel` and read only by the header. A row not
showing everything the anchor aligns to says so, and it carries both region
names: scrolling the anchor onto the other region makes it the widest window, so
the rows follow it. A control that navigated for the reader would move a row the
follow moves and owe the whole `showOffscreenMateContig` dance. The contigs it
offers are the ones `followSpreadSpans` actually mapped. `followDebug` prints the
whole decision per settle under `localStorage.debugSyntenyFollow`, and
`products/jbrowse-web/browser-tests/follow-spread-probe.ts` drives a live session
with it.

**Every visible contig is asked, not the two outer edges.** Mapping the leftmost
and rightmost visible bp is wrong whenever the two assemblies order their contigs
differently, which the multiway demo does deliberately.

**Two visible slices of one contig follow as one window**, since the windows union
blocks per refName. For collapsed introns that is the gene span; far-apart slices
come only from a multi-locus search and are not handled.

**One scan of the blocks, not one per contig.** `followWindowsMapping` takes the
windows as a list, and `followAnchorWindows` drops sub-pixel contigs and caps the
list, so a scaffold-level assembly cannot turn one pass into thousands. It is
still a whole scan per frame; measure it first if dragging an overview on a
whole-genome PAF reads as slow.

**A sliver beside a full panel is not a contig the panel is showing.** The count
of windows selects the rung, so a 2px tail of the contig being scrolled off would
count like the one filling the panel, and its mate a genome away would double the
moving row's `bpPerPx` mid-drag. `MIN_SHARE_OF_WIDEST` (a twentieth) drops it,
relative to the widest window rather than the panel, because a two-contig
assembly is legitimately lopsided and a share-of-panel floor would call its
overview a straddle. The cliff is inherent: a union of spans jumps whenever a
contig joins or leaves it.

**The answer is an interval of the moving row's layout, not a `ResolvedSpan`.**
`positionViewOnSpans` takes the min and max of the mapped spans in that row's
offset space and places with `moveTo`, never a locstring, which names one contig.
A row with no region for any of the answer gets the one navigation this rung
makes, to the widest span, guarded by `lastNav`: the follow may not widen a row's
region set any more than it may narrow one.

**Rung 3 drops the level's pick.** No one block places the row, and the frame pass
steers by the last pick. The frame pass recomputes rung 3 itself, which it can
because the rung chooses no block, holds no strand and needs no transform. Until a
settle picks, it places a spreading level by rung 3 even over one window, so
zooming from an overview into one contig does not leave every row on the whole
genome.

The overview is a fixed point only up to the unaligned flanks: the union starts at
the first block's mate edge, so a row with unaligned ends settles a hair inside
its full extent, once, and reports `followReport.approximate`.

## Ordering is outward from the anchor, not by level index

An alignment relates one pair of rows, so the follow propagates one level at a
time and an interior row is both an output and an input. `followPairs` sorts by
`followDirection`'s `distance`, not `level.level`; the two coincide only when the
anchor is the top row.

**An interior row is read as the answer it was placed on, never as what it ends
up showing.** `PlacedWindows` carries that answer across the pass. The two differ
at rung 3, where placing a row on chr1 and chr9 also puts chr2..chr8 on its
screen; read back off the blocks, that filler maps somewhere of its own at the next
level and compounds. `installSyntenyFollow.test.ts` holds the far row of a
three-row stack to the chromosomes the carry keeps.

The carry is not filtered against what the moving row can show: the fetch keeps a
block only when both ends are in view, so a carried window on a contig the row is
not displaying maps to nothing. A carried row's blocks are not read at all. The
mechanism, stated without the genomics:
[../mechanisms/carry-the-decision-not-the-rendered-state.md](../mechanisms/carry-the-decision-not-the-rendered-state.md).

## `planLevel` is the only place observables are read

`execute` is `async` and MobX stops tracking at the first `await`. **`FollowStep`
is that boundary, not a convenience struct**: a field missing from it can only be
read untracked, producing a follow that works once and never re-fires.

The placements run inside `untracked` for the converse reason. `execute` runs
synchronously up to its first `await`, and down that path `resolveMatchingSpan`
reads the display's `connectedViews` and the moving axis's `assemblyNames`;
`executeSpread` reads the row it writes and, under `coord.ratio`, the anchor's raw
`bpPerPx` (`spreadFloor`), which the frame pass writes every frame. Tracked, the
moving row's zoom and regions become dependencies of the debounced pass. The
lookups' tier comes off the picked block, not the display's `lodTier`, which
derives from both rows' raw `bpPerPx` too.

`FollowLevelState` is a plain object, not MST or a MobX box, since the exact pass
writes it every pass. The `FollowReport` (`unaligned`, `approximate`,
`noSyntenyTrack`, `partial`) is written here and read only by the header, through
one merging setter; a new flag goes on the report, not beside it.

**Which rung a level is on is `followRung`, read by both clocks**, so the two
cannot spell it differently. A refusal lands on a contig that answered: the widest
window regardless can be an unaligned contig with nothing to place from, holding
every row while `elsewhere` names two contigs that did answer.

## `seq` is bumped per PASS, not per resolve

Latest-wins over an unordered RPC, bumped for every level the pass visits,
including one that found nothing, which has decided the row holds and lit
`followReport.unaligned`. Bumped only for levels with something to resolve, the
previous window's answer landed underneath that and moved the row anyway.

**`seq` cannot see a move between settles.** The coarse blocks wake the settle on
a throttle, so an answer can land after the staying row has moved and before the
settle that move brings. `execute` compares the staying row's live windows with
the ones it planned from, and on a difference records the pick and stops: the next
frame of motion places the row through that pick. An answer on a contig the moving
row does not display navigates regardless, since only a navigation reaches it. A
carried level reads no row, so it is not checked.

Switching the mode off issues no pass, so `execute` has its own check; switching
it back on defeats that, since dropping the store leaves an in-flight `execute`
holding a state object nobody will bump again. `levelStates` counts its own resets
and the plan carries the count. The count is what a resolve is discarded by; the
signal beside it is what the map is aborted by. They are different questions,
because a resolve is shared by three re-entrant passes that still want it.

## What each pass may touch

- The exact pass **navigates** (`navToResolvedSpan`), since the matching region can
  be on another contig.
- The frame pass **positions** (`positionViewOnSpan` through the free
  `Base1DUtils.moveTo`, not the view action) and must not navigate: sixty times a
  second a navigation flushes the row's coarse blocks, an RPC per frame.
- The frame pass reads each level's **staying** row and never its moving row.
  With the outward ordering an interior row is written before the level beyond it
  reads it, but it is read **untracked** once this run has written it. Ordering
  settles the value; the dependency is separate, and a tracked read of a row the
  same run just wrote re-runs the whole pass. A row this pass did not write stays
  tracked, since then its window is a real input.

The exact pass does not read the moving row's blocks either: touching that row
takes the anchor, so nothing the reader does to it is the follow's to put back.
It still re-enters on its own navigation through the level's alignments, since a
placement that moves the row's snapped fetch window refetches them. Two things
make that converge: `alreadyShowing` compares against where the row actually is,
with a tolerance; and the per-level answer promise is shared by key, so the three
re-entrant passes ride one `SyntenyResolveMatchingRegion`. The integration suite
asserts that count.

## Touching a followed row takes the anchor

The rows follow whichever row the reader is driving. The anchor's next move places
every other row, so the anchor has to be the row the reader last touched, or the
follow undoes their move.

**The trigger is the input, not the action.** `RowTouchArea` wraps each row and
calls the view's `rowTouched` on a pointer press, a key, or a wheel the row zooms
or pans on (`wheelDrivesView`, the wheel controller's own rule, so scrolling the
page past a stack takes nothing), in the capture phase so a child that stops
propagation still counts. React propagates along its own tree, so a menu or dialog
the row opens in a portal counts as the row. `rowMenuItems`' copy of each row's
menu sits in the view header instead, so `touchingRow` wraps its items to touch
the row before running.

**Navigation never moves the anchor.** The follow's own placements, a launch spec
placing its rows, an appended row's init and a script calling `navToLocString` all
leave it where it was; a script that wants a row to lead calls
`setFollowAnchorIndex`. The view-wide moves (`squareView`,
`showAllRegionsAcrossRows`, the rubber band's "Zoom to region(s)", a band drag)
touch no row. `centerStackOnFeature` sets the anchor itself, onto the first row
that moved: the feature's own, unless its `navTo` threw.

**A touch that moves nothing moves nothing.** A click on a feature switches the
anchor too, which is harmless only because re-planning from the new anchor puts
every row where it already is; `LinearSyntenyFollow.test.tsx` holds a window cut
across several alignments to that.

Classifying a row's actions by name (MST middleware) was tried and retired: it
still read a script's navigation as the reader's.
`followAnchor.integration.test.tsx` holds the input rule on a real stack.

## That convergence is load-bearing, and nothing else damps it

`alreadyShowing` saying no means navigate, and navigating wakes the pass that
asked. So anything it can never say yes to is an infinite loop, not a
misplacement: one core at 90%, and jest's own timeout does not fire because the
loop starves the timer queue.

The loudest way in is **a navigation that replaces `displayedRegions`** whether or
not the row moved, which invalidates `followPairs`, the first thing the exact pass
reads. `navToResolvedSpan` takes `navTo` first, which moves inside the row's
existing regions, so a navigation that does not move the row wakes nothing. It is
not the only way in: a placement that moves the row's fetch window refetches the
alignments the exact pass reads, so any placement it disagrees with wakes it
again. The backstop stays load-bearing: asking for the same span **from the same
observed window** twice cannot be a real disagreement, so `execute` refuses the
second. Arriving clears the record, which keeps a row navigable back to exactly
the span it left.

**A navigation that rejected keeps its record too, deliberately.** A
`navToLocString` that replaces `displayedRegions` and then throws would wake the
pass and be retried on every wake, the unbounded loop again. The cost is a level
that will not retry that exact from-to pair until something moves, which the next
settle supplies.

The backstop bounds the shape; two checks close the two ways in.

A view cannot show a span below `minBpPerPx * width`; it centres and widens it.
So the row reports back a window the answer merely sits inside, which on the
numbers is not "already there". `alreadyShowing` takes that floor and accepts
**containment** within it, not a predicted window, since navTo also clamps to the
displayed regions near a contig end.

And a **zero-width answer is not a place at all**: the caller holds and lights
`followReport.unaligned`. Holding means dropping the level's pick as well, or the
frame pass goes on placing a row this branch decided to hold, on a transform
measured over a window it has left. A CIGAR walk clamps the window to its block
before walking, so a block whose axes are not what the plan thought brings both
ends back on one coordinate, as a swapped-assembly track does and someone can
legitimately configure. Widening one would fling the row to base-level zoom on a
coordinate the arithmetic never identified.

A collapse has to be **reported rather than rounded away** for that check to see
it, so `interpolateFollowSpan` returns the collapse and only widens a real span.
`navToResolvedSpan` clamps before assembling a locstring and `positionViewOnSpan`
refuses a zero-width span; `followWindowMapping`'s `hi > lo` gate rejects a
collapse before any rounding.

A frame-pass span off the row's displayed regions is not an error: the row is
showing another contig and the exact pass is on its way to navigate it.

## The follow can only reach contigs the moving row already displays

The synteny fetch keeps a block only when **both** ends are in view, so a row
parked on one contig is only ever sent alignments already pointing at it. This
silently weakens any test written without it.

**So the follow must never narrow the row's own region set**, or the limit becomes
self-inflicted and permanent: a `navToLocString` resolving to a single location
replaces `displayedRegions` wholesale, collapsing a whole-genome row onto
whichever contig the answer landed on, and every later pan reports "nothing aligns
here". `navToResolvedSpan` takes `navTo` first for that reason and falls back only
for a span the row genuinely cannot reach. A placement that replaces regions is
the thing to look at first if this comes back.

## Every refName the follow reads is canonical, made so in two places

Nothing here canonicalizes; every comparison assumes both operands already agree.
They do because both channels are renamed first: `featureData`'s
`refNameDict`/`mateRefNameDict` in the fetch's `run`, and `ResolvedSpan.refName`
on receipt in `resolveMatchingSpan`.

**A change that canonicalizes only one of them is worse than one that
canonicalizes neither**: `alreadyShowing` would compare canonical against
adapter-space, never match, and renavigate on every wake.
`LinearSyntenyRefNameAlias.test.tsx` fails if either half goes. Both directions
are live, so neither rename is redundant.

Each channel resolves per axis, and the two resolvers are only distinguishable by
that file's third fixture; the query-axis ones cannot see a swap, because the
assembly they would swap in declares no aliases.
[REFNAME_NAMESPACES.md](REFNAME_NAMESPACES.md) has the per-site table.

## Approximate is a state the UI reports, not a failure

Three things force an interpolation over a CIGAR walk: an envelope, a tier with no
CIGAR (a PIF's coarse tier), and a file mixing them so the per-fetch `hasCigar` is
true while this block has none. The click-driven move refuses; the follow must
not, or the mode would work zoomed in and silently stop in the whole-genome view
where it is most useful.

The flag is written from **both halves of the exact pass**: the plan sees the first
two cases, the third is only knowable once the walk comes back empty. Only the
prefix lowers it; a promotion that could also lower would race the plan's reset
and flicker.

`followReport.unaligned` is the different answer: nothing covers the window, so
the rows hold. Without the flag a held row and a dead follow look identical.

## The follow never turns a row round

The follow moves a row and leaves its orientation alone, so inside an inverted
alignment the row pans opposite the anchor and the crossing ribbons show the
inversion. Flipping a row to pan with the anchor was dropped
(`navigation.matchOrientation`) because it hides half of a rearrangement. A hand
flip (`horizontallyFlip`) stands, and does not take the anchor.

## Block coordinates are `start <= end`, with direction in `strands`

A block is never negative-width. `followWindowMapping` interpolates, so it needs no
zero-clamp; `applyFollowTransform` **extrapolates** and clamps, before the
`hi > lo` test, so a wholly-negative answer becomes no answer (hold the row)
rather than an inverted span.

Which axis of a block is which is `followAxes`, in one place because
`planFollowStep` picks a block with `pickFollowFeature` and then maps the same
window with `followWindowMapping`: a block in scope for one and not the other is a
plan whose two halves are about different data.

A frame-pass span carries **fractional** bp, where every other `ResolvedSpan` here
is whole. Rounding the cached transform quantizes the row's motion to whole bases,
visible below 1 bp/px, so it feeds `positionViewOnSpan`, which is pixel
arithmetic, and never `navToResolvedSpan`.

## `levelStates` is keyed by the level node

Keyed by index, an entry outlives a removed level and a re-added row inherits a
dead level's incumbent feature id and cached transform. A `WeakMap` on the node is
also the entire pruning story.

The store hands out two things on purpose: `get` and `facing` mint state, `peek`
does not. The frame pass steers by the exact pass's pick and must not mint one;
the only state it writes is the spread decision it makes for an undecided level
and the spread targets it placed by.

`lastErrorMessage` lives there too, per level rather than per view: a follow that
cannot resolve says so once, and a view-wide slot would let a level that resolves
fine clear it every pass while the broken one reported itself again. `notifyError`
always attaches a `report` action, which bypasses the snackbar model's own message
dedup, so nothing downstream absorbs the repeats.

## Navigating a followed row from elsewhere in the view takes the anchor

The anchor's next move places every row the follow moves, and only a touch inside
a row moves the anchor, so anything that navigates a row the follow moves has to
take the anchor explicitly and onto the right row, or it changes nothing and says
it did. `showOffscreenMateContig` does, and its undo puts the anchor back with the
regions, because the anchor is a persisted view-wide setting.
`LinearSyntenyOffscreenMateFollow.test.tsx` holds it, on a PAF and both clocks; a
model-level test cannot see it, since with no alignments there is nothing to
re-assert.

**Three call sites, each opening with `beginStackMove`, and a move anchors the row
it does not navigate.** The band's two items and the LGV display's "move other
panel": a mark anchors the row it sends somewhere, a move anchors the row it leaves
alone, because that is what the label promises. `LinearSyntenyMoveFollow.test.tsx`
holds the untaken case. `bandMoveTargets` carries the staying row's index rather
than letting the item re-derive it from `toMate` and the level, so the item and the
action cannot disagree.

**A take is not earned until the navigation lands, so `movePanelsToSpan` gives it
back when nothing moved.** Not only the throwing case: `navToLocString` resolves
without navigating when the contig is not a refName here and the text search
raises a picker over the hits instead, which is ordinary for a PAF naming contigs
`1`,`2` against an assembly spelling them `chr1`,`chr2`. The moves offer no undo
for a navigation that stayed inside the row's own regions, since nothing was
discarded; only for the fallback that replaced them, and for the take itself,
which moved rows the click never named.
