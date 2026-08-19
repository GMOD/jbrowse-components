---
name: sa-hops-in-the-bezier-overlay
description: What is left of the SplitThreader-style multi-hop proposal now that the derivative-allele picker has shipped — the bezier overlay drops a read's off-screen SA hops, and the shared `Chain` type lost the caller it was for.
---

# SA hops in the bezier overlay

This file was `multi-hop-fusion-chaining`, a four-phase proposal for showing
cancer multi-hop rearrangements the way
[SplitThreader](https://github.com/marianattestad/splitthreader) does. Two of
its phases shipped in August 2026 as the derivative-allele picker, in a shape
the proposal did not anticipate, and one of its open questions is now answered
by a rule. The remainder is one rendering gap and one refactor whose
justification the shipping took away.

## Shipped — do not re-propose

**A multi-read linearized allele, both panels.** The
`Reconstruct derivative allele...` track-menu item on `LinearAlignmentsDisplay`
lists the candidate paths and launches either view:
`buildDerivativeVsRefSpec` gives the query-space axis with ribbons to the
reference (the proposal's panel B), `buildSplitViewFromPath` gives a breakpoint
split view with **one panel per segment**, so a path that leaves chr9 and
returns to it inverted gets two chr9 panels. Both in
`plugins/linear-comparative-view/src/LinearDerivativeVsRef/`.

**Junction consensus.** `computeDerivativePaths`
(`plugins/alignments/src/features/derivativePaths/computePaths.ts`) groups the
chains in view by the path their junctions describe and ranks the groups by how
many independent reads describe each. It does this by calling `unpairedReadChain`
from `features/arcs/arcChains.ts` — the existing arc builder, unchanged — which
is why no shared `Chain` type was needed to get there.

**What the fusion contig is built from**, listed as an open decision, is settled
in both directions. Offline, `scripts/sv_multihop.py derive` polishes the
spanning reads into a consensus and realigns them onto it. In-app, nothing is
built: `projectReadsOntoDerivative` placed each supporting read onto the path and
was reverted in `e7b4f2b29b`, because its evidence was the same chains the path
came from. `reference/SV_MULTIHOP.md` carries the three questions that killed it
and the line the feature does not cross; read that before proposing anything
that emits a call rather than drawing one.

**Aggregation scope** is settled too: main-thread over the reads already in view
(`derivativePathCandidates` reads `rawDataByGroup`), no worker scan.

## What is left

### The bezier overlay draws only the hops it fetched

The overlay joins consecutive same-QNAME entries that are both present
(`resolveReadGroup`'s both-sides-present guard, `shared/readGroupConnections.ts`),
so a read whose next SA segment is off-screen simply has no connector there. The
coverage-arc path does the opposite — `unpairedChainArcs` inserts the off-screen
segment from the SA tag — and the breakpoint split view does a third thing,
marking the pair dashed via `markHiddenSegments`. Three renderings of one read,
and the overlay's is the one that says nothing.

The anchor question the proposal left open is still open, and it is the whole
decision: with one region on screen and the partner elsewhere, does the curve
drop to a baseline (A1), clamp to the panel edge (A2), or is the connector drawn
only in multi-region views (A3)?

### The shared `Chain` type lost its caller

The chain walk is still written three times — `unpairedReadChain` /
`unpairedChainArcs` (`features/arcs/arcChains.ts`, over `SegAln`),
`readGroupConnections` (`shared/`, feeding the bezier overlay), and
`readChainSegments` / `markHiddenSegments`
(`breakpoint-split-view/src/BreakpointSplitView/featureMatching.ts`, over its own
`ChainSegment`) — and there is no `renderChainPaths` emitter over the shared
`bezierConnectorPath`.

But the extraction was proposed as the *enabling* refactor for the two phases
that shipped, and they shipped without it. What is left is a refactor for its own
sake, next to a measured precedent going the other way: the layer directly
underneath, one shared `groupReadsByName`, was extracted, priced at 1.4-1.9x over
200k reads, and declined (`reference/REJECTED_IDEAS.md`). The per-entry accessors
are what did share. Anyone reviving this owes a reason the type-level version
lands differently, and the honest version is probably "unify the two that draw
beziers, leave the third".

### One overlay finding still live

`PileupBezierOverlay`'s `onClick` always selects `arc.id1`, so the far endpoint
of a multi-hop arc cannot be reached by clicking it. The tooltip already takes
the whole arc for both ids; the click does not.

The other finding recorded here — `arcIsVisible` culling a bowed curve by its
endpoints' Y alone — is fixed. It pads by `BEZIER_CONNECTOR_MAX_REACH_PX` and is
now over-inclusive rather than lossy.
