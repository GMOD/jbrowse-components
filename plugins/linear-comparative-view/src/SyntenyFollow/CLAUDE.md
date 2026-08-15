# SyntenyFollow

The continuous form of "Move bottom panel to the matching region": that item
resolves one alignment on a click, this resolves whichever alignment is under
the anchor row's window, every time the anchor moves, for every other row.

It maps the anchor's visible **window**, not a midpoint, which is also what
makes the moved row match the anchor's _scale_.

Nearly all of this file is about placement happening **twice**, on two clocks.

## Two passes, because the exact answer costs an RPC

A CIGAR walk happens in the worker, so an exact answer can only be asked for
when the anchor settles — the **exact pass**, reading the debounced
`coarseDynamicBlocks`. On its own the row sits completely still through the drag
and jumps once, half a second after the user stops. So a **frame pass** on live
`dynamicBlocks.contentBlocks` does everything except the RPC. Exact supplies
correctness, frame supplies motion.

**The frame pass replans; it does not extrapolate the last exact answer.** That
was tried and snaps 43% of a screen when the settle lands, because "the answer"
is two functions: affine inside a single alignment (`FollowTransform`), and an
**envelope** once the window is wider than any one alignment. An envelope is not
affine in the window — panning changes which blocks contribute its edges. So the
affine shortcut is taken only where affine is true, and the cached transform may
only be built from a **single-block** answer: an envelope carries no one strand,
and a forward transform derived from one mirrors the row inside an inverted
alignment.

## Ordering is outward from the anchor, not by level index

An alignment relates one pair of rows, so the follow propagates one level at a
time and an interior row is both an output and an input. `followPairs` sorts by
`followDirection`'s `distance`, not `level.level`; the two coincide only when
the anchor is the top row, which is why anchoring the bottom row exposed this.

## The autorun's synchronous prefix is the only place observables are read

`execute` is `async` and MobX stops tracking at the first `await`, so everything
the placement needs is read before it is called. `FollowStep` is that boundary,
not a convenience struct — a field missing from it can only be read untracked,
producing a follow that works once and never re-fires.

Same rule: `LevelState` is a plain object, not MST or a MobX box, since the
exact pass writes it every pass and observable it would re-enter forever. And
`followUnaligned` / `followApproximate` are **written here and read only by the
header**; a third such flag must keep that property.

## What each pass is allowed to touch

- The exact pass **navigates** (`navToResolvedSpan`), necessary since the
  matching region can be on another contig.
- The frame pass **positions** (`positionViewOnSpan` → the free
  `Base1DUtils.moveTo`, not the view action) and must not navigate — sixty times
  a second a navigation flushes the row's coarse blocks, which the exact pass
  tracks, i.e. an RPC per frame.
- The frame pass reads each level's **staying** row and never its moving row.
  With the outward ordering, an interior row is written before the level beyond
  it reads it.

The exact pass reads the moving row on purpose (`alreadyShowing`), inverting
that rule: the dependency is what re-asserts the follow over a row the user
nudged by hand. So it re-enters on its own navigation — one settle wakes it
three times, and two things make that converge: `alreadyShowing` compares
against where the row actually is, with a tolerance since `navToLocString` fits
a span to the pane; and the per-level answer promise is shared by key, so all
three ride one `SyntenyResolveMatchingRegion`. The integration suite asserts
that count.

A frame-pass span off the row's displayed regions is not an error — it means the
row is showing another contig and the exact pass is on its way to navigate it.

## The follow can only reach contigs the moving row is already displaying

A limit to know, because it silently weakens any test written without it. The
synteny fetch keeps a block only when **both** ends are in view, so a row parked
on one contig is only ever sent alignments already pointing at it. Which contig
the envelope picks is observable only when the moving row is showing enough of
its assembly to have a choice.

## Every refName the follow reads is canonical, made so in two places

Nothing here canonicalizes; this file compares refNames constantly and every
comparison assumes both operands already agree. They do because both channels
are renamed first: `featureData`'s `refNameDict`/`mateRefNameDict` in the
fetch's `run`, and `ResolvedSpan.refName` on receipt in `resolveMatchingSpan`.

**A change that canonicalizes only one of them is worse than one that
canonicalizes neither** — `alreadyShowing` would compare canonical against
adapter-space, never match, and renavigate on every wake.
`LinearSyntenyRefNameAlias.test.tsx` is the fixture that fails if either half
goes. Both directions are live (request canonical→adapter, since the worker has
no assemblyManager; answer adapter→canonical, since a synteny feature names a
contig on the OTHER axis), so neither rename is redundant.
`agent-docs/reference/REFNAME_NAMESPACES.md` has the per-site table.

## Approximate is a state the UI reports, not a failure

Three things force an interpolation over a CIGAR walk: an envelope, a tier with
no CIGAR (a PIF's coarse tier), and a file mixing them so the per-_fetch_
`hasCigar` is true while this block has none. The click-driven move refuses; the
follow must not, or the mode would work zoomed in and silently stop in the
whole-genome view where it is most useful. It interpolates and sets
`followApproximate`.

The flag is written from **both halves of the exact pass** — the plan sees the
first two cases, the third is only knowable once the walk comes back empty. Only
the prefix lowers it; a promotion that could also lower would race the plan's
reset and flicker.

`followUnaligned` is the different answer: nothing covers the window, so the
rows hold. Without the flag a held row and a dead follow look identical.

## Block coordinates are `start <= end`, with direction in `strands`

A block is never negative-width; the strand is the only thing saying which way
it points. `followWindowMapping` interpolates, so it needs no zero-clamp;
`applyFollowTransform` **extrapolates** and clamps — before the `hi > lo` test,
so a wholly-negative answer becomes no answer (hold the row) rather than an
inverted span.

## `levelStates` is keyed by the level node

Keyed by index, an entry outlived a removed level and a re-added row inherited a
dead level's incumbent feature id and cached transform. A `WeakMap` on the node
is also the entire pruning story.
