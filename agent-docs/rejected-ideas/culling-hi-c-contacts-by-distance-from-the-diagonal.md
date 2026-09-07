---
name: culling-hi-c-contacts-by-distance-from-the-diagonal
description: Culling hi-C contacts by distance from the diagonal
area: performance-and-measurement
---

# Culling hi-C contacts by distance from the diagonal

measured 2026-08-13
and declined. The rotated matrix hangs `width/2` px below the diagonal while
the track is `height` px tall (300 by default, `squashToHeight` off), so at
1500x300 only 64% of the triangle's AREA is on screen and at 2500x300 only
42%. Driving that bound through the RPC into `getBlockNumbers` — where a v9
file's blocks are indexed by depth from the diagonal — looks like a 2-3x cut
in fetch, decode, transfer and vertex load at once.
Contacts are not distributed by area. On `extra_test_data/test.hic` (hg19,
chr1, 100 kb) at 1500x300 the visible band holds **91.3%** of contacts
(maxDelta 997 bins), at 2500x300 **85.5%** — and **0 of 6** blocks fall
entirely below the band, so there is no read to skip. 9-15% of the contacts,
none of the network.
It also costs two things. The fetch would depend on display height, where
today a resize only repaints (`computeTriangleYScalar` says so); and a stale
matrix keeps drawing during the refetch debounce (at the time via
`renderTransform`'s rescale; since 2026-08-21 at its own genomic position),
so a culled one shows a flat-bottomed triangle for up to a second.
**What would change the answer:** a deep v9 map at a fine binsize, where
blocks are small enough that whole depth levels sit below the band. This file
is a 5 MB downsample with ~1000-bin blocks, so every block straddles the
boundary. Re-measure the block accounting, not the contact fraction, before
re-proposing.
