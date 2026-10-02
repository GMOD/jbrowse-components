---
name: synteny-follow
description: How the synteny follow keeps every row on the anchor row's window — the two passes, the rungs, the anchor handoff, canonical refNames and approximate states. Read before touching SyntenyFollow.
kind: spec
---

# SyntenyFollow

The rules list and the subsystem's overview are `plugins/linear-comparative-view/src/SyntenyFollow/CLAUDE.md`. Bare paths
below are relative to `plugins/linear-comparative-view/src/SyntenyFollow/`.

## Two passes, because the exact answer costs an RPC

A CIGAR walk happens in the worker, so the **exact pass** can only ask once the
anchor settles, woken by the debounced `coarseDynamicBlocks`. On its own the row
would sit still through the drag and jump half a second after the user stops, so
a **frame pass** on live `dynamicBlocks.contentBlocks` does everything except
the RPC. Exact supplies correctness, frame supplies motion.

**The exact pass wakes on the coarse blocks and reads the live ones**, for the
anchor's window and for where the moving row is. Mid-drag the coarse blocks name
where the anchor was half a second ago, and after a drag they name where the
moving row was before the frame pass placed it.

**The frame pass replans; it does not extrapolate the last exact answer.**
Extrapolating snaps 43% of a screen when the settle lands, because "the answer"
is two functions: affine inside a single alignment (`FollowTransform`), and an
**envelope** once the window is wider than any one alignment, which is not
affine in the window. So the affine shortcut is taken only where affine is true,
and the cached transform may only be built from a **single-block** answer — an
envelope carries no one strand, and a forward transform derived from one mirrors
the row inside an inverted alignment.

## The map is what makes the two clocks agree

Inside one block the frame pass reads a **`CigarMap`** — the block's CIGAR
reduced in the worker to a few thousand bend points, two `Uint32Array`s of
offsets, one `SyntenyGetCigarMap` per block. `applyFollowTransform` is the
fallback beneath it and `interpolateFollowSpan` beneath that; `followFrameSpan`
runs the three best-first.

An affine fit drifts by whatever indels lie between the settle's window and the
one the user panned to, and the settle corrects it visibly: 15.5bp over a 200px
pan on `volvox_inv_indels`, growing with the distance, and worst for a human
pair where one block runs for tens of Mb. With the map the settle finds the row
already there, `alreadyShowing` says yes, and nothing navigates.

**Asked for on an envelope settle too.** The envelope reads no map, but the pick
is the widest block under the window, and a zoom into it mid-drag needs the map
in hand.

**Once per BLOCK, where the resolve is once per window.** The resolve answers
_this_ window; the map answers every window inside the block, at the price of
walking the whole CIGAR. `LevelCigarMap` therefore outlives the pick, and a MISS
is recorded too, or a CIGAR-less block is asked about every settle forever.

**A map is refused unless it names this block**, by feature id where the frame
pass reads it and by the block's own coordinates in `cigarMapSpan`. Both: ids
are only comparable within one LOD tier, and an all-vs-all file has several rows
over one extent.

**A map request carries the store's own abort signal**, so dropping the store
stops the work and not merely the answer; each request re-reads the whole region
out of the file. The signal is scoped to the generation rather than rotated per
call, because a later window inside the same block still wants the map already
in flight for it.

**The row's scale is not constant through a pan.** A 1001bp anchor window
matches 1017bp of the target here and 982bp four steps later, as a deletion
comes into view, so `offsetPx` can move backwards over a step the row moved
forwards through. Assert a follow's motion in **bp**.

The map is not the whole answer: a matching region on another contig is still
the exact pass's `navTo`, which the frame pass may not do, and a block with no
CIGAR has no map.

## Three rungs, coarsening as the anchor's window widens

1. **Inside one alignment** — the CIGAR walk, exact.
2. **Wider than one alignment, inside one contig** — `followWindowMapping`'s
   envelope, approximate.
3. **Wider than one contig** — `followSpreadSpans`, the union of what each
   visible contig maps to, placed as an interval of the moving row's own layout.

Rung 3 is what makes a **whole-genome overview a place a row can be**. One
`ResolvedSpan` names one contig, so without it "show all regions" sent every row
to whichever chromosome aligned to the anchor's widest contig.

**Rung 2's target contig is a vote, and the vote carries the block pick's
margin.** A window wider than one alignment reaches several of the mate's
contigs, and `followWindowsMapping` picks the one most of the window aligns to.
At a fusion — the anchor's contig is two of the mate's laid end to end — the two
are equal at the join, so a bare comparison flips chromosome every frame there;
`preferIncumbent` holds it at the block's 1.5x. The incumbent is
`LevelPick.target`, where the last settle placed the row, so it dies with the
pick — a rung-3 pass or a held row clears it — and an incumbent no block under
the window reaches totals zero, so it cannot hold the answer on the bias alone.

## The third rung is offered, not taken automatically

**A union is refused when it is mostly filler.** `positionViewOnSpans` places an
interval, and a row lays its regions end to end, so two answers that are not
neighbours in the moving row's layout put every contig between them on screen:
13.9Mb of answer inside a 137.6Mb row on grape/peach/cacao. `decideSpread`
measures that as coverage against the bounds `positionViewOnSpans` will use, and
under half the row hands the level back to the rung below, on the widest window
by pixel.

**Demotion, not trimming.** Falling through to rung 2 inherits the block pick,
the CIGAR map, the settled resolve, `alreadyShowing` and the hysteresis, where
dropping the smaller span would be a new placement mode with none of them — and
a cliff, placing a tail at 4.9% of the widest window by rung 2 and one at 5.1%
in a union ten times the size.

**Coverage cannot decide this alone.** An honest whole-genome overview on the
same data covers as little as **22%** of what it places. What separates them is
structural: an overview's windows are WHOLE contigs, a straddle's are cut on
both sides of a junction, so `partialShare` gates the coverage test and the
overview never reaches it. The tolerance in that test is load-bearing: block
edges come off pixels, so five of eight contigs on a `showAllRegions` panel
report an end a hair short of their region's.

**A carried spread is never re-judged.** Its windows are spans, partial by
construction, so the gate would open on every one and demote the second row of
an honest overview. The level that decided it already judged it.

**The decision is made once and followed.** The rung's _answer_ is recomputed
per frame; whether to take the rung is not, since these are the two
furthest-apart placements this subsystem can produce and a per-frame re-decision
flips between them across a threshold the user is panning along.
`FollowLevelState.spread` carries it, with a band on the way back up and
`preferIncumbent` on the window kept. The settle makes it, except where a drag
carries a second contig on screen before any settle has: the frame pass then
decides once by the same `decideSpread` and records it, and the settle inherits
that answer as its previous one.

**It dies with its window set.** `planSpread` runs only on two windows or more,
so `planLevel` clears the decision, its incumbent and its band once the anchor
is down to one window. Kept, a refusal outlived the anchor zooming into one
contig, and `followReport.partial` named a region the anchor no longer spans.

**The frame pass follows the DECISION, not the contig it names.** Half a second
of drag can carry the kept contig off screen; the pass then falls through to the
widest window, which is what the settle keeps too, since `decideSpread` picks
`onto` by pixel and an incumbent no window reaches cannot hold it.

**`partial` is a field of the header's `FollowReport`**, written in `planLevel`
and read only by the header. A row not showing everything the anchor aligns to
says so, and it carries **both region names**: scrolling the anchor onto the
other region makes it the widest window, so the rows follow it — an ordinary
navigation of the row the reader is already driving, with no button, anchor take
or undo. A control that navigated for them would move a row the follow moves and
owe the whole `showOffscreenMateContig` dance. The contigs it offers are the
ones `followSpreadSpans` actually MAPPED, since a contig with no alignment in
the file shows nothing. `followDebug` prints the whole decision per settle under
`localStorage.debugSyntenyFollow`, and `browser-tests/follow-spread-probe.ts`
drives a live session with it.

**Every visible contig is asked, not the two outer edges.** Mapping the leftmost
and rightmost visible bp is wrong whenever the two assemblies order their
contigs differently, which the multiway demo does deliberately: the anchor's
first contig maps to the mate's _last_ region and the interval runs backwards
over a slice of the row.

**Two visible slices of one contig follow as one window**, since the windows
union blocks per refName. For collapsed introns that is the gene span, the right
answer; far-apart slices of one contig come only from a multi-locus search, and
per-slice windows would take ~30 lines `followWindowsMapping` has no slot for.

**One scan of the blocks, not one per contig.** `followWindowsMapping` takes the
windows as a list, and `followAnchorWindows` drops sub-pixel contigs and caps
the list, so a scaffold-level assembly cannot turn one pass into thousands. It
is still a **whole scan per frame**, at the zoom with the most blocks in hand —
5ms per bare pass at 500k, per display, per level — and nothing cheaper exists
without indexing the blocks by contig. First thing to measure if dragging an
overview on a whole-genome PAF reads as slow.

**A sliver beside a full panel is not a contig the panel is showing.** The COUNT
of windows selects the rung, so a 2px tail of the contig being scrolled off
would count like the 798px one filling the panel, and its mate a genome away
doubles the moving row's `bpPerPx` mid-drag — 151 bp/px against rung 2's 75 on a
permuted pair. `MIN_SHARE_OF_WIDEST` drops it, relative to the WIDEST window
rather than the panel, because a two-contig assembly is legitimately lopsided:
volvox is 89% ctgA, and a share-of-panel floor would call an overview of it a
straddle.

The cliff is inherent: a union of spans jumps whenever a contig joins or leaves
it, by however far that contig's mate is from the rest. The floor puts the jump
where the contig is a twentieth of the widest on screen, which the reader can
see.

**The answer is an interval of the MOVING row's layout, not a `ResolvedSpan`.**
`positionViewOnSpans` takes the min and max of the mapped spans in that row's
offset space and places with `moveTo`, never a locstring, which names one
contig. A row with no region for any of the answer gets the one navigation this
rung makes, to the widest span, guarded by `lastNav`: the follow may not widen a
row's region set any more than it may narrow one.

**Rung 3 drops the level's pick.** No one block places the row, and the frame
pass steers by the last pick. The frame pass recomputes rung 3 itself, which it
can because the rung chooses no block, holds no strand and needs no transform.

**Until a settle picks, the frame pass places a spreading level by rung 3 even
over one window**, so zooming from an overview into one contig does not leave
every row on the whole genome until the settle.

**Rung 3 reads the moving row like the rung below does**, so a hand zoom
re-asserts on the next coarse-block debounce. The read costs one re-entry per
placement, which converges: re-placing writes the same numbers,
`setCoarseDynamicBlocks` does not assign an equivalent array, and no RPC is
involved.

The overview is a fixed point only **up to the unaligned flanks**: the union
starts at the first block's mate edge, so a row with unaligned ends settles a
hair inside its full extent, once, and reports `followReport.approximate`.

## Ordering is outward from the anchor, not by level index

An alignment relates one pair of rows, so the follow propagates one level at a
time and an interior row is both an output and an input. `followPairs` sorts by
`followDirection`'s `distance`, not `level.level`; the two coincide only when
the anchor is the top row.

**An interior row is read as the answer it was PLACED ON, never as what it ends
up showing.** `PlacedWindows` carries that answer across the pass. The two
differ at rung 3, where placing a row on chr1 and chr9 also puts chr2..chr8 on
its screen; read back off the blocks, that filler maps somewhere of its own at
the next level and compounds, and a two-contig answer left the far row of a
three-row stack on the whole genome. `installSyntenyFollow.test.ts` holds the
far row to the three chromosomes the carry keeps.

The carry is **not filtered against what the moving row can show**: the fetch
keeps a block only when both ends are in view, so a carried window on a contig
the row is not displaying maps to nothing. A carried row's blocks are not read
at all; what re-asserts a hand-nudged interior row is the level that moves it,
which reads its coarse blocks on every rung.

The mechanism, stated without the genomics:
`agent-docs/mechanisms/carry-the-decision-not-the-rendered-state.md`.

## `planLevel` is the only place observables are read

`execute` is `async` and MobX stops tracking at the first `await`.
**`FollowStep` is that boundary, not a convenience struct** — a field missing
from it can only be read untracked, producing a follow that works once and never
re-fires.

The resolves are kicked off inside `untracked` for the converse reason.
`execute` runs synchronously up to its own first `await`, and down that path
`resolveMatchingSpan` reads the display's `lodTier`, derived from both views'
**raw `bpPerPx`**, which the frame pass writes every frame; tracked, the moving
row's zoom becomes a dependency of the debounced pass.

`FollowLevelState` is a plain object, not MST or a MobX box, since the exact
pass writes it every pass. The `FollowReport` (`unaligned`, `approximate`,
`noSyntenyTrack`, `partial`) is **written here and read only by the header**,
through one merging setter; a new flag goes on the report, not beside it.

**Which rung a level is on is `followRung`, read by both clocks**, so the two
cannot spell it differently. A refusal lands **on a contig that answered**: the
widest window regardless can be an unaligned contig with nothing to place from,
holding every row while `elsewhere` names two contigs that did answer.

## `seq` is bumped per PASS, not per resolve

Latest-wins over an unordered RPC, bumped for every level the pass _visits_ —
including one that found nothing, which has decided the row holds and lit
`followReport.unaligned`. Bumped only for levels with something to resolve, the
previous window's answer landed underneath that and moved the row anyway.

**`seq` cannot see a move between settles.** The coarse blocks wake the settle
on a 500ms throttle, so an answer can land after the staying row has moved and
before the settle that move brings. `execute` compares the staying row's live
windows with the ones it planned from, and on a difference records the pick and
stops: the next frame of motion places the row through that pick. An answer on a
contig the moving row does not display navigates regardless, since only a
navigation reaches it and a staying row that moves away and back inside one
throttle brings no settle. A carried level reads no row, so it is not checked.

Switching the mode off issues no pass, so `execute` has its own check — and
switching it back on defeats that, since dropping the store leaves an in-flight
`execute` holding a state object nobody will bump again. `levelStates` counts
its own resets and the plan carries the count. The count is what a resolve is
DISCARDED by; the signal beside it is what the map is ABORTED by, different
questions because a resolve is shared by three re-entrant passes that still want
it.

## What each pass may touch

- The exact pass **navigates** (`navToResolvedSpan`), necessary since the
  matching region can be on another contig.
- The frame pass **positions** (`positionViewOnSpan` → the free
  `Base1DUtils.moveTo`, not the view action) and must not navigate — sixty times
  a second a navigation flushes the row's coarse blocks, i.e. an RPC per frame.
- The frame pass reads each level's **staying** row and never its moving row.
  With the outward ordering, an interior row is written before the level beyond
  it reads it — but it is read **untracked** once this run has written it.
  Ordering settles the value; the dependency is separate, and a tracked read of
  a row the same run just wrote re-runs the whole pass: 2.00 runs per pan step
  on three rows anchored at the top, against 1.00 for two rows or three anchored
  in the middle. A row this pass did **not** write stays tracked, since then its
  window is a real input.

The exact pass reads the moving row on purpose, inverting that rule: `planLevel`
reads its coarse blocks, and that dependency is what re-asserts the follow over
a row the user nudged by hand. It therefore re-enters on its own navigation —
one settle wakes it three times, and two things make that converge:
`alreadyShowing` compares against where the row actually is, with a tolerance;
and the per-level answer promise is shared by key, so all three ride one
`SyntenyResolveMatchingRegion`. The integration suite asserts that count.

## A gesture on a followed row takes the anchor

The rows follow whichever row the reader is driving. The exact pass re-asserts
the follow over any row that moved and cannot tell a drag from a navigation some
feature made, so the gesture itself decides.

**The trigger is the gesture, not the settle.** MST middleware on the stack,
installed with the follow: a **root** action from `ROW_GESTURES` on a row that
is not the anchor takes the anchor onto it, before the action runs, so the first
`horizontalScroll` of a drag switches and the rest arrive from the anchor. The
set is what a person's own gesture on a row produces — drag and wheel, rubber
band and ruler label, the search box, the row's own menu.

**The follow tells a gesture from its own work by root action alone.** Its frame
pass places rows through `zoomTo`/`scrollTo` sixty times a second and its exact
pass through `navTo`/`navToLocString`, indistinguishable by name from a wheel or
a search box — so every placement runs inside the host's `holdFollowAnchor`
action, which makes them NESTED actions the middleware never sees. The explicit
moves take the same route through `FollowAnchorTake.hold`: a band move anchors
the row it does not navigate, and the navigation of the row it does would
otherwise take the anchor straight back.

**A held navigation's tail is told apart by the row it lands on.**
`navToLocString` reaches for `navToLocations` and then `showRegions` after an
await, as fresh roots, and the header search box navigates by `navToLocations`
directly, so the name alone cannot say whose it is. The middleware records the
rows a `holdFollowAnchor` touches and, where the hold hands back a promise,
treats `navToLocations` on one of those rows as the held navigation's own until
the promise settles. The exact pass's placements are async, so the other
gestures are not exempted: a drag in that moment is the reader's. A search on
any other row takes the anchor. The map stays for the launch's `placeRow`, which
navigates by a locstring the reader wrote, so a synchronous `navToResolvedSpan`
fallback alone would not retire it.

`showRegions` stays held, since only a tail reaches it as a root; so does
`horizontallyFlip`, since a hand flip of a followed row is meant to stand. The
ruler label's region edits are one action, `editDisplayedRegions`, because their
re-centre, the only gesture-named step, is skipped when the edit drops the
region the row was centred on; an edit that only reverses or reorders the row's
regions is its Reverse region, and stands as the flip does. The view-wide zooms
(`squareView`, `showAllRegionsAcrossRows`, the stack's rubber-band "Zoom to
region(s)") nest the rows' zooms under the stack's own actions, and
`centerStackOnFeature` holds its two navigations the same way and hands the
anchor to the first row that moved, the feature's own unless its `navTo` threw.

**The set is a list of names, so a contract test holds it against the view.**
Every navigation-shaped action the row actually has must be in `ROW_GESTURES` or
`ROW_NAVIGATIONS_HELD`; one in neither is a gesture the follow would silently
undo, or a tail it would silently take on.

**Nothing in the middleware may register as a dependency.** It also sees the
follow's own root actions, some dispatched from inside its autoruns, so its
reads are `untracked`. A row showing nothing yet takes nothing: `appendRow`
builds an LGV whose own init navigates it as a root action, and that places the
row rather than the anchor. `gestureTakesAnchor.integration.test.ts` holds all
of this on a real stack; the unit harness's rows are not the host's children and
see no middleware, which is what lets it still test the exact pass re-asserting
over a row something other than a gesture moved.

## That convergence is load-bearing, and nothing else damps it

`alreadyShowing` saying no means navigate, and navigating wakes the pass that
asked. So **anything it can never say yes to is an infinite loop**, not a
misplacement — one core at 90%, and jest's own timeout does not fire because the
loop starves the timer queue.

The loudest way in is **a navigation that replaces `displayedRegions`** whether
or not the row moved, which invalidates `followPairs`, the first thing the exact
pass reads. `navToResolvedSpan` takes `navTo` first, which moves inside the
row's existing regions, so a navigation that does not move the row wakes
nothing. It is not the only way in: the exact pass reads the moving row on
purpose, so any placement it disagrees with wakes it again. The backstop
therefore stays load-bearing: asking for the same span **from the same observed
window** twice cannot be a real disagreement, so `execute` refuses the second.
Arriving clears the record, which keeps a hand-nudged row navigable back to
exactly the span it was nudged off.

**A navigation that REJECTED keeps its record too, deliberately.** A
`navToLocString` that replaces `displayedRegions` and then throws would wake the
pass and be retried on every wake, the unbounded loop again. The cost is a level
that will not retry that exact from→to pair until something moves, which the
next settle supplies: one delayed placement against a spun core.

That backstop bounds the shape; the two checks below close the two ways in.

A view cannot show a span below `minBpPerPx * width`; it centres and widens it.
So the row reports back a window the answer merely sits inside, which on the
numbers is not "already there". `alreadyShowing` takes that floor and accepts
**containment** within it — not a predicted window, since navTo also clamps to
the displayed regions near a contig end.

And a **zero-width answer is not a place at all**: the caller holds and lights
`followReport.unaligned`. Holding means **dropping the level's pick as well**,
or the frame pass goes on placing a row this branch decided to hold, on a
transform measured over a window it has left. A CIGAR walk clamps the window to
its block before walking, so a block whose axes are not what the plan thought
brings both ends back on one coordinate — which is what a swapped-assembly track
does, and it is a config someone can legitimately write. Widening one would
fling the row to base-level zoom on a coordinate the arithmetic never
identified.

A collapse has to be **reported rather than rounded away** for that check to see
it, so `interpolateFollowSpan` returns the collapse and only widens a real span.
`navToResolvedSpan` clamps before assembling a locstring and
`positionViewOnSpan` refuses a zero-width span; `followWindowMapping`'s
`hi > lo` gate rejects a collapse before any rounding.

A frame-pass span off the row's displayed regions is not an error — the row is
showing another contig and the exact pass is on its way to navigate it.

## The follow can only reach contigs the moving row already displays

A limit to know, because it silently weakens any test written without it. The
synteny fetch keeps a block only when **both** ends are in view, so a row parked
on one contig is only ever sent alignments already pointing at it.

**So the follow must never narrow the row's own region set**, or the limit
becomes self-inflicted and permanent: a `navToLocString` resolving to a single
location replaces `displayedRegions` wholesale, collapsing a whole-genome row
onto whichever contig the answer landed on, and every later pan reports "nothing
aligns here" for a region set the follow itself threw away. `navToResolvedSpan`
takes `navTo` first for that reason and falls back only for a span the row
genuinely cannot reach. A placement that replaces regions is the thing to look
at first if this comes back.

## Every refName the follow reads is canonical, made so in two places

Nothing here canonicalizes; every comparison assumes both operands already
agree. They do because both channels are renamed first — `featureData`'s
`refNameDict`/`mateRefNameDict` in the fetch's `run`, and `ResolvedSpan.refName`
on receipt in `resolveMatchingSpan`.

**A change that canonicalizes only one of them is worse than one that
canonicalizes neither** — `alreadyShowing` would compare canonical against
adapter-space, never match, and renavigate on every wake.
`LinearSyntenyRefNameAlias.test.tsx` fails if either half goes. Both directions
are live, so neither rename is redundant.

Each channel resolves **per axis**, and the two resolvers are only
distinguishable by that file's third fixture — the query-axis ones cannot see a
swap, because the assembly they would swap in declares no aliases.
`agent-docs/reference/REFNAME_NAMESPACES.md` has the per-site table.

## Approximate is a state the UI reports, not a failure

Three things force an interpolation over a CIGAR walk: an envelope, a tier with
no CIGAR (a PIF's coarse tier), and a file mixing them so the per-_fetch_
`hasCigar` is true while this block has none. The click-driven move refuses; the
follow must not, or the mode would work zoomed in and silently stop in the
whole-genome view where it is most useful.

The flag is written from **both halves of the exact pass** — the plan sees the
first two cases, the third is only knowable once the walk comes back empty. Only
the prefix lowers it; a promotion that could also lower would race the plan's
reset and flicker.

`followReport.unaligned` is the different answer: nothing covers the window, so
the rows hold. Without the flag a held row and a dead follow look identical.

## Orientation is matched once per decision, and only when opted in

`followMatchOrientation` (off by default) lets the exact pass turn the moving
row round so it pans the same way as the anchor: inside one alignment by that
block's strand, wider than one by `followReverseShare`'s overlap-weighted vote
and only past `NEARLY_ALL` (90%) either way. A mixed window decides nothing —
the crossing ribbons are the picture of a rearrangement, and flipping would hide
half of it. Rung 3 carries no strand and never flips.

**The vote is over the contig the row is PLACED ON**, `followAxes`' insistence
applied to a third scan: rung 2 reaches several of the mate's contigs and puts
the row on exactly one of them, so forward blocks to a contig it is not on would
dilute below `NEARLY_ALL` a row whose own contig is inverted throughout.

It stays a **separate settle-only scan**, not folded into
`followWindowsMapping`'s loop, which visits the same blocks: the two run on
different clocks, so the fold moves work from the rare caller into the per-frame
one — costed at +15ms/s to save 7ms/s and declined.

**Applied once per key, not once per settle.** `orientedKey` is whatever placed
the row — the block id, or the contig the envelope answered on — the wanted
orientation, and the staying row's orientation, the anchor's one level out; the
same key does not flip again. That is what lets a reader flip a followed row by
hand without the row's Flip item taking the anchor: their flip disagrees with
the key's answer and stands until the decision changes. The wanted state is
relative — a reversed anchor inside an inverted block wants a forward mate.

**The checkbox is read in `planLevel`, unconditionally, or it is not a
dependency of the pass at all.** `orient` runs past the autorun's first `await`
_and_ inside its `untracked`, so a flag read there wakes nothing. The key is
**dropped while the mode is off**, so switching it back on re-asserts over a row
turned round by hand in the meantime.

**It orients AFTER the navigation, which can undo it.** The fallback in
`navToResolvedSpan` replaces `displayedRegions` from a bare locstring, which
names no orientation, so a row flipped first would land the wrong way round with
the decision already recorded against it. The re-guard after that `await` is the
ordinary latest-wins one; the pass that supersedes this one orients instead, and
the backstop's no-await path is what terminates it.

**Orientation is a fact about the ROW, so it is read off
`displayedRegionsOrientation` and not off the leftmost block.**
`horizontallyFlip` reverses every region at once, so the only orientation it can
answer is the row-wide one. A row with a single region reversed has none —
`mixed` — and both sides decline on `mixed` without recording the key, the
policy a mixed window already gets; read off blocks, it reported whichever
region the window was over, and the follow turned every OTHER region round to
agree.

`horizontallyFlip` replaces `displayedRegions` and so wakes the pass; the bp
window is unchanged, the replan carries the same key, and `alreadyShowing`
compares bp, so it converges in one wake. The frame pass reads nothing of this:
`spanBounds` already min/maxes offsets over a reversed row.

## Block coordinates are `start <= end`, with direction in `strands`

A block is never negative-width. `followWindowMapping` interpolates, so it needs
no zero-clamp; `applyFollowTransform` **extrapolates** and clamps — before the
`hi > lo` test, so a wholly-negative answer becomes no answer (hold the row)
rather than an inverted span.

Which axis of a block is which is `followAxes`, in one place because
`planFollowStep` picks a block with `pickFollowFeature` and then maps the same
window with `followWindowMapping`: a block in scope for one and not the other is
a plan whose two halves are about different data.

A frame-pass span carries **fractional** bp, where every other `ResolvedSpan`
here is whole. Rounding the cached transform quantizes the row's motion to whole
bases, visible below 1 bp/px — so it feeds `positionViewOnSpan`, which is pixel
arithmetic, and never `navToResolvedSpan`.

## `levelStates` is keyed by the level node

Keyed by index, an entry outlives a removed level and a re-added row inherits a
dead level's incumbent feature id and cached transform. A `WeakMap` on the node
is also the entire pruning story.

The store hands out two things on purpose: `get` and `facing` mint state, `peek`
does not. The frame pass steers by the exact pass's pick and must not mint one;
the only state it writes is the spread decision it makes for an undecided level
and the spread targets it placed by.

`lastErrorMessage` lives there too, per level rather than per view: a follow
that cannot resolve says so once, and a view-wide slot would let a level that
resolves fine clear it every pass while the broken one reported itself again.
`notifyError` always attaches a `report` action, which makes it bypass the
snackbar model's own message dedup, so nothing downstream absorbs the repeats.

## Navigating a followed row from elsewhere in the view takes the anchor

The exact pass re-asserts the follow over any row that moved, and the gesture
middleware above only knows a gesture from its action name — so anything that
navigates a row the follow MOVES has to take the anchor as well, explicitly and
onto the right row, or it changes nothing and says it did.
`showOffscreenMateContig` does, and its undo puts the anchor back with the
regions, because the anchor is a persisted view-wide setting rather than an
implementation detail of the navigation.
`LinearSyntenyOffscreenMateFollow.test.tsx` holds it, on a PAF and both clocks —
a model-level test cannot see it, since with no alignments there is nothing to
re-assert.

**Three call sites, each opening with `beginStackMove`, and a move anchors the
row it does NOT navigate.** The band's two items and the LGV display's "move
other panel": a mark anchors the row it sends somewhere, a move anchors the row
it leaves alone, because that is what the label promises — this one stays, the
others come to it. `LinearSyntenyMoveFollow.test.tsx` measures the untaken case
as row 1 pulled 998bp by a later pan of row 0, the half a model-level test
cannot reach. `bandMoveTargets` carries the staying row's index rather than
letting the item re-derive it from `toMate` and the level — that is the only
thing the two items differ in, and a second spelling of it is how the item and
the action come to disagree.

**A take is not earned until the navigation lands, so `movePanelsToSpan` gives
it back when nothing moved.** Not only the throwing case: `navToLocString`
resolves WITHOUT navigating when the contig is not a refName here and the text
search raises a picker over the hits instead — ordinary for a PAF naming contigs
`1`,`2` against an assembly spelling them `chr1`,`chr2`. The moves offer no undo
for a navigation that stayed inside the row's own regions, since nothing was
discarded; only for the fallback that replaced them, and for the take itself,
which moved rows the click never named.
