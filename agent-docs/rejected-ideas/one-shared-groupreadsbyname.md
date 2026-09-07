---
name: one-shared-groupreadsbyname
description: One shared `groupReadsByName`
area: performance-and-measurement
---

# One shared `groupReadsByName`

measured 2026-08-11 and declined. The arc
overlay and the bezier connector overlay each bucket reads by QNAME into
`Map<name, entry[]>` and hand the lists to the same `resolveReadGroup`, so the
two eight-line loops look like an obvious extraction — the more so because
this plugin's scars are mostly "one meaning, two paths".

They differ only in the ENTRY they build: the arc path tags each with its
region's `refName` (it compares fetched segments against SA-tag/RNEXT ones, so
same-chromosome-ness is the arc-vs-tick decision) and the bezier path does not
(both ends are on-screen entries whose refName the overlay resolves at draw
time). Every way of varying that inside one function is priced per read, and
this loop runs over every fetched read:

| entry build                          | 200k reads, 8 regions |
| ------------------------------------ | --------------------: |
| object literal (what each does today)|                 1.00x |
| `{...source, readIdx}` spread        |            1.5 - 1.9x |
| `makeEntry(source, i)` callback      |            1.1 - 1.45x |

Interleaved A/B/C, order rotated per round, 25 rounds; absolute medians moved
a lot between runs (27-63ms for the baseline) so only the ratios are worth
quoting, and the spread's penalty is the one that reproduces every time.

The third option — one fixed entry type built by a literal inside the shared
function — is as fast by construction, but forces `refName` onto the bezier
path as a placeholder it structurally cannot fill. Paying a per-read property
write plus a dead field to deduplicate eight lines is not a trade worth making.

What DID share is the layer underneath: the per-entry accessors (`spanOf`,
`strandOf`, `flagsOf`, `clipAt`, `isSupplementary`) were duplicated in
`features/arcs/compute.ts` over the identical arrays, each re-spelling the
`readPositions` stride — under a comment about keeping that arithmetic in one
place. Those are exported from `readGroupConnections.ts` now and cost nothing,
being function calls either way.
