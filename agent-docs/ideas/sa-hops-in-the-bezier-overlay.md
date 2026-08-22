---
name: sa-hops-in-the-bezier-overlay
description: Drawing the split-read hops whose far end nothing fetched — the bezier connector overlay has no mark for them, while the arc band answers the same question twice depending on whether the hop crosses chromosomes. Plus the shared `Chain` type that lost the caller it was proposed for, and what the derivative-allele picker settled.
---

# SA hops in the bezier overlay

This file was `multi-hop-fusion-chaining`, a four-phase proposal for showing
cancer multi-hop rearrangements the way
[SplitThreader](https://github.com/marianattestad/splitthreader) does. Two of its
phases shipped in August 2026 as the derivative-allele picker, in a shape the
proposal did not anticipate; two of its open decisions were answered by a rule
rather than by a design. What is parked here is the additive half of the
remainder — the marks nobody draws — plus a deflated refactor.

**The correctness half is not here, and it shipped.** `68eab1e8c7` stopped the
overlay drawing a solid junction across segments it never fetched: it walks the
SA tags of the segments it did fetch, dashes a junction spanning one it did not,
and names the hidden loci in the hover. It did NOT go through
`unpairedReadChain`, as this file and the backlog both once proposed — `SegAln`
carries no route back to the `ReadEntry`, and the overlay needs the entry at
both ends for its `readYs` row and `displayedRegionIndex`, so it copied
`markHiddenSegments`' clip window instead. What is left of the correctness half
is the same-strand case, which `isNormal` routes to the straight-line pass:
[TODO.md](../TODO.md), "A same-strand junction across unfetched segments is
still drawn solid".

Read [`reference/SV_MULTIHOP.md`](../reference/SV_MULTIHOP.md) before starting
any of it — it carries the line this feature area does not cross, and the three
questions that killed the last idea in it.

## Shipped — do not re-propose

**A multi-read linearized allele, both panels.** The
`Reconstruct derivative allele...` track-menu item on `LinearAlignmentsDisplay`
lists the candidate paths and launches either view, from
`plugins/linear-comparative-view/src/LinearDerivativeVsRef/`:
`buildDerivativeVsRefSpec` builds the query-space axis with ribbons to the
reference (the proposal's panel B), and `buildSplitViewFromPath` builds a
breakpoint split view with **one panel per segment**, so a path that leaves chr9
and returns to it inverted gets two chr9 panels rather than one that quietly
merges the two visits.

**Junction consensus.** `computeDerivativePaths`
(`plugins/alignments/src/features/derivativePaths/computePaths.ts`) groups the
chains in view by the path their junctions describe and ranks the groups by how
many independent reads describe each. It gets those chains by calling
`unpairedReadChain` from `features/arcs/arcChains.ts` — the existing arc builder,
unchanged — which is the reason no shared `Chain` type was needed to get there.

**What the fusion contig is built from** is settled in both directions. Offline,
`scripts/sv_multihop.py derive` polishes the spanning reads into a consensus and
realigns them onto it. In-app, nothing is built: `projectReadsOntoDerivative`
placed each supporting read onto the path and was reverted in `e7b4f2b29b`,
because its evidence was the same chains the path came from.

**Aggregation scope** is settled too: main-thread over the reads already in view
(`derivativePathCandidates` reads `rawDataByGroup`), no worker scan.

---

## The one-ended hop

A hop whose far end was never fetched — the read leaves the screen and does not
come back — has no `x` (`bpToScreenX` returns `undefined`) and no `y` (no
`readYs` row). The overlay draws nothing for it. This is the additive half: a
mark that does not exist rather than a mark that is wrong.

**It no longer waits on anything.** The correctness fix was expected to put the
whole chain in the overlay's hands and did not: `68eab1e8c7` parses SA records,
but keeps only those whose clip lands strictly BETWEEN two on-screen segments,
which is exactly the test a one-ended hop fails. So the SA parse is now in the
overlay and this case is still unreachable through it — what is needed is that
window widened to the ends of the chain, plus the extrapolating projector below,
and neither is a consequence of the other.

**Both answers already exist one band up**, and they are split by exactly the
test the overlay already computes in `classifyPair` (`interchromOf` →
`LINKED_READ_COLOR_INTERCHROM`). `resolveArcs` decides:

- **Same chromosome** — keep the real geometry. The arc's leg rises at the
  on-screen foot and the curve runs off the block edge (`arcTouchesRegion`, whose
  comment calls the rising leg "the correct picture").
- **Interchromosomal** — replace the mark with a **tick** at the on-screen foot
  naming the far chromosome (`resolveArcs`, inside `if (p1Ref !== p2Ref)`),
  because a tick's whole job is "there is a connection to somewhere you cannot
  see".

Adopt both rather than inventing a third vocabulary for the band directly below
the one that already says this. The earlier A1 (baseline drop) / A2 (edge clamp)
/ A3 (multi-region only) menu is superseded: A2 is the same-chr answer done worse
— a clamp invents a position where extrapolation does not — and A1 is a mark the
display has no other use for.

### The concrete blocker

The arcs project absolute genomic bp inside a region block, so an off-block
coordinate lands off-block for free. The overlay cannot: `makeBpToScreenX`
delegates to `view.bpToPx`, which returns `undefined` for any coordinate no
displayed region covers — including a coordinate on a *displayed* refName that is
merely outside the displayed range. **An extrapolating projector is the missing
piece**, and it is what the same-chr case needs before any of the drawing
matters.

### Traps

- **`iterLinkedPairs` short-circuits on `entries.length >= 2`**, and its own
  comment is the warning: *"Do not grow a branch off this count: which mates are
  on screen is the mate partition's question, and answering it from an entry
  count is what once dropped a split read's off-screen mate arc."* A read with
  one on-screen segment and an SA tag is exactly the group this skips — which is
  why this half is harder than the TODO half, where both flanking segments are
  fetched and the group clears the gate.
- **`enumerateBezierPairs`' `crossRegion` scope short-circuits on
  `laidOutPileupMap.size < 2`**, and that scope is *not* opt-in — it is what
  chain mode gets with curved connectors unticked. A one-ended hop in a
  single-region view is precisely `size < 2` with something to draw. Decide
  deliberately whether the new marks belong to the `all` scope only.
- **Cost.** The `crossRegion` short-circuit measures 0.0ms at 200k reads; the
  multi-region case that does enumerate is ~63–80ms, against the 587–1317ms
  `buildLaidOutChainMap` relayout beside it. Nobody has measured the
  single-region grouping this would newly pay for, so that is a measurement to
  take, not a number to carry over.
- **Gate on the settings that exist**: `drawLongRange` ("Draw long-range
  read-connection arcs") and `drawInter` ("Draw inter-chromosomal
  read-connection arcs"), combined by `emitsOffScreenPartner` — which exists
  because layering them as an AND once made unticking off-screen mates silently
  untick inter-chromosomal pairs.
- **Legend.** `bezierConnectionLegendItems` builds one row per *color*. A foot
  mark is a new **mark**, not a new color — `connectionMark` already lets a row
  draw itself as the connector it names.
- **`LinkedPair` has no shape for this.** It is `{e1: ReadEntry, e2: ReadEntry,
  c: ClassifiedPair}` and `readScreenY` reads `e.data.readYs[e.readIdx]`, so the
  far end becomes an anchor-plus-target: one real entry supplying the row, plus
  `{refName, bp, strand}` for the segment that is not there. A discriminated pair
  type keeps `isBezierArcPair` / `isCrossRegionPair` honest, since neither
  predicate has an answer for a one-ended connection.

---

## The shared `Chain` type lost its caller

The chain walk is still written three times:

| Where | Builder | Element | Input |
| --- | --- | --- | --- |
| `alignments/features/arcs/arcChains.ts` | `unpairedReadChain` → `unpairedChainArcs` | `SegAln` (`{refName, start, end, strand, clipAtStart, onScreen}`) | worker TypedArrays |
| `alignments/shared/readGroupConnections.ts` | `splitJunctions` in `readGroupConnections` | `ReadConnection<ReadEntry>` | worker TypedArrays |
| `breakpoint-split-view/…/featureMatching.ts` | `readChainSegments` → `markHiddenSegments` | `ChainSegment` (`{clip, refName, start, end}`) | `Feature` objects |

There is no `renderChainPaths` emitter over the shared `bezierConnectorPath`
either. But the extraction was proposed as the *enabling* refactor for the two
phases that shipped, and they shipped without it, so what is left is a refactor
for its own sake — and it is harder than the type table makes it look:

- The three chains **are not the same chain**. `unpairedReadChain` is the complete
  walk, on-screen entries merged with SA segments and deduped by locus
  (`segLocusKey`), on-screen record winning. `readChainSegments` is the
  SA-declared segments *only*, deduped by clip — its on-screen half arrives
  separately as `LayoutMatch`. `splitJunctions` is the on-screen segments only,
  which is the bug the TODO entry fixes.
- They read **different input universes**: two walk worker TypedArrays through
  `MinEntry`, one walks `Feature` objects through `getTag`. The shared layer that
  could hold a common type is `@jbrowse/cigar-utils`, which already hosts what
  they genuinely share — `featurizeSAEntries`, `splitSA`, `getClip`,
  `connectionEndpointBps`.
- There is a **measured precedent going the other way**. The layer directly
  underneath — one shared `groupReadsByName` — was extracted, priced at 1.4–1.9x
  over 200k reads, and declined; see `reference/REJECTED_IDEAS.md`, "One shared
  `groupReadsByName`". The per-entry accessors are what did share, and that is
  the shape to aim at: share the layer with no per-read allocation in it.

The honest version is therefore narrow: **make `ChainSegment` and `SegAln` one
type** (the former is the latter minus `strand` and `onScreen`, with `clip`
renamed), lift it beside `featurizeSAEntries`, and leave the three walks alone.
That is a type-level change with no per-read cost. Anyone proposing more owes a
reason the full version lands differently from the `groupReadsByName`
measurement.

---

## Live finding

`PileupBezierOverlay`'s `onClick` always calls `model.selectFeatureById(arc.id1)`
(`components/PileupBezierOverlay.tsx`, line ~118), so the far endpoint of a
multi-hop arc cannot be reached by clicking it. `arcTooltip` directly above
already takes the whole arc for both ids, so the data is there; the click is what
never grew the second case. Whether it should toggle, pick the nearer endpoint,
or open both is a UI call, not a plumbing one.

## Closed — do not re-file

- **`arcIsVisible` culling a bowed curve by its endpoints' Y alone.** Fixed. It
  pads by `BEZIER_CONNECTOR_MAX_REACH_PX` and is now over-inclusive rather than
  lossy, with the asymmetry deliberate and commented.
- **A consensus fusion contig built in the browser.** Reverted in `e7b4f2b29b`;
  `SV_MULTIHOP.md` carries the three questions that killed it and generalizes
  them to anything new in this area.
