---
name: circular-genomes-and-origin-spanning-features
description: A feature crossing a circular replicon's origin draws into virtual space, is unreachable at the origin, and core has no topology flag. Listing the contig twice in displayedRegions plus a circular adapter decorator covers the linear view; first count whether jb2hubs has origin-spanning features at all.
---

# Circular genomes and origin-spanning features

Split out of the data-formats collection on 2026-09-27. The number it waits on is whether jb2hubs serves any feature that crosses an origin, or only `Is_circular` contigs.

NCBI GFF3 encodes a feature that
crosses the origin of a circular replicon as a single line whose `end` runs past
the sequence length into "virtual space" (and flags the landmark with
`Is_circular=true`) — common in the bacterial/organellar/viral genomes we serve
from jb2hubs. Today this misrenders three ways: the feature draws into virtual
space past the contig end (best case clipped at the displayed-region edge); the
wrapped portion is unreachable at the origin (its tabix-indexed start sits near
the contig end, so a `0..N` query never returns it — and redispatch only expands
to bounds of features *already found*); and there's no topology flag anywhere in
core (`Region` is `refName/start/end/reversed` only; assembly/refseq have no
`isCircular`; the parsed `Is_circular` is inert). The polar picture exists: the
circular view draws any linear display as a ring warped from its strip
(ADR-119), so a one-contig circle with `spacingPx: 0` is a plasmid or organelle
map whose origin is the ring's seam, where the decorator below would make the
two halves of an origin-spanning feature abut. Its labels and highlights are
[a-ring-draws-its-displays-labels-and-highlights](../ready/a-ring-draws-its-displays-labels-and-highlights.md).
For the linear view, **repeated-linear concatenation** — the key unlock is that
`displayedRegions` *already is* linear concatenation (LGV space sums `Region[]`
end-to-end, each region carrying true coords), so listing the contig twice gives
the `2L` space, scroll-through-origin, and true-coordinate location box/search
*for free*. Seam-abutment: region1 `chr:0-L` + region2 `chr:0-L` with zero
`interRegionPadding` makes a `[L-1200, L+1200]` gene draw as `[L-1200,L]` +
`[0,1200]` halves that *touch* at the seam and read continuous (the one
unsolvable bit is a connector line crossing the seam — JBrowse never lays out one
glyph across a region boundary). The only real new code is a **circular adapter
decorator** (parameterized by `L`): re-emit any feature with `end > L` as two
halves, issue a modular wrap-fetch of `[L-margin, L]` when querying near the
origin (same muscle as `readTabixLinesRedispatched` in `packages/core/src/util/tabix.ts`), and key both halves
by canonical `pos mod L` so copies/halves reconcile. De-risk cheaply: **Step 0 is
zero code** — hand-set displayedRegions to the contig twice with seam padding
zeroed on pneumobrowse to eyeball the UX before building the decorator. Confirm
first whether jb2hubs has origin-*spanning features* or just `Is_circular`
contigs with no crossing genes (if the latter, this is purely a cosmetic origin
marker).
