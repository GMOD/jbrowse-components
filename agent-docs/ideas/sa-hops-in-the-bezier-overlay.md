---
name: sa-hops-in-the-bezier-overlay
description: The bezier connector overlay draws only the hops whose far end it already fetched, so a split read's off-screen SA segment renders as nothing there while the arc band draws a tick and the split view dashes the pair; plus the shared `Chain` type that lost the caller it was proposed for. What is left of the SplitThreader-style multi-hop proposal after the derivative-allele picker shipped.
---

# SA hops in the bezier overlay

This file was `multi-hop-fusion-chaining`, a four-phase proposal for showing
cancer multi-hop rearrangements the way
[SplitThreader](https://github.com/marianattestad/splitthreader) does. Two of
its phases shipped in August 2026 as the derivative-allele picker, in a shape the
proposal did not anticipate; two of its open decisions were answered by a rule
rather than by a design. What is left is one rendering gap, one refactor whose
justification the shipping took away, and one small live finding.

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

## Gap 1: the bezier overlay draws only the hops it fetched

### What each renderer does with one read

A long read crossing chr3 → chr10 → chr12 with only chr3 and chr12 on screen has
one hop whose far end nothing fetched. Three renderers see that read and give
three different answers:

| Renderer | Off-screen hop |
| --- | --- |
| Coverage arcs (`features/arcs/`) | `unpairedChainArcs` inserts the SA segment into the chain; the connection becomes a **tick** at the on-screen foot naming the far chromosome (`resolveArcs`' arc-or-tick branch, `pushLine`) |
| Breakpoint split view | `markHiddenSegments` fills `hiddenSegmentsBefore`, and `AlignmentConnections` draws the flanking pair **dashed** |
| Bezier overlay (`features/linkedReads/`) | **nothing** |

The overlay's silence is not a bug against its own contract — it is the contract,
written down in `resolveReadGroup` (`shared/readGroupConnections.ts`): *"the
bezier path chains only the on-screen segments (`splitJunctions`), the arc path
additionally walks off-screen SA segments"*, and `loneMateLink` defaults to
emitting nothing *"which is what a renderer drawing between two on-screen reads
has to do — it has no second endpoint."* The gap is that the overlay is the mode
a user turns on to follow one read across a rearrangement, and it is the one mode
that goes quiet exactly where the rearrangement leaves the screen.

### The decision that has to be made first

The far end has no `x` (no displayed region covers it) and no `y` (no pileup row,
so no `readYs` entry). Everything below is downstream of picking one:

- **A1, baseline drop.** Curve from the read's row down to a fixed baseline at the
  band's bottom, ending under the on-screen foot. Reads as "leaves here, goes
  somewhere you can't see".
- **A2, edge clamp.** Curve toward the panel edge in the direction of travel and
  stop there. Reads as direction-of-travel, but a clamped end is a lie about
  position, and with two regions on screen the "edge" is a boundary between two
  real loci.
- **A3, multi-region only.** Draw nothing in a single-region view; in a
  multi-region view the far segment is often actually on screen, at which point
  the existing both-present path already handles it. Cheapest, and concedes the
  single-region case.

**A fourth option now exists and did not when this was written:** do what the arc
band does. `resolveArcs` decides *arc when both feet are on screen, ticks
otherwise*, and its comment gives the reason — a tick's whole job is "there is a
connection to somewhere you cannot see", which is precisely false once both feet
are visible. A foot mark on the read's own row, labelled with the far locus,
would make the overlay agree with the band directly above it instead of inventing
a fourth vocabulary. Weigh it first; it is the option that needs the least new
drawing code and the least new explanation to a user.

### Implementation sketch

The seam is already generic. `resolveReadGroup<E, T>` takes a per-mate
`chainMate` and a `loneMateLink`, and the arc path overrides both while the
bezier path takes the defaults. So the pipeline change is small and the *type*
change is where the work is:

1. `LinkedPair` is `{e1: ReadEntry, e2: ReadEntry, c: ClassifiedPair}`
   (`features/linkedReads/compute.ts`). An off-screen end has no `ReadEntry` —
   `computePileupBezierArcs`' `readScreenY` reads `e.data.readYs[e.readIdx]`. So
   the far end becomes an anchor-plus-target: one real entry supplying the row,
   plus `{refName, bp, strand}` for the segment that is not there. Whether that
   is an optional field or a second variant is the call; a discriminated pair
   type keeps `isBezierArcPair` / `isCrossRegionPair` honest, since neither
   predicate has an answer for a one-ended connection.
2. Give the bezier path a `chainMate` that walks the SA segments. The walk
   already exists as `unpairedReadChain(entries, canonicalRefName)` — reuse it
   rather than writing a second one, and note it needs a `CanonicalRefName`,
   which the bezier path does not thread today.
3. Project in `computePileupBezierArcs`. `bpToScreenX` returns `undefined` for
   the far end by construction, and today that `continue`s (line ~232); the
   anchor decision is what replaces the `continue`.
4. Both the live overlay and the SVG export go through one function,
   `computePileupBezierArcsFromModel` (`components/pileupBezierArcs.ts`), so a
   correct change lands in both. Check the export
   (`components/PileupBezierArcsSvg.tsx`) anyway — a half-arc's bounding box is
   new and the export sizes its viewBox.
5. Gate it on the settings that already exist rather than adding one:
   `drawLongRange` ("Draw long-range read-connection arcs") and `drawInter`
   ("Draw inter-chromosomal read-connection arcs"), combined by
   `emitsOffScreenPartner` — which exists because layering them as an AND once
   made unticking off-screen mates silently untick inter-chromosomal pairs.
6. Legend. `bezierConnectionLegendItems` builds one row per *color*, and a
   half-arc is a new **mark**, not a new color — see `connectionMark`, which
   already lets a row draw itself as the connector it names.

### Traps

- **`iterLinkedPairs` short-circuits on `entries.length >= 2`**, and its own
  comment is the warning: *"Do not grow a branch off this count: which mates are
  on screen is the mate partition's question, and answering it from an entry
  count is what once dropped a split read's off-screen mate arc."* A read with
  one on-screen segment and an SA tag is exactly the group this skips.
- **`enumerateBezierPairs`' `crossRegion` scope short-circuits on
  `laidOutPileupMap.size < 2`** for the same kind of reason, and that scope is
  *not* opt-in. An off-screen hop in a single-region view is precisely a case
  where `size < 2` and there is still something to draw. Decide deliberately
  whether the new marks belong to the `all` scope only.
- **Cost.** The `crossRegion` short-circuit measures 0.0ms at 200k reads today;
  removing it makes that path pay the full grouping (~63–80ms measured, against
  the 587–1317ms relayout it runs beside). That is the number to re-measure, not
  to assume.
- **`segLocusKey` dedup is sound only because refNames are canonical**
  (`saSegments` normalizes; fetched entries already are) and because
  `readPositions` carries the read's *true* start rather than a region-clipped
  one. Anything reaching for a cheaper key re-opens both.

### How to see the gap

The COLO829 tumour ONT track in the `cancer_sv` demo
(`https://jbrowse.org/demos/cancer_sv/config.json`) is the case: chain 1 is a
closed cycle over chr3 → chr10 (199 bp) → chr12 (183 bp) → chr3, so any view
holding fewer than three of those loci has reads with an unfetched hop.
`website/scripts/specs/jbrowse-img.ts`'s `svReviewHalf` documents the same
configuration from the split view's side, where the dashed connectors are the
visible symptom. Put chr3 alone on screen with curved connectors on, and compare
against the arc band's ticks in the same display.

---

## Gap 2: the shared `Chain` type lost its caller

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
  separately as `LayoutMatch`. `splitJunctions` is the on-screen segments only.
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
That is a type-level change with no per-read cost, and it is what would have made
Gap 1's step 2 a reuse instead of a thread-a-normalizer-through. Anyone proposing
more owes a reason the full version lands differently from the `groupReadsByName`
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
