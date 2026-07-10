# Multi-hop / fusion chaining — brainstorm handoff

Status: **design only, no code written.** This captures a brainstorm about
letting JBrowse show cancer multi-hop rearrangements and gene fusions the way
[SplitThreader](https://github.com/marianattestad/splitthreader) does — arcs on
the reference (its panel A) *and* a linearized "fusion contig" axis with ribbons
up to the reference (its panel B). No files were changed. The goal is to hand a
future agent (or the user) an accurate map of what already exists, what is
duplicated, and where a real implementation would slot in.

Motivating user quote: *"my wish would be that it sort of 'chains everything
together' similar to launch → linear read vs ref."*

## TL;DR

- A split read is a **walk through a breakpoint graph**: nodes = genomic
  positions, edges = junctions. A read with SA segments `A→B→C` on
  chr8→chr4→chr17 is a 2-hop path; a fusion is the consensus path many reads
  agree on.
- JBrowse **already has both SplitThreader panels**, but each is single-read /
  per-read:
  - **Panel A (reference-space arcs):** the alignments linked-read bezier
    overlay + breakpoint-split-view `AlignmentConnections`.
  - **Panel B (query-space linear chain):** the **"Linear read vs ref"**
    launcher (`buildReadVsRefFeatures` → synthetic read assembly →
    `LinearSyntenyView`).
- The "chain everything together" wish = generalize both from *one read's SA
  chain* to *a fusion path assembled from many reads* (or from a VCF breakend
  walk).
- The **chain-walk logic is triplicated** (three copies that only differ by data
  source + whether they see off-screen SA segments). Unifying them is the
  enabling refactor; everything else is builders (sources) and projectors
  (sinks) around one `Chain` type.

## The unifying model: sources → `Chain` → sinks

```
        SOURCES (build a Chain)                       SINKS (project a Chain)
 ┌──────────────────────────────────┐        ┌───────────────────────────────────┐
 │ one read's SA tags                │        │ reference-space arcs   (panel A)  │
 │   = buildReadVsRefFeatures  DONE  │        │   bezier overlay / AlignmentConns │
 │ many reads' consensus junctions   │──►Chain├──► synthetic query axis (panel B) │
 │   = aggregateJunctions      (new) │        │   read-vs-ref temp assembly  DONE │
 │ VCF breakend adjacency walk (new) │        │ dotplot read vs ref          DONE │
 │ breakpoint-split layoutMatches ✓  │        └───────────────────────────────────┘
 └──────────────────────────────────┘
```

Proposed shared type (host- and source-agnostic; every current copy already
builds the `segments` half):

```ts
interface ChainSegment {
  refName: string
  start: number
  end: number
  strand: number
  clipAtStart: number      // read-order sort key (clipLengthAtStartOfRead)
  onScreen: boolean        // is this segment currently fetched/laid-out?
  ref?: unknown            // handle to the on-screen record (readY row / Feature) when onScreen
}
interface Junction {
  seg1: ChainSegment
  seg2: ChainSegment
  isSplit: boolean         // split junction within a read vs a mate link
  hiddenBetween: ChainSegment[]  // off-screen hops read-adjacent between seg1 and seg2
}
interface Chain { segments: ChainSegment[]; junctions: Junction[] }
```

Two philosophies for off-screen hops — the shared builder should support both
via a flag:

- **insert-node** (alignments coverage arcs do this today): the off-screen SA
  segment becomes a real node; a junction is drawn toward its genomic-x even
  when that x is off the viewport.
- **mark-hidden** (breakpoint-split-view does this today): keep only visible
  nodes, collapse the gap to one dashed curve, list skipped loci in the tooltip.

## Current state — what exists, where

### Shared primitives (already single-source-of-truth — reuse as-is)

- Endpoint rule: `packages/cigar-utils/src/readEndpoints.ts` —
  `connectionEndpointBps` / `readTrailingBp` / `readLeadingBp`. Endpoint 1 =
  segment's read-trailing (3') edge; endpoint 2 = next segment's read-leading
  (5') edge for a split junction, or the mate's 3' edge for a pair.
- Curve geometry: `packages/core/src/util/bezierConnector.ts` —
  `bezierConnectorPath` + `bezierConnectorHandlePx`. Horizontal-tangent "oval";
  `handlePx` is proportional in the alignments overlay, fixed `200` in
  breakpoint-split-view (vertically separated ends). `MAX_BOW_PX` lifts a
  same-row curve into a visible hump.
- SA parsing: `featurizeSA` (`@jbrowse/cigar-utils`) — yields each SA segment's
  `clipLengthAtStartOfRead` on the original read 5' axis, directly comparable to
  the visible segment's clip. Used by every SA-aware path.
- `splitInversion` (`@jbrowse/alignments-core`) — strand-flip classifier.

### Panel A — reference-space arcs

**Alignments linked-read bezier overlay** (the pretty interactive curves):
- `plugins/alignments/src/LinearAlignmentsDisplay/components/PileupBezierOverlay.tsx`
  — live React SVG overlay (hover tooltip + click-select), gated on config slot
  `showBezierConnections`.
- `.../components/PileupBezierArcsSvg.tsx` — SVG-export twin (same geometry,
  no handlers).
- `.../components/pileupBezierArcs.ts` — `computePileupBezierArcsFromModel`
  (loops `model.bezierPairSections`, projects each section) + shared stroke
  constants.
- `plugins/alignments/src/features/linkedReads/computeOverlay.ts` —
  `computePileupBezierArcs` (per-frame screen projection), `enumerateBezierPairs`
  (scroll-invariant pair enumeration, memoized in `model.bezierPairSections`),
  `arcIsVisible`, `bezierArcKey`, `PileupArc`.
- `plugins/alignments/src/features/linkedReads/compute.ts` — `iterLinkedPairs`,
  `classifyPair`, `groupReadsByName`, color constants + `connectionLabel`.
- `plugins/alignments/src/shared/readGroupConnections.ts` —
  **`readGroupConnections` / `chainSubRead`** (chain copy #1, **on-screen only**),
  `partitionReadGroup`, `primaryOf`, `connectionEndpoints`.
- Model getters: `LinearAlignmentsDisplay/model.ts` — `showBezierConnections`
  (~L346), `bezierPairSections` (~L1464), `arcsByGroup` (~L1262). Overlay
  toggling is a main-thread tier-2/4 setting, **never** in `rpcProps` (see the
  display's `CLAUDE.md`, "Two distinct arc concepts").

**Alignments coverage arcs** (rasterized in the coverage band, SA-aware):
- `plugins/alignments/src/features/arcs/compute.ts` — **`unpairedReadChain`
  (~L405) / `unpairedChainArcs` (~L448)** (chain copy #2, **inserts off-screen SA
  segments**), `collectPendingArcs`, `computeArcsFromPileupData`. The comment at
  **~L538–546 explicitly documents the divergence**: "`readGroupConnections`,
  used by the bezier overlay, only chains the on-screen entries; the SA-tag
  off-screen walk lives here."
- `plugins/alignments/src/features/arcs/drawCanvas.ts` — `drawArcs` (canvas +
  SVG, flows through the unified `drawAlignmentBlocks` pass).

**Breakpoint-split-view connections** (already the most capable — SA-aware +
hidden-hop dashing):
- `plugins/breakpoint-split-view/src/BreakpointSplitView/components/AlignmentConnections.tsx`
  — React SVG, uses the shared `bezierConnectorPath` with `handlePx: 200`,
  dashes when `hiddenSegmentsBetween`.
- `.../components/util.ts` — **`readChainSegments` (~L86) / `markHiddenSegments`
  (~L113)** (chain copy #3, SA-aware + marks hidden), `getMatchedAlignmentFeatures`,
  `getBadlyPairedAlignments`, `getClipLengthAtStartOfRead`.
- `.../components/overlayUtils.tsx` — `resolvedPairs` (~L309) walks each
  `layoutMatch` chunk's adjacent pairs, carrying `hiddenSegmentsBetween`.
- `.../types.ts` — `LayoutMatch`, `hiddenSegmentsBefore` (~L40), `layoutMatches`
  (~L46). A **`layoutMatches` chunk IS an ordered `Chain`** already.
- `.../model.ts` (~L340–380) — assembles `layoutMatches` via
  `getMatchedFeaturesInLayout`.

### Panel B — query-space linear chain ("chain everything")

- `plugins/linear-comparative-view/src/LinearReadVsRef/LinearReadVsRef.tsx` —
  the dialog / launcher.
- `plugins/linear-comparative-view/src/LinearReadVsRef/buildReadVsRefSpec.ts` —
  `buildReadVsRefSpec`: assigns canonical refNames + `syntenyId`, `gatherOverlaps`
  for the ref regions, builds a two-panel `LinearSyntenyView` (ref on top,
  synthetic read assembly on bottom, `FromConfigAdapter` synteny track between).
- `packages/alignments-core/src/buildReadVsRefFeatures.ts` —
  **`buildReadVsRefFeatures`**: one read + its SA tags → primary+supplementary
  feature list **sorted by `clipLengthAtStartOfRead`**, each with a `mate`
  describing its span on the synthetic read axis. **This is already producing the
  `Chain.segments` half — it just doesn't emit `junctions` or accept >1 read.**
- `packages/alignments-core/src/buildReadVsRefTemporaryAssembly.ts` —
  `buildReadVsRefTemporaryAssembly`: temp assembly whose one chromosome *is* the
  read (length = read length). **This synthetic-assembly trick is the reusable
  core of panel B** — any ordered chain of `(refName,start,end,strand)` segments
  can be laid end-to-end into a synthetic contig and the reference ribboned
  against it. Nothing about it is read-specific except the source of the chain.

### Data availability (no worker changes needed for phase 1)

`plugins/alignments/src/RenderAlignmentDataRPC/types.ts` — `PileupDataResult`
carries `readSuppAlignments` (~L319, per-read SA tag strings), `readClipAtStart`
(~L324, strand-aware read-order key), `readNextPositions` (~L316, mate PNEXT).
SA tags already cross the worker boundary, so chain-building stays main-thread
(consistent with the layout-on-main-thread rule; see the RPC dir `CLAUDE.md`).

## How it slots in

### (a) Normal LGV alignments track

**Panel A** — give the bezier overlay the SA-awareness the coverage-arc path
already has (swap chain copy #1 for the shared builder). Three regimes:

- **Multi-region view — works TODAY, just underused.** Open the fusion loci
  side-by-side in one LGV; `groupReadsByName` already spans all displayed
  regions, so `chainSubRead` draws the full multi-hop chain across them. SA
  awareness only fills a hop the user didn't bring into view.
- **Single region + off-screen hop — the new bit + the one real UX fork.** The
  on-screen breakpoint is real but the far hop has no pileup row. Options:
  - **A1 baseline-drop** (closest to the SplitThreader image): the off-screen
    endpoint anchors to the pileup band bottom at the on-screen segment's
    breakpoint x, drawn as a dashed tail, labeled, click-to-jump (reuse the
    existing `readConnections` "view mate / next segment" menu).
  - **A2 edge-clamp:** clamp x to the viewport edge so the curve exits the side
    (nice for a same-chrom hop just off-pan).
  - **A3 do-nothing single-region:** only draw multi-hop when the user brings
    the loci into a multi-region view.
- Storage: add a tier-3 slot (e.g. `bezierLongRange`, mirroring the arcs'
  `drawLongRange`) in `configSchema.ts`, read in the `arcsByGroup`/bezier getter.
  No refetch (SA already present).

**Panel B** — a new context-menu action beside today's per-read "Linear read vs
ref": **"Linear fusion vs reference"**, taking a *set* of reads (current
selection / all reads under a junction cluster / the reads a bezier arc touches)
→ `aggregateJunctions` → synthetic fusion contig → `LinearSyntenyView`.
Single-read is just N=1, so today's launcher becomes a special case.

**Cross-panel action:** click a junction in the panel-A overlay → "linearize
this rearrangement" → opens panel B for that read/cluster (the SplitThreader
click-a-variant-see-its-structure interaction).

### (b) Breakpoint-split-view

- It **is panel A**, and its `layoutMatches` chunk is **already an ordered
  `Chain`** (with `hiddenSegmentsBefore`). So it's the most natural source *and*
  host for panel B: a "linearize this rearrangement" action on a chunk feeds
  that ordered chain straight into a `buildReadVsRefSpec`-style builder → opens
  panel B as a sibling `LinearSyntenyView`. No aggregation needed — the chunk is
  the path.
- Consolidation win: `readChainSegments`/`markHiddenSegments` (breakpoint),
  `unpairedReadChain` (alignments arcs), and `buildReadVsRefFeatures`
  (read-vs-ref) all collapse into the one `Chain` builder, differing only in
  input adapter (`Feature` vs `PileupDataResult` arrays vs `feature.toJSON()`).

## The satisfying bridge (optional, later phase)

A **consensus junction is a breakend.** Aggregate junctions across reads
(`key = ref1:bp1±tol:strand1 × ref2:bp2±tol:strand2`, value = support count),
emit them as breakend features, and breakpoint-split-view renders them through
its **existing** `getMatchedBreakendFeatures` path — same as a VCF SV. Pipeline:

```
reads + SA ─► buildReadChain ─► aggregateJunctions ─► breakend features
                    │                                        │
             (a) per-read bezier overlay            (b) breakpoint-split-view
                                                        (renders breakends today)
```

The alignments track *discovers* the fusion; the breakpoint view *renders* it
exactly as it renders a called SV — no new draw path in either host.

## Recommended phasing

- **Phase 0 — extract the shared `Chain`.** Unify the three chain-walk copies
  behind one builder (`buildReadChain` + `chainJunctions` with an
  insert-node/mark-hidden flag) + a shared `renderChainPaths(junctions,
  projector, style)` emitter over `bezierConnectorPath`. Pure refactor, keeps
  behavior; unblocks everything else. Watch the "no leaky abstractions" rule —
  the only host-specific seam should be a small `ChainProjector`
  (`screenX/screenY/reversed`); if the seam gets fat, keep the copies.
- **Phase 1 — panel B "chain everything" (smallest real payoff).** Generalize
  `buildReadVsRefFeatures` single-read → multi-segment path and add the
  multi-read "Linear fusion vs reference" launcher in (a); add "linearize this
  rearrangement" from a breakpoint-split-view chunk (b). Source = **curated
  reads** first (no calling).
- **Phase 2 — panel A SA-aware bezier + off-screen anchor** (pick A1/A2/A3).
- **Phase 3 — `aggregateJunctions` consensus** + the breakend bridge into
  breakpoint-split-view; optionally a VCF-breakend-walk source.

## Open decisions (need user input before coding)

- **What is the "fusion contig" built from?** (A) curated reads — honest, no
  calling, smallest lift; (B) consensus junctions over visible reads — one clean
  path from messy support, the real panel B; (C) VCF breakend walk — decouples
  from read depth, SplitThreader's actual input. Additive: all three are just
  *sources* feeding the same sink, so ship A → B → C.
- **Off-screen anchor for single-region LGV panel A:** A1 baseline-drop vs A2
  edge-clamp vs A3 multi-region-only.
- **Aggregation scope:** visible-reads (main-thread, cheap, first cut) vs
  whole-region worker scan (a real fusion-finder — bigger RPC).
- **Whether Phase 3's breakend bridge is in scope** at all.

## Known minor findings noted along the way (not blockers)

- `PileupBezierOverlay` `onClick` always selects `arc.id1`
  (`PileupBezierOverlay.tsx` ~L92) — a multi-hop junction's `id2` endpoint is
  unreachable via click-select.
- `PileupBezierOverlay` vs `PileupBezierArcsSvg` are near-identical `<path>`
  maps; geometry is already shared, only interactivity differs. Fine to leave
  (repo's "duplication ok" stance); a shared `<BezierArcPath>` for the common
  attrs is optional.
- `arcIsVisible` (`computeOverlay.ts` ~L16) culls by endpoint Y only; a same-row
  bowed curve whose endpoints sit just off-screen (within the ~30px apex) can be
  dropped. Acknowledged in its comment; harmless.
