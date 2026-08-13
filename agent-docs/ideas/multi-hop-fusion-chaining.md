---
name: multi-hop-fusion-chaining
description: SplitThreader-style multi-hop breakpoint chaining, and the one shared `Chain` type that would replace three triplicated copies of it.
---

# Multi-hop / fusion chaining (SplitThreader-style)

Design only, no code. Show cancer multi-hop rearrangements / gene fusions the
way [SplitThreader](https://github.com/marianattestad/splitthreader) does —
reference-space arcs (its panel A) *and* a linearized "fusion contig" axis with
ribbons to the reference (its panel B). User's wish: *"chain everything
together similar to launch → linear read vs ref."*

A split read is a walk through a breakpoint graph (nodes = positions, edges =
junctions); a read with SA segments `A→B→C` is a 2-hop path, a fusion is the
consensus path many reads agree on. JBrowse **already has both panels**, but
each is single-read / per-read, and the chain-walk logic is **triplicated**:

- **Panel A (reference-space arcs):** bezier overlay (`readGroupConnections`/
  `chainSubRead` — on-screen only) + coverage arcs (`unpairedReadChain`/
  `unpairedChainArcs`, `features/arcs/compute.ts` — inserts off-screen SA
  segments) + breakpoint-split-view `AlignmentConnections` (`readChainSegments`/
  `markHiddenSegments` — SA-aware + marks hidden).
- **Panel B (query-space linear chain):** the "Linear read vs ref" launcher —
  `buildReadVsRefFeatures` (one read + SA → segments sorted by
  `clipLengthAtStartOfRead`) → `buildReadVsRefTemporaryAssembly` (temp assembly
  whose one chromosome *is* the read) → `LinearSyntenyView`.

**Unifying model: sources → `Chain` → sinks.** Every current copy already builds
the `segments` half; the enabling refactor is one shared `Chain` type
(`{segments: ChainSegment[]; junctions: Junction[]}`) with an insert-node vs
mark-hidden flag for off-screen hops, plus one `renderChainPaths(junctions,
projector, style)` emitter over the shared `bezierConnectorPath`
(`packages/core/src/util/bezierConnector.ts`). Shared primitives already
single-source: `readEndpoints.ts` (`connectionEndpointBps`), `featurizeSA`,
`splitInversion`. SA tags already cross the worker boundary
(`PileupDataResult.readSuppAlignments`/`readClipAtStart`/`readNextPositions`),
so chain-building stays main-thread — no worker changes for phase 1.

Phasing: **P0** extract the shared `Chain` behind one builder (pure refactor;
watch the "no leaky abstractions" rule — the only host seam should be a small
`ChainProjector` of `screenX/screenY/reversed`; if it gets fat, keep the
copies). **P1** generalize `buildReadVsRefFeatures` single-read → multi-segment
+ a multi-read "Linear fusion vs reference" launcher, and "linearize this
rearrangement" from a breakpoint-split-view `layoutMatches` chunk (which is
*already* an ordered `Chain`). **P2** SA-aware bezier overlay + off-screen
anchor (A1 baseline-drop / A2 edge-clamp / A3 multi-region-only). **P3**
`aggregateJunctions` consensus → breakend features → breakpoint-split-view
renders them through its existing `getMatchedBreakendFeatures` path (a consensus
junction *is* a breakend; the alignments track discovers the fusion, the
breakpoint view renders it as it would a called SV — no new draw path).

Open decisions (need user input before coding): what the fusion contig is built
from (curated reads → consensus junctions → VCF breakend walk — all additive
sources feeding the same sink, ship in that order); the single-region off-screen
anchor (A1/A2/A3); aggregation scope (visible-reads main-thread vs whole-region
worker scan); whether P3's breakend bridge is in scope. Minor findings noted:
`PileupBezierOverlay` `onClick` always selects `arc.id1` (a multi-hop `id2`
endpoint is unreachable via click); `arcIsVisible` culls by endpoint Y only (a
same-row bowed curve just off-screen can be dropped, harmless).
