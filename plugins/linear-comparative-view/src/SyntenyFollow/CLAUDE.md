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

## Ordering is outward from the anchor, not by level index

An alignment relates one pair of rows, so the follow propagates one level at a
time and an interior row is both an output and an input. `followPairs` sorts by
`followDirection`'s `distance`, not `level.level`; the two coincide only when
the anchor is the top row.

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
the exact pass writes it every pass. And `followUnaligned` / `followApproximate`
are **written here and read only by the header**; a third such flag must keep
that.

## `seq` is bumped per PASS, not per resolve

Latest-wins over an unordered RPC, and the level that bumps it is every level
the pass _visits_ — including one that found nothing. That pass has decided the
row holds and lit `followUnaligned`; bumping only for levels with something to
resolve let the previous window's answer land underneath that and move the row
anyway.

Switching the mode off issues no pass at all, so it still needs its own check in
`execute`.

## What each pass may touch

- The exact pass **navigates** (`navToResolvedSpan`), necessary since the
  matching region can be on another contig.
- The frame pass **positions** (`positionViewOnSpan` → the free
  `Base1DUtils.moveTo`, not the view action) and must not navigate — sixty times
  a second a navigation flushes the row's coarse blocks, i.e. an RPC per frame.
- The frame pass reads each level's **staying** row and never its moving row.
  With the outward ordering, an interior row is written before the level beyond
  it reads it.

The exact pass reads the moving row on purpose (`alreadyShowing`), inverting
that rule: the dependency is what re-asserts the follow over a row the user
nudged by hand. It therefore re-enters on its own navigation — one settle wakes
it three times, and two things make that converge: `alreadyShowing` compares
against where the row actually is, with a tolerance; and the per-level answer
promise is shared by key, so all three ride one `SyntenyResolveMatchingRegion`.
The integration suite asserts that count.

## That convergence is load-bearing, and nothing else damps it

`alreadyShowing` saying no means navigate, and navigating wakes the pass that
asked. So **anything it can never say yes to is an infinite loop**, not a
misplacement — one core at 90%, and jest's own timeout does not fire because the
loop starves the timer queue.

The wake is **`navToLocString` replacing `displayedRegions`**, which it does
whether or not the row moves; that invalidates `followPairs`, which is the first
thing the exact pass reads. Measured across fourteen consecutive passes on the
swapped track: coarse blocks, `featureData` and width all stable, the pass
re-entering on nothing but its own navigation. Nothing outside the follow stops
that, so the follow keeps its own backstop: asking for the same span **from the
same observed window** twice cannot be a real disagreement — the first attempt
already had its chance and the row still reports where it was — so `execute`
refuses the second. Arriving clears the record, which is what keeps a
hand-nudged row navigable back to exactly the span it was nudged off.

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

The two are separate holes. `interpolateFollowSpan` and `followWindowMapping`
clamp their answers up to a base on purpose, so a collapsed interpolation is one
base wide, clears the zero-width check, and needs the floor.

A frame-pass span off the row's displayed regions is not an error — the row is
showing another contig and the exact pass is on its way to navigate it.

## The follow can only reach contigs the moving row already displays

A limit to know, because it silently weakens any test written without it. The
synteny fetch keeps a block only when **both** ends are in view, so a row parked
on one contig is only ever sent alignments already pointing at it.

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
