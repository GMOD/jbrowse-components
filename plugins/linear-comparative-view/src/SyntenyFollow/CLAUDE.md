# SyntenyFollow

The continuous form of "Move bottom panel to the matching region": that item
resolves one alignment on a click, this resolves whichever alignment is under
the anchor row's window, every time the anchor moves, for every other row. It
maps the anchor's visible **window**, not a midpoint, which is also what makes
the moved row match the anchor's _scale_.

Nearly all of this is about placement happening **twice, on two clocks**.

## Two passes, because the exact answer costs an RPC

A CIGAR walk happens in the worker, so the **exact pass** can only ask once the
anchor settles, reading the debounced `coarseDynamicBlocks`. On its own the row
sits still through the drag and jumps half a second after the user stops. So a
**frame pass** on live `dynamicBlocks.contentBlocks` does everything except the
RPC. Exact supplies correctness, frame supplies motion.

**The frame pass replans; it does not extrapolate the last exact answer.** That
was tried and snaps 43% of a screen when the settle lands, because "the answer"
is two functions: affine inside a single alignment (`FollowTransform`), and an
**envelope** once the window is wider than any one alignment, which is not
affine in the window. So the affine shortcut is taken only where affine is true,
and the cached transform may only be built from a **single-block** answer — an
envelope carries no one strand, and a forward transform derived from one mirrors
the row inside an inverted alignment.

## The map is what makes the two clocks agree

Inside one block the frame pass reads a **`CigarMap`** — the block's CIGAR
reduced in the worker to a few thousand bend points, two `Uint32Array`s of
offsets, one `SyntenyGetCigarMap` per block. `applyFollowTransform` stays as the
fallback beneath it and `interpolateFollowSpan` beneath that, so the three
answers run best-first in `followFrameSpan`.

Affine was never right here, only cheap. A straight line fitted at the last
settle drifts by whatever indels lie between that window and the one the user
panned to, and the settle corrects it visibly — 15.5bp over a 200px pan on
`volvox_inv_indels`, growing with the distance, and it is _worst_ in the case
the mode was built for, a human pair where one block runs for tens of Mb and
navigating means navigating inside its CIGAR. With the map the settle finds the
row already there, `alreadyShowing` says yes, and nothing navigates.

**Asked for on an envelope settle too.** The envelope reads no map, but the pick
is the widest block under the window and a zoom into it mid-drag is placed by
the affine fit until the next settle unless the map is already in hand.

**Once per BLOCK, where the resolve is once per window.** That is the whole
difference between the two RPCs and why both exist: the resolve answers _this_
window and says nothing about the next, the map answers every window inside the
block. Re-asking per settle is the shape this exists to get out of, and at a
higher price — the map walks the whole CIGAR where a resolve walks two offsets
into it. `LevelCigarMap` therefore outlives the pick, and a MISS is recorded
too, or a CIGAR-less block is asked about every settle forever.

**A map is refused unless it names this block**, by feature id in `mapFor` and
by the block's own coordinates in `cigarMapSpan`. Both: ids are only comparable
within one LOD tier, and an all-vs-all file has several rows over one extent.

**And a map request carries the store's own stop token**, so dropping the store
stops the work and not merely the answer. The request re-reads the whole region
out of the file, once per block, so a drag across a chromosome left one grinding
per block crossed and closing the view left them all. The token is scoped to the
generation rather than rotated per call, because the map rejects latest-wins — a
later window inside the same block still wants the map already in flight for it,
which is exactly what a rotation would cancel.

**The row's scale is no longer constant through a pan, and that is the fix, not
a side effect.** A 1001bp anchor window matches 1017bp of the target here and
982bp four steps later, because a deletion came into view — so `offsetPx`, a
position at the row's current `bpPerPx`, can move backwards over a step the row
moved forwards through. Assert a follow's motion in **bp**; the test that used
`offsetPx` was measuring the affine fit's held scale.

The map is not the whole answer and must not be made into one. The exact pass
still navigates — a matching region on another contig is a `navTo`, which the
frame pass may not do — and a block with no CIGAR has no map at all.

## Three rungs, coarsening as the anchor's window widens

1. **Inside one alignment** — the CIGAR walk, exact.
2. **Wider than one alignment, inside one contig** — `followWindowMapping`'s
   envelope, approximate.
3. **Wider than one contig** — `followSpreadSpans`, the union of what each
   visible contig maps to, placed as an interval of the moving row's own layout.

Rung 3 is what makes a **whole-genome overview a place a row can be**. Without
it `followAnchorWindow` kept the anchor's widest contig and threw the other
eighteen away, and one `ResolvedSpan` names one contig — so "show all regions"
left the anchor showing everything and sent every row below it to whichever
single chromosome aligned to that widest one. Reported on grape/peach/cacao, and
it is not specific to that command: any overview did it.

**Rung 2's target contig is a vote, and the vote carries the block pick's
margin.** A window wider than one alignment reaches several of the mate's
contigs, and `followWindowsMapping` picks the one most of the window aligns to.
A fusion is the case that breaks a bare comparison: the anchor's contig is two
of the mate's laid end to end, so panning across the join moves summed overlap
from one to the other and the two are equal at the join itself — the answer
flipped chromosome on the rounding, every frame, since `followFrameSpan` re-runs
this mapping per frame once the window is past its block. `preferIncumbent`
holds it at the same 1.5x used for the block. The incumbent is
`LevelPick.target`, where the last settle placed the row, so it dies with the
pick — a rung-3 pass or a held row clears it and the next window chooses freely
— and an incumbent no block under the window reaches totals zero, so it cannot
hold the answer on the bias alone.

## The third rung is offered, not taken automatically

**A union is refused when it is mostly filler.** `positionViewOnSpans` places an
interval, and a row lays its regions end to end, so two answers that are not
neighbours in the moving row's layout put every contig between them on screen —
measured on grape/peach/cacao at **13.9Mb of answer inside a 137.6Mb row**, two
whole chromosomes of which nothing reaches. `decideSpread` measures that as
coverage against the very bounds `positionViewOnSpans` will use, and under half
the row hands the level back to the rung below, on the widest window by pixel.

**Demotion, not trimming.** Dropping the smaller span and re-placing was the
obvious spelling and is a new placement mode with none of the machinery: falling
through to rung 2 inherits the block pick, the CIGAR map, the settled resolve,
`alreadyShowing` and the hysteresis. It also **removes a cliff** — a tail at
4.9% of the widest window is placed by that rung today and at 5.1% teleported
into a union ten times the size — where a trim would add one.

**Coverage cannot decide this alone, and that is measured too.** An honest
whole-genome overview on the same data covers **26–40%** of what it places,
below anything that would catch the straddle above. What separates them is
structural: an overview's windows are WHOLE contigs, a straddle's are cut on
both sides of a junction, so `partialShare` gates the coverage test and the
overview never reaches it. The tolerance in that test is load-bearing — block
edges come off pixels, so five of eight contigs on a `showAllRegions` panel
report an end a hair short of their region's, and without it the gate opens on
the case it exists to exempt.

**A carried spread is never re-judged.** Its windows are spans, partial by
construction, so the gate would open on every one — and the second row of an
honest overview would demote, then the third. The level that decided it already
judged it.

**The decision is the settle's, and the frame pass follows it.** The rung's
_answer_ is still recomputed per frame; whether to take the rung is not. These
are the two furthest-apart placements this subsystem can produce, and a
per-frame re-decision flips between them across a threshold the user is panning
along. `FollowLevelState.spread` carries it, with a band on the way back up and
`preferIncumbent` on the window kept — 100% against 49% of the panel is one pan
from a coin toss.

**And it is measured over a window set, so it dies with one.** `planSpread` runs
only past two windows, so below that nothing rewrites the decision and a refusal
outlives the anchor zooming into one contig: `followPartial` went on naming a
region the anchor no longer spans, ahead of `approximate` in
`followToggleTitle`, which is to say it was the sentence the reader got.
`planLevel` clears the decision where the rung is out of reach, which drops the
stale incumbent and the hysteresis band with it — the band is for a user panning
along the threshold, and a single-contig window set in between is not that pan.

**The frame pass follows the DECISION, not the contig it names.** Half a second
of drag can carry the kept contig off screen, and the `find` for it then missed
and the row stopped following for the rest of the drag. It falls through to the
widest window — which is what the settle keeps too, since `decideSpread` picks
`onto` by pixel and an incumbent no window reaches cannot hold it — so the
decision is still the settle's and only the window carrying it out is current.

**`partial` is the third field of the header's `FollowReport`**, on the terms
the other two keep: written in `planLevel`, read only by the header. A row that
is not showing everything the anchor aligns to has to say so, or the demotion is
a silent loss. It carries **both region names, not a boolean**, and that is what
makes the refused answer reachable: scrolling the anchor onto the other region
makes it the widest window, so the rows follow it — an ordinary navigation of
the row the reader is already driving, needing no button, no anchor take and no
undo. The only thing they cannot do is guess the region is there. A control that
navigated for them would be one, since it would move a row the follow moves and
owe the whole `showOffscreenMateContig` dance. `followDebug` prints the whole
decision per settle under `localStorage.debugSyntenyFollow`, and
`browser-tests/follow-spread-probe.ts` drives a live session with it.

**Both halves of that sentence are only true while the panel it describes is on
screen.** `FollowLevelState.spread` is written by this rung alone, so a reader
who takes the advice leaves a panel the rung does not reach — and the report,
read unconditionally, went on naming the contig they had left and telling them
to scroll onto the one they were now on. `planLevel` clears the decision when
the anchor is down to one window. The contigs it offers are the ones
`followSpreadSpans` actually MAPPED, too: a contig with no alignment in the file
answers nothing, so scrolling onto it shows nothing.

**Every visible contig is asked, not the two outer edges.** Mapping the leftmost
and rightmost visible bp is the obvious cheaper spelling and is wrong whenever
the two assemblies order their contigs differently — which the multiway demo
deliberately does, to minimize ribbon crossing. The anchor's first contig then
maps to the mate's _last_ region and the interval between the two edges runs
backwards over a slice of the row.

**One scan of the blocks, not one per contig.** `followWindowsMapping` takes the
windows as a list for that reason: the per-frame cost is the block loop, and a
whole-genome anchor has as many contigs as the assembly does.
`followAnchorWindows` drops sub-pixel contigs and caps the list, so a
scaffold-level assembly cannot turn one pass into thousands.

It is still a **whole scan per frame**, where rung 2's frame pass is one cached
block and an affine step — and the zoom this rung runs at is the one with the
most blocks in hand (5ms per bare pass at 500k, per display, per level). Nothing
cheaper is available without indexing the blocks by contig, since the window
edges move every frame and the answer moves with them. First thing to measure if
dragging an overview on a whole-genome PAF reads as slow.

**A sliver beside a full panel is not a contig the panel is showing.** The COUNT
of windows selects the rung, so on the sub-pixel floor alone a 2px tail of the
contig being scrolled off counted the same as the 798px one filling the panel —
and since rung 3's answer spans everything its windows map to, that tail's mate
a genome away doubled the moving row's `bpPerPx` mid-drag. Measured at 151 bp/px
against rung 2's 75 on a permuted pair. `MIN_SHARE_OF_WIDEST` drops it, and is
relative to the WIDEST window rather than to the panel for a reason worth
keeping: a two-contig assembly is legitimately lopsided — volvox is 89% ctgA —
so a share-of-panel floor would have called an overview of it a straddle and put
`installSyntenyFollow`'s whole-genome tests back on rung 2.

The cliff is inherent, not tuned away: a union of spans jumps whenever a contig
joins or leaves it, by however far that contig's mate is from the rest. What the
floor buys is that the jump happens when the contig is a twentieth of the widest
one on screen — something the reader can see — rather than at one pixel.

**The answer is an interval of the MOVING row's layout, so it is not a
`ResolvedSpan`.** `positionViewOnSpans` takes the min and max of the mapped
spans in that row's offset space, which is why rung 3 places with `moveTo` and
never with a locstring — a locstring names one contig and `navToLocString` would
collapse the row onto it. The fallback for a row that has no region for any of
the answer is the one navigation this rung makes, guarded by `lastNav`, and it
can only reach a single contig: the follow may not widen a row's region set any
more than it may narrow one.

**Rung 3 drops the level's pick.** No one block places the row, and the frame
pass steers by the last pick — left standing, it went on placing the row through
an alignment this rung has decided does not describe the window. The frame pass
recomputes rung 3 itself rather than steering by anything cached, which it can
because the rung chooses no block, holds no strand and needs no transform.

**Rung 3 reads the moving row like the rung below does**, so a hand zoom
re-asserts on the next coarse-block debounce. It used not to, and relied on the
level's fetch being keyed on both rows' windows — the hand zoom refetched, the
new `featureData` woke the pass — measured at ~1s on `volvox_contig_swap`. The
read costs one re-entry per placement, which converges: re-placing writes the
same numbers, `setCoarseDynamicBlocks` compares block keys and does not assign
an equivalent array, and no RPC is involved.

The overview is a fixed point only **up to the unaligned flanks**: the union
starts at the first block's mate edge, so a row with unaligned ends settles a
hair inside its full extent, once, and stays. It reports itself as
`followApproximate`, which it is.

## Ordering is outward from the anchor, not by level index

An alignment relates one pair of rows, so the follow propagates one level at a
time and an interior row is both an output and an input. `followPairs` sorts by
`followDirection`'s `distance`, not `level.level`; the two coincide only when
the anchor is the top row.

**An interior row is read as the answer it was PLACED ON, never as what it ends
up showing.** `PlacedWindows` carries that answer across the pass, and the two
differ only at rung 3 — where placing a row on chr1 and chr9 also puts
chr2..chr8 on its screen, because a row lays its regions end to end and no
placement can decline the filler. Read back off the blocks that filler is a
window like any other: the same size as the two that mapped, so
`MIN_SHARE_OF_WIDEST` keeps every one, and each maps somewhere of its own at the
next level. The union there widens to reach those, the level beyond inherits the
wider set, and it compounds — a two-contig answer left the far row of a
three-row stack on the whole genome. `installSyntenyFollow.test.ts` measures it
as nine chromosomes against the three the carry keeps.

The carry is **not filtered against what the moving row can show**,
deliberately: the fetch keeps a block only when both ends are in view, so a
carried window on a contig the row is not displaying has nothing loaded under it
and maps to nothing. And a carried row's blocks are not read AT ALL, which is
the frame pass's own untracked-read rule arrived at from the other side — what
re-asserts a hand-nudged interior row is the level's fetch key, which names both
rows, exactly as it is for rung 3's moving row.

The mechanism, stated without the genomics:
`agent-docs/mechanisms/carry-the-decision-not-the-rendered-state.md`.

## `planLevel` is the only place observables are read

`execute` is `async` and MobX stops tracking at the first `await`.
**`FollowStep` is that boundary, not a convenience struct** — a field missing
from it can only be read untracked, producing a follow that works once and never
re-fires.

It cuts the other way too, which is why the resolves are kicked off inside
`untracked`. `execute` still runs synchronously up to its own first `await`, and
down that path `resolveMatchingSpan` reads the display's `lodTier` — derived
from both connected views' **raw `bpPerPx`**, which the frame pass writes every
frame. Tracked, one settled resolve made the moving row's zoom a dependency of
the debounced pass.

Same rule: `FollowLevelState` is a plain object, not MST or a MobX box, since
the exact pass writes it every pass. And the `FollowReport` (`unaligned`,
`approximate`, `noSyntenyTrack`, `partial`) is **written here and read only by
the header**, through one merging setter; a new flag goes on the report, not
beside it.

**Which rung a level is on is `followRung`, read by both clocks.** The exact
pass decides whether to spread; the frame pass follows that decision, and the
one function turns the windows and the decision into the rung so the two cannot
be spelled differently. And a refusal lands **on a contig that answered**: the
widest window regardless was, on a panel half filled by an unaligned contig, a
level with nothing to place from — every row held, and the header said nothing
aligned while `elsewhere` named two contigs that did.

## `seq` is bumped per PASS, not per resolve

Latest-wins over an unordered RPC, and the level that bumps it is every level
the pass _visits_ — including one that found nothing. That pass has decided the
row holds and lit `followUnaligned`; bumping only for levels with something to
resolve let the previous window's answer land underneath that and move the row
anyway.

Switching the mode off issues no pass at all, so it still needs its own check in
`execute` — and switching it back on defeats that check, since dropping the
store leaves an in-flight `execute` holding a state object nobody will bump
again. `levelStates` therefore counts its own resets and the plan carries the
count: the one fact `seq` cannot state is that the store an answer was planned
against no longer exists. The count is what a resolve is DISCARDED by; the token
beside it is what the map is STOPPED by, and the two are different questions
because a resolve is shared by three re-entrant passes that still want it.

## What each pass may touch

- The exact pass **navigates** (`navToResolvedSpan`), necessary since the
  matching region can be on another contig.
- The frame pass **positions** (`positionViewOnSpan` → the free
  `Base1DUtils.moveTo`, not the view action) and must not navigate — sixty times
  a second a navigation flushes the row's coarse blocks, i.e. an RPC per frame.
- The frame pass reads each level's **staying** row and never its moving row.
  With the outward ordering, an interior row is written before the level beyond
  it reads it — but it is read **untracked** once this run has written it.
  Ordering settles the value; the dependency is separate, and registering one on
  a row the same run just wrote re-ran the whole pass. Measured at exactly 2.00
  runs per pan step on three rows anchored at the top, against 1.00 for two rows
  and 1.00 for three anchored in the middle, where the pass writes outward both
  ways and reads neither. A row this pass did **not** write stays tracked, since
  then its window is a real input.

The exact pass reads the moving row on purpose (`alreadyShowing`), inverting
that rule: the dependency is what re-asserts the follow over a row the user
nudged by hand. It therefore re-enters on its own navigation — one settle wakes
it three times, and two things make that converge: `alreadyShowing` compares
against where the row actually is, with a tolerance; and the per-level answer
promise is shared by key, so all three ride one `SyntenyResolveMatchingRegion`.
The integration suite asserts that count.

## A gesture on a followed row takes the anchor

The rows follow whichever row the reader is driving, which is the symmetry the
pixel lock already has. The exact pass re-asserts the follow over any row that
moved, and it cannot tell a drag from a navigation some feature made; the
snackbar that used to explain the snap-back offered "Anchor this row" one drag
too late, and the heuristic behind it (`handNudged`, gone) had a documented
false positive it could not test for.

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
otherwise take the anchor straight back. Neither `showRegions` nor
`navToLocations` is in the set, since `navToLocString` reaches for them after an
await, as fresh roots, on the follow's own behalf; nor `horizontallyFlip`, since
a hand flip of a followed row is meant to stand. The view-wide zooms
(`squareView`, `showAllRegionsAcrossRows`) are the stack's own actions and nest
the rows' zooms under them.

**Nothing in the middleware may register as a dependency.** It also sees the
follow's own root actions, some dispatched from inside its autoruns, so its
reads are `untracked`. `gestureTakesAnchor.integration.test.ts` holds all of
this on a real stack; the unit harness's rows are not the host's children and
see no middleware, which is what lets it still test the exact pass re-asserting
over a row something other than a gesture moved.

## That convergence is load-bearing, and nothing else damps it

`alreadyShowing` saying no means navigate, and navigating wakes the pass that
asked. So **anything it can never say yes to is an infinite loop**, not a
misplacement — one core at 90%, and jest's own timeout does not fire because the
loop starves the timer queue.

The wake was **`navToLocString` replacing `displayedRegions`**, which it did
whether or not the row moved; that invalidates `followPairs`, which is the first
thing the exact pass reads. Measured across fourteen consecutive passes on the
swapped track: coarse blocks, `featureData` and width all stable, the pass
re-entering on nothing but its own navigation. `navToResolvedSpan` takes `navTo`
first now, which moves inside the row's existing regions and so does not replace
them — a navigation that does not move the row no longer wakes anything, and the
fourteen-pass shape needs the fallback to reach it. It is still only the loudest
way in, not the only one: the exact pass reads the moving row on purpose, so any
placement it disagrees with wakes it again. The backstop therefore stays, and
stays load-bearing: asking for the same span **from the same observed window**
twice cannot be a real disagreement — the first attempt already had its chance
and the row still reports where it was — so `execute` refuses the second.
Arriving clears the record, which is what keeps a hand-nudged row navigable back
to exactly the span it was nudged off.

**A navigation that REJECTED keeps its record too, deliberately.** By the
backstop's own wording it never had its chance, so clearing it reads like the
correction — but a `navToLocString` that replaces `displayedRegions` and then
throws would wake the pass and be retried on every wake, which is the unbounded
loop again. The cost of leaving it is a level that will not retry that exact
from→to pair until something moves, which the next settle supplies. Weighed and
left alone: the failure it prevents is a spun core, the failure it causes is one
delayed placement.

That backstop bounds the shape; the two checks below close the two ways in.

A view cannot show a span below `minBpPerPx * width`; it centres and widens it.
So the row reports back a window the answer merely sits inside, which on the
numbers is not "already there". `alreadyShowing` takes that floor and accepts
**containment** within it — not a predicted window, since navTo also clamps to
the displayed regions near a contig end.

And a **zero-width answer is not a place at all**: the caller holds and lights
`followUnaligned`. Holding means **dropping the level's pick as well** — the
frame pass steers by whatever the last settle chose, so leaving the last good
one standing kept placing a row this branch had decided to hold, on a transform
measured over a window it had left, which nothing corrects while the answers go
on collapsing. A CIGAR walk clamps the window to its block before walking, so a
block whose axes are not what the plan thought brings both ends back on one
coordinate — which is what a swapped-assembly track does, and it is a config
someone can legitimately write. Widening one would fling the row to base-level
zoom on a coordinate the arithmetic never identified.

The two are separate holes, and a collapse has to be **reported rather than
rounded away** for the second to close. `interpolateFollowSpan` used to widen a
degenerate answer to one base, which cleared the zero-width check and flung the
row exactly as above; it now returns the collapse and only widens a real span.
The inverted-locstring case that clamp was written for is covered where it
matters anyway — `navToResolvedSpan` clamps before assembling one, and
`positionViewOnSpan` refuses a zero-width span. `followWindowMapping` never had
the problem: its `hi > lo` gate rejects a collapse before the rounding.

A frame-pass span off the row's displayed regions is not an error — the row is
showing another contig and the exact pass is on its way to navigate it.

## The follow can only reach contigs the moving row already displays

A limit to know, because it silently weakens any test written without it. The
synteny fetch keeps a block only when **both** ends are in view, so a row parked
on one contig is only ever sent alignments already pointing at it.

**So the follow must never narrow the row's own region set**, or the limit
becomes self-inflicted and permanent. It was: `navToLocString` resolving to a
single location replaces `displayedRegions` wholesale, so the first settle
collapsed a whole-genome row onto whichever contig the answer landed on, and
every later pan reported "nothing aligns here" for a region set the follow
itself had thrown away. `navToResolvedSpan` takes `navTo` first for that reason
and falls back only for a span the row genuinely cannot reach. A placement that
replaces regions is the thing to look at first if this comes back.

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

`followUnaligned` is the different answer: nothing covers the window, so the
rows hold. Without the flag a held row and a dead follow look identical.

## Orientation is matched once per decision, and only when opted in

`followMatchOrientation` (off by default) lets the exact pass turn the moving
row round so it pans the same way as the anchor: inside one alignment by that
block's strand, wider than one by `followReverseShare`'s overlap-weighted vote
and only past `NEARLY_ALL` (90%) either way. A mixed window decides nothing —
the crossing ribbons are the picture of a rearrangement, and flipping would hide
half of it. Rung 3 carries no strand and never flips.

**The vote is over the contig the row is PLACED ON**, which is `followAxes`'
same insistence applied to a third scan: rung 2 reaches several of the mate's
contigs and puts the row on exactly one of them, so a share taken across all of
them describes a picture the reader is not looking at. A row placed on a contig
every block of which is inverted stayed forward, because forward blocks to a
contig it was not on diluted the vote below `NEARLY_ALL`.

It stays a **separate settle-only scan** and is not folded into
`followWindowsMapping`'s loop, which now visits the same blocks and computes the
same overlap. The two run on different clocks, so the fold moves work from the
rare caller into the per-frame one — costed at +15ms/s to save 7ms/s in
`agent-docs/reference/REJECTED_IDEAS.md`, along with why a `mixed` anchor is
declined rather than resolved to one of its regions.

**Applied once per key, not once per settle.** `orientedKey` is whatever placed
the row — the block id, or the contig the envelope answered on — the wanted
orientation, and the anchor's own orientation; the same key does not flip again.
That is what lets a reader flip a followed row by hand without the row's Flip
item taking the anchor: their flip disagrees with the key's answer and stands
until the decision changes. The wanted state is relative — a reversed anchor
inside an inverted block wants a forward mate.

**The checkbox is read in `planLevel`, unconditionally, or it is not a
dependency of the pass at all.** `orient` runs past the autorun's first `await`
_and_ inside its `untracked`, so a flag read there wakes nothing: ticking "flip
rows to match the anchor" did nothing at all until whatever the reader did next
moved the anchor. And the key is **dropped while the mode is off**, so switching
it back on re-asserts — kept, a row turned round by hand with the mode off sat
wrong-way-up under a mode that was on.

**It orients AFTER the navigation, which can undo it.** `navToResolvedSpan`
falls back to `navToLocString` for a span on a contig the row is not displaying,
and a bare locstring names no orientation, so the `displayedRegions` it replaces
are forward whatever the row was. Flipped first, the row landed the wrong way
round with the decision already recorded against it and nothing re-asserted
until the anchor left the block. The re-guard after that `await` is the ordinary
latest-wins one; the pass that supersedes this one orients instead, and the
backstop's no-await path is what terminates it.

**Orientation is a fact about the ROW, so it is read off
`displayedRegionsOrientation` and not off the leftmost block.**
`horizontallyFlip` reverses every region at once, so the only orientation it can
answer is the row-wide one. A row someone reversed a single region of has none —
`mixed` — and read off blocks it reported whichever region the window was over,
so the follow turned every OTHER region round to agree with it. Both sides
declining on `mixed`, without recording the key, is the same policy the mixed
window already gets.

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

Keyed by index, an entry outlived a removed level and a re-added row inherited a
dead level's incumbent feature id and cached transform. A `WeakMap` on the node
is also the entire pruning story.

The store hands out two things on purpose: `get` mints state, `pickFor` does
not. Only the exact pass decides anything, so the frame pass reading through
`get` would mint an entry for a level that pass has never reached.

`lastErrorMessage` lives there too, per level rather than per view — a follow
that cannot resolve cannot resolve repeatedly, so it says so once, and a single
view-wide slot let a level that resolves fine clear it every pass while the
broken one reported itself again behind it. `notifyError` always attaches a
`report` action, which is exactly what makes it bypass the snackbar model's own
message dedup, so nothing downstream absorbs the repeats.

## Navigating a followed row from elsewhere in the view takes the anchor

The exact pass re-asserts the follow over any row that moved, and the gesture
middleware above only knows a gesture from its action name — so anything that
navigates a row the follow MOVES has to take the anchor as well, explicitly and
onto the right row, or it changes nothing and says it did.
`showOffscreenMateContig` is the case that found this: the click ran, posted its
snackbar, and the row came straight back to the anchor's mapping. Its undo puts
the anchor back with the regions, because the anchor is a persisted view-wide
setting rather than an implementation detail of the navigation.
`LinearSyntenyOffscreenMateFollow.test.tsx` holds it, on a PAF and both clocks —
a model-level test cannot see it, since with no alignments there is nothing to
re-assert.

**Three call sites, and a move anchors the row it does NOT navigate.** The
band's two items and the LGV display's "move other panel" take it as well, and
which row is not the same answer a mark gives: a mark anchors the row it sends
somewhere, a move anchors the row it leaves alone, because that is what the
label promises — this one stays, the others come to it. Untaken, "move the top
panel" ran and the follow put the top panel back, while "move the bottom panel"
moved the anchor itself and dragged the top one along.
`LinearSyntenyMoveFollow.test.tsx` measures the second as row 1 pulled 998bp by
a later pan of row 0, which is the half a model-level test cannot reach.
`bandMoveTargets` carries the staying row's index rather than letting the item
re-derive it from `toMate` and the level — that is the only thing the two items
differ in, and a second spelling of it is how the item and the action come to
disagree.

**A take is not earned until the navigation lands, so `movePanelsToSpan` gives
it back when nothing moved.** Not only the throwing case: `navToLocString`
resolves WITHOUT navigating when the contig is not a refName here and the text
search raises a picker over the hits instead — ordinary for a PAF naming contigs
`1`,`2` against an assembly spelling them `chr1`,`chr2` — and counted as a move
it left the follow pointed at a row for a navigation that never happened. The
moves offer no undo for a navigation that stayed inside the row's own regions,
since nothing was discarded; only for the fallback that replaced them, and for
the take itself, which moved rows the click never named.
