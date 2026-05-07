# Graph Coarsening — Design Contract

> **Status: Step 1 (preprocessor) and Step 2 routing implemented;
> browser dogfood pending.** Companion to `GRAPH_INDEX_FORMAT.md`
> (file format), `GRAPH_PLAN.md` (phasing), `GRAPH_COARSE_SYSTEM.md`
> (technical details), and `GRAPH_AUDIT.md` (oracles).

## TL;DR

> **Note: the original `odgi unchop` design was abandoned (0.95% node
> reduction on chr20). The v1 implementation uses tile + snarl methods.
> See `adr-014-linear-chain-contraction-abandoned.md` and "Implementation
> plan (v1)" below.**

**What.** A static-file index that lets the browser view a
megabase-scale subgraph as fast as it views a 100 kbp subgraph
today. No runtime coarsening compute on the client.

**How (v1 implemented).** The Rust preprocessor (`tools/gfa-to-tabix`)
groups reference-path steps into fixed coordinate windows (tile method)
or snarl-boundary intervals (snarl method) and emits
`prefix.graph.coarse.bed.gz`. The runtime adapter does a tabix range
query and assembles a GFA of super-segments.

**Why this is publication-grade.** The snarl primitive (`vg snarls`) is
from a peer-reviewed toolkit. Tile method uses reference-coordinate
binning analogous to `odgi bin`. The publication's contribution is the
static-file packaging + tabix integration, not a new algorithm.

**What doesn't work yet that this fixes.** `getSubgraph` at
megabase regions (chr20 1 Mbp → ~31 k segments × 90 paths). Today
the graph view caps at 100 kbp and falls back to flat synteny
rectangles. After Step 2, the graph view shows an actual graph at
megabase zoom.

**Steps:** Step 1 (preprocessor — done) → Step 2 (TS adapter — routing
done, browser dogfood pending) → Step 3 (snarl annotation; conditional)
→ Step 4 (synteny tier 2) → Step 5 (HPRC-scale validation; gates publication).

## Problem

`getSubgraph` at megabase regions on HPRC chr20 returns ~31 k segments
× 90 paths per Mbp. The browser stalls; the data is not visually
useful at that zoom anyway. The graph view today caps at 100 kbp and
falls back to flat synteny rectangles. We want a graph at megabase
zoom that preserves structural variation features.

`MultiLGVSyntenyDisplay` has the same problem in a different shape:
at Mbp+ zoom the per-block synteny rows are too dense to be useful;
it needs aggregated rectangles. A first tier
(`synteny.coarse.bed.gz`, 10 kbp gap merge) ships today; a second
chromosome-scale tier is needed.

## Non-negotiables

- **All coarsening is offline, in the Rust preprocessor.** Runtime is
  pure tabix lookups + minimum stitching. (See memory:
  `feedback_static_file_coarsening.md`.)
- **No new claim that fails on chr20.** The C3 path-symmetry
  weakening (`GRAPH_PERF.md` — chrM works, chr20 fails) is the
  precedent. Each new invariant names the data it holds on.
- **Two outputs, two views.** Graph view consumes a graph-shaped
  coarse file; synteny view consumes a rectangle-shaped coarse file.
  Don't conflate.

## Pinned dependencies

- `vg v1.69.0` (already pinned in `GRAPH_AUDIT.md`). Required for the
  snarl method; also for `vg deconstruct`.
- `odgi` is **not** a dependency. The original design used `odgi unchop`
  (linear-chain contraction); it was abandoned after measurement. See
  `architecture-decision-records/adr-014-linear-chain-contraction-abandoned.md`.

## Output 2: synteny coarse extension

Drives `MultiLGVSyntenyDisplay` at zoomed-out levels. Builds on
existing `synteny.coarse.bed.gz` (10 kbp gap merge).

### Decision: extend, don't replace

`synteny.coarse.bed.gz` ships today. The 10 kbp tier is sufficient
to ~5 Mbp zoom; full-chromosome zoom needs a coarser tier. Add one
more tier:

- `prefix.synteny.coarse.100k.bed.gz` + `.tbi` — same schema as
  `synteny.coarse.bed.gz`, gap threshold 100 kbp instead of 10 kbp.

Adapter dispatch (`getMultiPairFeatures`):

```
bpPerPx > 10000  → synteny.coarse.100k.bed.gz   (chromosome zoom)
bpPerPx > 1000   → synteny.coarse.bed.gz        (existing)
otherwise        → synteny.bed.gz               (existing)
```

Header bumped: `#schema=synteny-coarse/v2` (file unchanged at v1;
v2 declares the multi-tier family). `synteny.coarse.bed.gz` itself
stays v1 to avoid invalidating shipped fixtures.

### Per-tier invariant

- **C-SYNT-COARSE.** For any region, the union of ref-side
  intervals in tier T (10 kbp or 100 kbp) covers a subset of the
  detail tier's ref-side intervals; differences are due to gap
  merging only. **Oracle:** Rust unit test in
  `tools/gfa-to-tabix/src/main.rs` (already exists for tier 1 —
  `coarse_merges_small_gap`, `coarse_keeps_large_gap`,
  `coarse_identity_weighted`; extend to cover 100 kbp tier).

## Implementation plan (v1)

The original design used `odgi unchop` (linear-chain contraction) and was
abandoned after measurement (0.95% node reduction on chr20). Full decision
record in `architecture-decision-records/adr-014-linear-chain-contraction-abandoned.md`.

| Method | chr20 super-nodes | Wall time | Default |
|---|---|---|---|
| Tile (`--graph-coarse-method tile`) | 6,188 | < 1 s | Yes |
| Snarl (`--graph-coarse-method snarl`, with `.vg`) | TBD post-filter | 52 s | No |

### Step 1 — preprocessor (implemented)

`--graph-coarse` added to `tools/gfa-to-tabix/src/main.rs`. Both methods emit:

```
refChrom  refStart  refEnd  superOrd  type  constituentOrds
```
`type` is `tile`, `chain`, or `snarl`. `superOrd` = min constituent ordinal.

- **Tile** (`--graph-coarse-method tile`, default): walk reference path, group
  steps into `--graph-coarse-tile-size` bp windows (default 10,000).
- **Snarl** (`--graph-coarse-method snarl`): subprocess `vg snarls`; parse JSON
  via `vg view -R`; filter to ref-span ≥ `--graph-coarse-min-sv-bp` (default 100);
  emit snarl rows + chain rows between them. With a co-located `.vg`
  file (auto-detected): 52 s on chr20. Without: 6:27 — pre-generate with
  `vg convert -g input.gfa > input.vg`.

No `altOrds` or `identity` columns in v1. Links file deferred to v2 — v1
renders only node rectangles, no edge arcs.

### Step 2 — runtime adapter (routing implemented; browser dogfood pending)

`getSubgraph` routes `regionSize > 100_000` to the coarse file; config slots
added; tests green. Browser dogfood on chr20 not yet run — gate: 1 Mbp and
10 Mbp regions render in < 2 s. See `GRAPH_COARSE_SYSTEM.md` "Next steps".

### Steps 3–5

- **Step 3 (snarl annotation):** may be redundant since Step 1 snarl method
  already uses snarl boundaries — evaluate after Step 2.
- **Step 4 (synteny coarse 100 kbp tier):** see "Output 2" above.
- **Step 5 (HPRC-scale validation):** gates publication. Run preprocessor on
  all 24 HPRC chromosomes × 90 haplotypes. Gate: < 6 h wall, < 500 MB output,
  < 2 s render per Mbp.

## Cross-references

- `GRAPH_INDEX_FORMAT.md` — file format spec for all index files.
- `GRAPH_PLAN.md` — phasing master.
- `GRAPH_PERF.md` — perf benchmarks; Step 0 odgi spike numbers.
- `GRAPH_COARSE_SYSTEM.md` — technical description of the v1 coarse system.
- `GRAPH_COARSE_MULTIASSEMBLY.md` — v2 multi-assembly design.
- `GRAPH_ARCHITECTURE.md` — adapter pipeline; getSubgraph routing.
- `architecture-decision-records/adr-014-linear-chain-contraction-abandoned.md`
- `architecture-decision-records/adr-015-c3-cross-path-symmetry-claim-narrowed.md`
