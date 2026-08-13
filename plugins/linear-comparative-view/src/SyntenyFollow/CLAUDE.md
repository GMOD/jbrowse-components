# SyntenyFollow

The continuous form of the band menu's "Move bottom panel to the matching
region". That item resolves one alignment once, on a click; this resolves
whichever alignment is under the anchor row's window, again every time the
anchor moves, for every other row in the stack.

It maps the anchor's visible **window**, not a midpoint, for the reason
`moveMatchingPanel` gives — and mapping a span rather than a point is also what
makes the moved row match the anchor's _scale_.

Nearly all of this file is about the fact that placement happens **twice**, on
two clocks, and that the two passes are allowed to know different things.

## Two passes, because the exact answer costs an RPC

Walking a CIGAR happens in the worker (`resolveMatchingSpan` says why the main
thread holds no CIGARs), so an exact answer is a round trip and can only be
asked for when the anchor settles. That is the **exact pass**, and it reads
`coarseDynamicBlocks` — the debounced copy — because that is what "settled"
means here.

On its own it produces a bad interaction, and the failure is not the one you
would guess. The row does not lag behind the drag; it sits **completely still**
through the whole drag and then jumps once, half a second after the user stops.
So there is a second **frame pass** on `dynamicBlocks.contentBlocks`, the live
copy, which does everything the exact pass does except the RPC. The exact pass
supplies correctness; the frame pass supplies motion.

## The frame pass replans; it does not extrapolate the last exact answer

The obvious cheap frame pass is to remember the last exact answer and shift it
by however far the anchor has moved since. Tried, and it is worse than it looks
in a test: it tracks a drag perfectly and then snaps **43% of a screen** when
the settle lands.

The reason is that "the answer" is two different functions depending on zoom.
Inside a single alignment it is affine, and extrapolating is fine — that is what
`FollowTransform` is. Once the window is wider than any one alignment the answer
is the **envelope**, a union over every block under the window, and an envelope
is not an affine function of the window: its edges are contributed by different
blocks at different window positions, so panning changes which blocks are in it
and therefore changes the mapping itself.

So the frame pass replans against the live window every time, and only takes the
affine shortcut in the case where affine is actually true.

For the same reason the cached transform may only be built from a
**single-block** answer. An envelope is a union several blocks contributed to,
so it carries no one strand, and a forward transform derived from one placed the
row mirrored inside an inverted alignment until the next settle corrected it.

## Ordering is outward from the anchor, not by level index

An alignment says something about exactly one pair of rows, so a three-row stack
cannot map row 2 onto row 0 directly — the follow propagates one level at a
time. That makes an interior row both an output (of the nearer level) and an
input (of the farther one), and a pass that visits levels in the wrong order
reads a row it has not written yet and settles a level late.

`followPairs` therefore sorts by `followDirection`'s `distance`, not by
`level.level`. The two coincide only when the anchor is the top row, which is
why anchoring the top row hid this and anchoring the bottom row exposed it.

## The autorun's synchronous prefix is the only place observables are read

`execute` is `async`, and MobX stops tracking at the first `await` — so anything
the placement needs must be read before it is called. That is what `FollowStep`
is for: it is not a convenience struct, it is the boundary. A field missing from
it cannot be fetched later, it can only be read untracked, which produces a
follow that works once and then never re-fires.

The same rule is why `LevelState` is a plain object and not MST state or a MobX
box. The exact pass writes it on every pass; observable, it would become a
dependency of the run that writes it and re-enter forever.

And it is why `followUnaligned` / `followApproximate` are **written here and
read only by the header**. Reading either back inside the follow would close the
same loop. If you need a third such flag, it has to keep that property.

## What each pass is allowed to touch

- The exact pass **navigates** (`navToResolvedSpan` → `navToLocString`), which
  may change the row's displayed regions — necessary, since the matching region
  can be on a different contig.
- The frame pass **positions** (`positionViewOnSpan` → `Base1DUtils.moveTo`) and
  must not navigate. Sixty times a second, a navigation would flush the row's
  coarse blocks, and the exact pass tracks those — that is an RPC per frame. The
  free `moveTo`, not the view action of the same name, for exactly this reason.
- The frame pass reads each level's **staying** row and never its moving row,
  which it writes. Combined with the outward ordering above, an interior row is
  written before the level beyond it reads it.

The exact pass, confusingly, reads the moving row on purpose (for
`alreadyShowing`), which is the rule above inverted. That is deliberate: it
makes the moving row a dependency, and that dependency is what re-asserts the
follow over a row the user has nudged by hand.

So the exact pass **does** re-enter on its own navigation, and it is worth
knowing that it is designed to rather than getting away with it. One settle
wakes it three times: once for the anchor, once because the navigation flushed
the moved row's coarse blocks, once because the moved row then refetched. Two
things make that converge instead of spinning. `alreadyShowing` compares against
where the row _actually_ is — with a tolerance, since `navToLocString` fits a
span to the pane rather than landing on it exactly — so the second and third
wakes navigate nowhere. And the per-level answer promise is shared by key, so
all three wakes ride one `SyntenyResolveMatchingRegion` rather than issuing
three. The integration suite asserts exactly that count; a change that makes the
follow issue two RPCs per settle has broken something even if it looks right on
screen.

A frame-pass span that is off the row's displayed regions is not an error and
not something to fix by widening `positionViewOnSpan`: it means the row is
showing another contig, and the exact pass is already on its way to navigate it
there.

## The follow can only reach contigs the moving row is already displaying

Not a rule to keep so much as a limit to know, because it silently weakens any
test written without it. The synteny fetch keeps a block only when **both** ends
are in view (`v1RefNames.has(refName) && v2RefNames.has(mate.refName)` in
`executeSyntenyFeaturesAndPositions`), so a row parked on one contig is only
ever sent alignments that already point at it. The follow then places it inside
that contig, correctly and uninterestingly.

Which contig the envelope picks is therefore only observable when the moving row
is showing enough of its assembly to have a choice — whole-assembly, or at least
several contigs. `browser-tests/suites/synteny-follow.ts` says the same thing at
the point where it matters; it passed against a row pinned to one contig while
proving nothing.

## Approximate is a state the UI reports, not a failure

Three things can put a placement on an interpolation rather than a CIGAR walk: a
window wider than one alignment (the envelope), a tier that carries no CIGAR at
all (a PIF's coarse tier, by construction), and a file that mixes them so
`hasCigar` — which is per-_fetch_ — is true while this particular block has
none.

The click-driven move refuses in that situation and says so. The follow must
not: refusing would make the mode work zoomed in and silently stop working
zoomed out, which is the whole-genome view where it is most useful. So it
interpolates and sets `followApproximate`, and the header says the placement is
close rather than base-exact. `interpolateFollowSpan` is the one place synteny
code navigates on an interpolation, and that asymmetry with `moveMatchingPanel`
is deliberate.

`followUnaligned` is the different answer: nothing covers the window at all, so
the rows hold position. Without the flag that is indistinguishable from a broken
follow, since a held row and a dead follow look identical.

## Block coordinates are `start <= end`, with direction in `strands`

The packing writes `start`/`end` straight off the feature, so a block is never
negative-width and the strand is the only thing that says which way it points.
Every reader here relies on that — `windowInsideFeat` and
`interpolateFollowSpan` always did, and `pickFollowFeature` and
`followWindowMapping` were made to, because they are the hot loops (per frame,
hundreds of thousands of blocks on a whole-genome PAF) and because three readers
of one array disagreeing about the contract is how a reader stops being able to
tell what the contract is.

Clamping follows from the same distinction. `followWindowMapping` interpolates,
so every coordinate it returns is a block coordinate or a point between two, and
it needs no zero-clamp. `applyFollowTransform` **extrapolates**, so it can be
asked about a window left of the contig's start, and it clamps — before the
`hi > lo` test, so a wholly-negative answer becomes no answer (hold the row)
rather than an inverted span.

## `levelStates` is keyed by the level node

`reconcileLevels` pops a level when a genome row is removed. Keyed by index, the
entry outlived the level, and a re-added row inherited a dead level's incumbent
feature id and cached transform. It is a `WeakMap` on the node itself, which is
also the entire pruning story — there is no sweep to forget to run.
