---
name: carry-the-decision-not-the-rendered-state
description: A chain where each step derives its input from the previous step's rendered state promotes the medium's padding to signal, once per hop, and it compounds — the three-hop failure that named it, the two preconditions that make a chain vulnerable, why the carried value must be the decision rather than a re-reading of it, and why it needs no filtering against what the medium can hold. Read before deriving one placement from another that a screen, a grid or a rounding has already been applied to.
---

# Carry the decision, not the state it was rendered into

A chain of derived placements — B is positioned from A, C from B — has an
obvious input for each step: look at where the previous one ended up. That is
wrong whenever **the medium can only hold a coarsening of the answer**, and the
error is not a wrong value. It is a widening that repeats per hop.

## The shape

Two conditions, and neither looks like a defect on its own:

- **The answer is a set; the medium holds an interval.** A viewport shows one
  contiguous run of what it lays out, so an answer of "these two, far apart"
  can only be applied as "everything from the first to the last". The padding is
  not a bug in the placement — there is no other way to show both.
- **The next step reads its input off the medium.** Which is the honest thing to
  do everywhere else: the medium is where the truth about the current state
  lives, and it accounts for the clamps, floors and roundings applied on the way
  in.

Put together, the padding is indistinguishable from the answer at the next hop.
It is not smaller, not marked, and not obviously spurious: it earns its own
derivation, whose result widens the interval that step applies, whose padding
the hop after that inherits. Three steps is enough to reach "everything".

## The failure that named it

`plugins/linear-comparative-view/src/SyntenyFollow/` keeps a stack of genome
rows on the region of each that corresponds to the row above it. A row whose two
answers land on the mate row's first and ninth chromosome can only be placed by
`positionViewOnSpans` across all nine — the row lays its regions end to end.

Read back by `followAnchorWindows`, the seven chromosomes in between are windows
like any other. They clear the "is this a real share of the screen" floor
comfortably, being the same size as the two that mapped, and each maps somewhere
of its own at the next level. Measured on a synthetic three-row stack in
`installSyntenyFollow.test.ts`: the middle row correctly showed three
chromosomes, the far row showed all nine. What grew was the padding, not the
answer — and with more rows it saturates.

**The fix is one map, written by the step that decided and read by the step that
consumes.** `followPlacedWindows` reduces the decided spans to the input shape
the next hop wants, into a `Map` keyed by the object the two steps share (here
the row itself, which is one step's output and the next one's input under a
different name). The pass already visited the steps in dependency order for an
unrelated reason, so the entry is always written before it is read.

## Three things that are easy to get wrong on the way

**Carry the decision, not a re-reading of it.** The temptation is to re-derive
the carried value from the medium immediately after applying it — same code
path, one less thing to thread. That reads the padding straight back; the point
is that the value has to leave the producing step without having been through
the medium at all.

**Do not pre-filter the carried value against what the medium can hold.** The
instinct is to drop the part of the answer the medium could not represent, so
the next hop is not handed something that "is not really there". It costs a
scan, it re-introduces a dependency on the medium, and here it was unnecessary
for a reason that generalizes: the next hop's own domain rejects what it cannot
use — an alignment is only loaded where both of its ends are visible, so a
carried window on a region the row is not showing has nothing under it and drops
out. Let the consumer's existing filter do it, and check that it does.

**In a reactive system the carry removes a subscription, and that is the same
idea rather than a bonus.** The consuming step no longer observes the producing
step's state, so it no longer wakes when its own chain writes it. Before calling
that a regression, look for what else already subscribes to that object for a
real reason — here the level's own fetch is keyed on both rows, so a row moved
by hand still wakes the pass. Reading your output back as your input was costing
a dependency edge as well as the padding.

## Where else the shape turns up

- **Layout rounding chains.** An element sized from a parent whose size was
  rounded to a device pixel, and a child sized from that: the classic
  accumulating-drift bug, with the same cure — pass the unrounded value down and
  round only at paint.
- **Synced axes.** A second chart syncing to the first's *displayed* domain
  rather than to the data domain it was computed from. The first padded its
  domain out to a round number, and three charts later the padding is most of
  the axis.
- **Cross-filtering.** A selection of two disjoint ranges shown as the range
  spanning them, and the next filter reading the shown range.
- **Snap-to-grid and quantized schedulers.** Anything whose applied value is
  rounded to a legal position, and whose next value is computed from the applied
  one.

The tell is the same everywhere: two consecutive steps, the second reading state
the first had to inflate, and a symptom that gets worse the longer the chain is
rather than the further the inputs move.

## When the padding cannot be avoided, refuse the answer

Carrying the decision stops the padding spreading. It does not stop the padding,
and the step that has to apply an answer still owes the reader a judgement about
it: **an answer whose applied form is mostly padding is not an answer that
medium can express.** Measure the applied form — the same bounds the applied
form will use, not an estimate of them — and when the padding dominates, refuse
it and fall back to the narrower answer the system already knows how to produce.

Two things make this work rather than become a tuned constant, and both are
transferable:

- **The threshold needs a gate, and the gate is structural.** Here the ratio
  alone was measured to be useless: the legitimate wide case scored 26–40%
  where the illegitimate one scored 10%, interleaving. What separated them was
  a property neither ratio could see — whether the inputs were whole units or
  cut ones. Find that property first; a threshold applied to an ungated
  population is a coin toss with a decimal point.
- **The fallback should be an existing mode, not a new one.** Trimming the
  answer until the ratio improves is the intuitive fix and invents a third
  behavior to test, tune and explain. Falling back to what the system does when
  it only ever had one input reuses everything already built for that path — and
  it tends to *remove* a discontinuity, because the two regimes now meet at the
  boundary instead of teleporting across it.

Then say so. A fallback the reader cannot see is indistinguishable from the
system being wrong in a quieter way.

## The other half of the same change

The same file re-decides which region a window corresponds to on every frame,
between candidates a pan can put within rounding of each other — a chromosomal
fusion puts exactly two in that position, equal at the join. That wants a switch
margin, which `preferIncumbent` already applied one layer down and now applies
to this vote too. Hysteresis on a repeated decision is not a new idea;
recognizing that a vote you run per frame *is* a repeated decision is the part
that keeps being missed.
