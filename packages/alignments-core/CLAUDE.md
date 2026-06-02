# CLAUDE.md — alignments-core

## Performance: avoid allocation in the coverage compute paths

The coverage compute functions (`computeCoverage`, `computeSNPCoverage`,
`computeInterbaseCoverage`, `downsampleMinMax`, the `*Stats` reducers) run in
the RPC worker over every read in a region — thousands of reads, and the
per-position loops can run for every covered base pair. Treat these as hot
paths:

- **No per-position/per-iteration allocations.** Don't introduce arrays,
  iterators, or closures inside the bucket/segment loops. The A/C/G/T and
  insertion/softclip/hardclip segment blocks are deliberately **unrolled**
  rather than written as a `[a,c,g,t].entries()` loop — a literal-array `.entries()`
  allocates a fresh array + iterator per position. Verbose-but-zero-alloc wins
  here over DRY.
- Pre-size typed arrays and fill by index; prefer `subarray` over `slice` so the
  underlying buffer stays transferable.
- Pulling a shared helper out of a loop is fine **only** if it adds no
  per-element allocation (e.g. `bumpInterbase` just iterates an input array).

## Coverage coordinate contract

All positions in and out are **absolute genomic uint32** (exact at 3 Gbp); no
region-relative arithmetic crosses the worker boundary. `computeCoverage` always
starts depth bins at `regionStart` — a read starting left of the region still
contributes via the sweep line, so there is no leftward extension; only the
right edge extends (up to one region-width) for reads overhanging `regionEnd`.
