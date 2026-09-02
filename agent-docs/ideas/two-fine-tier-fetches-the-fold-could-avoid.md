---
name: two-fine-tier-fetches-the-fold-could-avoid
description: Two places still read the fine PIF tier across a whole genome now that the coarse fold is walkable — the region launch's mate discovery passes no lodMode, and a synteny view's tier resolves off the min bpPerPx of both rows so one zoomed-in row forces a genome-wide fine fetch. Measure both on a real hub file before building; the second wants the bidirectional fetch.
---

# Two fine-tier fetches the fold could avoid

Filed 2026-09-02 out of the PIF coarse-tier handoff. Both are waste, not
wrong output, and both were judged measure-first: the wire table in
[reference/SYNTENY_LOD.md](../reference/SYNTENY_LOD.md) gives the whole-genome
cost per tier on hs1 vs mm39, and the number to establish is how often each
path is hit at a zoom where the fold would have served.

## The region launch reads the fine tier genome-wide

`LaunchSyntenyView/executeDiscoverMates.ts` passes no `lodMode`, so mate
discovery for a region launch fetches the fine tier. With the fold walkable
(ADR-104) it could serve coarse past the threshold. On hs1 vs mm39 that is on
the order of 64 MB per launch. Measure: count bytes for a launch at
whole-genome and at a 1 Mb region, fine vs coarse, on the hosted file, before
threading `lodMode` through.

## One zoomed-in row forces a whole-genome fine fetch

`LinearSyntenyDisplay.lodTier` resolves off `min(bpPerPx)` of the two rows, so
a whole-genome top row against a zoomed-in bottom row fetches the fine tier
across the genome. A follow that zooms one row past the threshold flips the
tier the same way (documented). A per-axis tier needs the bidirectional fetch
behind `bidirectionalFetch` ([two-axis-synteny-fetch.md](two-axis-synteny-fetch.md)),
so each row can be served at its own tier and joined on `syntenyId`. Measure
on a real hub file how often the two rows straddle the threshold before
building it.

Related and already parked: LGVSyntenyDisplay reads its tier off live
`bpPerPx` inside `rpcProps`, so a threshold crossing mid-gesture clears every
region's held data —
[discrete-zoom-thresholds-in-rpc-props.md](discrete-zoom-thresholds-in-rpc-props.md).
