---
name: a-same-strand-junction-across-unfetched-segments-is-still-drawn-solid
description: the inverted and cross-region cases dash a junction spanning an unfetched segment and name the hidden loci; a same-strand one is `isNormal`, so the straight pass draws it solid, and closing it is a decision about which renderer owns a marked junction
---

# A same-strand junction across unfetched segments is still drawn solid

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. The picture has lied this way in every release, and the
fix is a renderer-ownership decision rather than a correction v5.0.0 is waiting
on.

The inverted and cross-region cases are fixed (`68eab1e8c7`): the bezier overlay
walks the SA tags of the segments it did fetch, dashes a junction that spans one
it did not, and names the hidden loci in the hover, in the breakpoint split
view's own wording. **A same-strand junction is not fixed, and the reason is
ownership rather than plumbing.** `isNormal` is true for it, so
`isBezierArcPair` hands it to the GPU/Canvas2D straight-line pass and the overlay
never sees it — it still draws one solid line across segments nothing fetched,
which is the same lie in a different renderer.

Routing those to the overlay is the obvious move and is not obviously right: in
chain mode it would double-draw over `buildChainConnectingData`, and the straight
pass is the cheap one precisely because it carries no per-read SA parse. The
alternative is to teach the straight pass a dash, which means a per-instance flag
in a buffer built for position and width alone.

**First move: decide which renderer owns a marked junction**, because that
decides whether the SA walk moves or is duplicated. Note the walk itself is
already paid on the overlay's side and is scroll-invariant
(`enumerateBezierPairs`), so the cost question is only about the straight pass.

**It is two problems, one per layout mode**, because the solid line comes from a
different pass in each:

- **Pileup mode** (curved connectors on, so scope `all`): the line is
  `attachLinkedReadLines`' feed, per junction, and `isBezierArcPair` is what
  hands the same-strand pair to it. The shape that resolves this half: enumerate
  the pairs once, beside `bezierPairSections`, partition them into an uploaded
  straight-line feed and the overlay's pairs, and let `isBezierArcPair` keep
  any pair with hidden segments. That also ends the double `iterLinkedPairs`
  walk `attachLinkedReadLines` and the overlay currently do over the same map.
  The feed's consumers are `features/linkedReads/packGpu.ts`, `drawCanvas.ts`
  and the Canvas2D renderer, all reading it off `LaidOutPileupData`, so moving
  it off the layout tier is a change to where they read from, not to what they
  draw.
- **Chain mode** (either connector setting): the line is
  `buildChainConnectingData`'s, and it is ONE solid span per chain per region,
  min start to max end, with no notion of junctions at all. Routing the hidden
  hop to the overlay does nothing here — a dashed straight line lands exactly
  on the span and vanishes — so the span has to become per-junction segments
  first. That is the renderer-ownership decision this file is parked on, and
  it is the chain-mode half only.

Cost of the enumeration the pileup half would newly pay on a single-region
section is measured (`benches/bezierEnumerate.probe.ts`, min of 25 rounds on a
quiet box): ~85ms at 200k short reads, ~5ms at 20k — the same order as the
multi-region case `crossRegion` already accepted. Gate it on
`readSuppAlignments` being present anyway, which the worker ships only when
some read carries an SA tag, and the deep short-read view pays nothing.

Cost of the landed half, for scale: +0ms on a 200k short-read fetch with no SA
tags, +30-45ms per relayout on 20k ONT at 10% split, and +372ms at 50% split with
900-op SA CIGARs — down from +619ms by parsing a record's locus only after its
clip proves it hidden (`getClip` is head-or-tail digits; `lengthOnRef` walks every
op).
