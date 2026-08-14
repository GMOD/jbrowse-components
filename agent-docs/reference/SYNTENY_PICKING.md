---
name: synteny-picking
description: How synteny hover/click picking actually performs, measured. The pick index is a 1D hull index, so its cost is governed by hull WIDTH rather than instance count — which makes it near-free on two related genomes and useless on all-vs-all data at any zoom past whole-genome. Read before quoting the "<0.01ms hover" figure or re-tuning MAX_PAN_SKEW_PX.
---

# Synteny picking, measured

`syntenyPickEngine.ts` answers a hover by stabbing a `flatbush` index of
per-instance **x-hulls** and testing what comes back exactly. Two facts about
that shape drive everything below, and neither is obvious from the code:

- **The index is 1D.** A box is `[minX, 0, maxX, 1]`; the y extent is constant
  because a ribbon always spans the whole track height. So the only thing that
  can discriminate is horizontal extent.
- **A synteny instance's hull is `[min, max]` over corners on BOTH axes.** A
  ribbon joining query 1 Mb to target 900 Mb has a hull spanning that whole
  distance, however narrow the alignment is at either end.

Together those mean the index discriminates well exactly when alignments are
**collinear** (a ribbon goes roughly straight down, so its hull is about as wide
as the alignment) and not at all when they are not.

## The measurement

300k instances, lengths `200 * exp(rnd * 9)`, 1400px canvas, 3.1 Gbp axes,
**viewport parked mid-genome**, min of N. One arm each — these locate a
mechanism and are not speedups; see [BENCHMARKING.md](BENCHMARKING.md).

Two fixtures, differing only in how query and target are paired:

- **collinear** — target within ±100 kb of query. Two related genomes.
- **random pairing** — target uniform over the genome. An all-vs-all PAF.

`kept` is how many instances survive the pickable-width exclusion (`≥1px` on
either axis) and therefore enter the tree.

### Collinear — the index works

| zoom | kept | candidates @0 skew | warm pick | rebuild |
| --- | --- | --- | --- | --- |
| whole-genome | **0** / 300k | — (no tree) | — | 77ms |
| 1/100 | 143k | 16 | 0.03ms | 201ms |
| 1/10k | 299k | 19 | 0.03ms | 396ms |
| 1/1M | 300k | 17 | 0.03ms | 347ms |

Candidate counts stay in the tens at every zoom, because a hull is about as wide
as its alignment and only a handful cover any given pixel.

### Random pairing — the index does not

| zoom | kept | candidates @0 skew | warm pick | rebuild |
| --- | --- | --- | --- | --- |
| whole-genome | **0** / 300k | — (no tree) | — | 70ms |
| 1/100 | 143k | **71,342** | **64ms** | 278ms |
| 1/10k | 299k | **149,307** | **134ms** | 496ms |
| 1/1M | 300k | **149,583** | **135ms** | 504ms |

**At zero skew.** Roughly half of everything in the tree covers any given x,
because half the hulls span the canvas. The stab returns them, and each one then
pays `projectCorners` + `isRibbonCulled` (which rejects it) at ~0.9µs.

## Two things this corrects

**"Hover went 192ms → under 0.01ms" is a whole-genome-zoom figure, and does not
generalize.** It is true and it is the case that was optimized — at whole-genome
zoom essentially every ribbon is sub-pixel, so `kept` is **0**, there is no tree,
and the hover is answered by a cached "nothing here". One zoom step in, `kept`
jumps to ~half the instances and the wide-hull case above is what you get. The
exclusion did not make picking fast; it made the *sub-pixel* case free.

**Skew is not what costs, on the data where picking is slow.** Widening the stab
by 500,000px takes the wide-hull 1/100 case from 71,342 candidates to 107,961 —
a 1.5× change for a 350×-canvas skew. `MAX_PAN_SKEW_PX` therefore cannot be
tuned against that arm, and the old justification in its comment (which cited
"~10k candidates at 100px, ~125k at 2000px") described neither arm; it predated
the exclusion, when the tree held every instance.

The collinear arm is the one that governs it, and there growth is ~1 candidate
per px of skew:

| skew | candidates | warm pick |
| --- | --- | --- |
| 250px | 287 | 0.39ms |
| 1000px | 1052 | 1.1ms |
| 5000px | 5084 | 8.9ms |
| 20000px | 20250 | 22ms |

Against a ~200ms rebuild paid once versus a widened query paid per mousemove,
2000px is the balance point: ~2ms/query, inside a frame, amortizing over ~100
hovers before the rebuild would have been cheaper.

## Probing this yourself, and the trap in it

**Park the viewport mid-genome.** Probing near cumBp 0 lets the widened stab
interval run off the left edge of the data, which caps candidate growth for a
reason that has nothing to do with the index — the first run of this measurement
reported candidates saturating at 718 regardless of skew, and that number is an
artifact of the probe, not a property of the tree.

**Do not take min-of-N over a loop that reuses the pick cache.** The first rep
rebuilds and stores the index *at the skewed pan*; every later rep then finds it
usable and answers warm. The min is therefore the warm cost, and a rebuild that
is happening on every real pan is invisible. Measure the rebuild with a fresh
cache per rep.

**`kept` is not `instanceCount`.** The exclusion is scale-dependent, so the same
fixture is an empty tree at whole-genome zoom and a full one two steps in. Any
statement about picking cost has to name the zoom.

## What is NOT worth trying against the wide-hull case

A tighter cap, a bigger `flatbush` node size, or pushing `minAlignmentLength`
into `filterFn` — none of them touch it, because the candidates are not being
admitted by slop. They genuinely cover the stab point; the hull is simply not a
selective key for a ribbon whose two ends are far apart. Fixing that means
indexing something other than the hull (per-axis intervals, tested pairwise), and
that is a design change rather than a tuning one. Nobody has costed it.
