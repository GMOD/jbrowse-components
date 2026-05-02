# Graph Coarsening — Design Contract

> **Status: design, not yet implemented.** This is the contract the
> Rust preprocessor changes and runtime adapter changes must satisfy.
> Pin disagreements here before writing code. Companion to
> `GRAPH_INDEX_FORMAT.md` (file format), `GRAPH_PLAN.md` (phasing),
> and `GRAPH_AUDIT.md` (oracles).

## TL;DR

**What.** A static-file index that lets the browser view a
megabase-scale subgraph as fast as it views a 100 kbp subgraph
today. No runtime coarsening compute on the client.

**How.** The Rust preprocessor (`tools/gfa-to-tabix`) runs
`odgi unchop` (linear-chain contraction) once at build time and
emits two new tabix-indexed BED files anchored on reference
coordinates. The runtime adapter does a tabix range query on the
appropriate file and assembles a GFA. That's it.

**Why this is publication-grade.** The coarsening primitive
(linear-chain contraction) is implemented identically in three
peer-reviewed tools — `odgi unchop`, `vg mod -u`, BandageNG
`mergeAllPossible`. We use one as the engine and validate against
all three. The publication's contribution is the static-file
packaging + tabix integration, not a new algorithm.

**What doesn't work yet that this fixes.** `getSubgraph` at
megabase regions (chr20 1 Mbp → ~31 k segments × 90 paths). Today
the graph view caps at 100 kbp and falls back to flat synteny
rectangles. After Step 2, the graph view shows an actual graph at
megabase zoom.

**Steps in order.** Step 0 (odgi spike, no commit) → Step 1 (Rust
preprocessor) → Step 2 (TS adapter) → Step 3 (snarls; conditional)
→ Step 4 (synteny tier 2) → Step 5 (HPRC-scale validation; gates
publication). Each step has explicit go/no-go gates.

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

These come from prior project decisions and from the user's
publication-readiness bar.

- **All coarsening is offline, in the Rust preprocessor.** Runtime is
  pure tabix lookups + minimum stitching. (See memory:
  `feedback_static_file_coarsening.md`.)
- **Lean heavily on vg + odgi subcommands** as the coarsening
  engines. The preprocessor orchestrates and packages; it does not
  reimplement primitives. This is the defensible publication framing
  — peer-reviewed primitives, novel packaging.
- **No new claim that fails on chr20.** The C3 path-symmetry
  weakening (`GRAPH_PERF.md` — chrM works, chr20 fails) is the
  precedent. Each new invariant below names the data it holds on.
- **Two outputs, two views.** Graph view consumes a graph-shaped
  coarse file; synteny view consumes a rectangle-shaped coarse file.
  Don't conflate.

## Pinned dependencies

- `vg v1.69.0` (already pinned in `GRAPH_AUDIT.md`).
- `odgi` — required for chain contraction. **New build-time
  dependency.** Pin to a specific release in
  `tools/gfa-to-tabix/README.md` and the audit harness; CI fails
  loudly if mismatched. Same discipline as the existing vg pin.
- `vg snarls` (subcommand of vg) for the optional snarl tier.

## Prior art and existing implementations

The graph-coarsening primitive we use (linear-chain contraction —
collapse runs of degree-2 nodes into a single super-node) has three
independent peer-reviewed implementations. The publication's
contribution is the static-file packaging on top, **not** the
primitive.

- **`odgi unchop`** — `~/src/vendor/odgi` (or the upstream package).
  Guarracino et al., *"odgi: understanding pangenome graphs"*,
  Bioinformatics 2022. C++ implementation built on
  libhandlegraph. Chosen as primary engine.
- **`vg mod -u`** (alias `vg mod --unchop`). vg's own chain
  contraction. Garrison et al., *"Variation graph toolkit improves
  read mapping by representing genetic variation in the
  reference"*, Nature Biotechnology 2018.
- **BandageNG `AssemblyGraph::mergeAllPossible`** —
  `~/src/vendor/BandageNG/graph/assemblygraph.cpp:1170`. UI:
  Edit → Merge all possible nodes. Test
  `tests/bandagetests.cpp:1331` asserts the merged node's
  sequence equals the concatenation of constituent sequences
  (sequence-preserving invariant).

### Concordance discipline

Each Phase A oracle compares against **all three** implementations
where feasible (BandageNG ships as a GUI but its `mergeAllPossible`
is reachable from the test harness). Concordance against three
independent implementations of the same primitive is a much harder
publication claim to attack than concordance against one. See
"Per-tier semantic invariants" below for how each invariant binds
to which oracles.

### Hierarchical / variation-site primitives (Phase C, deferred)

- **Snarl decomposition** — Paten, Eizenga, et al., *"Superbubbles,
  Ultrabubbles, and Cacti for Genome Graphs"*, Bioinformatics 2018.
  The canonical hierarchical decomposition of pangenome variation
  sites. Implementation: `vg snarls`. Used in Phase C (deferred).
- **Bubble detection** — Onodera et al. 2013. Earlier, simple
  bubbles only. Subsumed by snarl decomposition; not used.

### Visualization-side prior art (informs the synteny tier, not
the graph tier)

- **Sequence Tube Maps** — Beyer et al., *"Sequence tube maps:
  making graph genomes intuitive to commuters"*, Bioinformatics
  2019. Pangenome visualization with implicit per-zoom abstraction.
- **odgi sort + odgi viz** — 1D rasterized synteny visualization.
  Informs the `synteny.coarse.*.bed.gz` tier shape (Phase D), not
  the graph tier.

## Lossless vs. lossy coarsening (publication-grade boundary)

Linear-chain contraction is the **only** losslessly-coarsening
graph primitive in general. Anything that further reduces node
count must drop information. The publication should say so
explicitly:

- **Tier 1 (chain tier).** Lossless. Topology-preserving. Sequence-
  preserving. Drill-down to detail tier is exact.
- **Tier 2+ (snarl, coordinate aggregation, etc.).** Lossy by
  necessity. Each tier names what it preserves and what it drops.

The v1 design (Phase A + B) ships only the lossless tier. Lossy
tiers (Phase C, future) are gated on measurement, not assumed.

## Output 1: graph coarse file

Drives `getSubgraph` at megabase regions.

### File: `prefix.graph.coarse.bed.gz` + `.tbi`

Tabix-indexed, keyed on reference-path coordinates. One row per
super-segment, anchored at the ref interval the super-segment
covers.

```
refChrom  refStart  refEnd  superOrd  type  constituentOrds  altOrds  identity
```

- `refChrom` / `refStart` / `refEnd` — the ref interval (PanSN ref
  path name, half-open, 0-based) the super-segment occupies. Tabix
  query key.
- `superOrd:u32` — super-segment ID. **Must equal the smallest
  constituent ord** (deterministic, namespace-shared with the detail
  tier so drill-down clicks can request that ord range directly).
- `type:enum` — `chain` (linear-chain contraction; default) |
  `snarl` (Phase C, see below) | `chain_with_dropped_alt`
  (chain that absorbed bubbles below the SV threshold).
- `constituentOrds` — comma-separated or range-encoded
  (`lo-hi,lo-hi,…`) list of detail-tier ords this super-segment
  collapsed. Same encoding as `pos.bed.gz` ordinalRange column.
- `altOrds` — for rows of type `snarl` or `chain_with_dropped_alt`,
  the alt-allele ord ranges that were collapsed into the
  super-segment. Empty for plain `chain`.
- `identity:f32` — weighted mean identity (via `synteny.bed.gz` per
  ref bp) across all paths through this super-segment. Ranges
  `[0, 1]`.

Header lines (before BED rows):
- `#schema=graph-coarse/v1`
- `#engine=odgi-unchop` (or `odgi-normalize`, `vg-snarls`, etc. —
  records which primitive produced this file)
- `#engine-version=<odgi version string>`
- `#min-sv-bp=<int>` — the smallest bubble length preserved as its
  own super-segment; bubbles below this were absorbed into the
  enclosing chain.

### Companion: `prefix.graph.coarse.links.bed.gz` + `.tbi`

L-line (edge) data for the coarse tier. Schema mirrors
`edges.spatial.bed.gz`:

```
refChrom  refStart  refEnd  srcSuperOrd  tgtSuperOrd  srcOrient  tgtOrient
```

Anchored at the ref interval where the link occurs (= the gap
between adjacent super-segments along the ref path). Two rows per
bidirected edge, same orientation convention as the detail tier.

### Per-tier semantic invariants (testable)

- **C-COARSE-1 (chain preservation).** Each detail-tier ord maps to
  exactly one super-segment. Concatenating the constituent
  sequences of any super-segment in ref-path order yields the same
  bp string as concatenating the corresponding range of detail-tier
  segments. **Holds on:** all fixtures. **Oracles:**
  (a) byte-identical comparison against `odgi unchop` output
  round-tripped through `odgi flatten` per ref path;
  (b) topology comparison against `vg mod -u` output (super-segment
  count + adjacency must match);
  (c) BandageNG `mergeAllPossible` (run via the BandageNG test
  harness on the volvox fixture) — super-segment count + emitted
  sequence must match. (a) is the primary oracle; (b) and (c) are
  independence cross-checks.
- **C-COARSE-2 (topology preservation up to bubble threshold).**
  The coarse-graph topology, after re-expansion of every
  super-segment via its `constituentOrds`, is graph-isomorphic to
  the detail-tier topology *with all bubbles of total length <
  `min-sv-bp` collapsed into their enclosing chain*. **Holds on:**
  all fixtures. **Oracle:** Weisfeiler-Lehman canonical-form
  comparison (existing `tools/graph-truth-extractor/canonicalize.ts`
  harness) against `odgi unchop --threshold=<min-sv-bp>` (or
  equivalent `odgi prune` invocation, pinned in the build CLI).
- **C-COARSE-3 (deterministic ord assignment).** Re-running the
  preprocessor on the same input GFA + same odgi version produces
  byte-identical `prefix.graph.coarse.bed.gz`. **Holds on:** all
  fixtures. **Oracle:** SHA256 of output bytes. Wired into the
  preprocessor smoke test in CI.
- **C-NEG-COARSE.** Cross-path symmetry beyond what already holds
  for the detail tier is **not** claimed. (chr20 fragmented
  contigs: same chrM caveat as `GRAPH_PERF.md`.)

### What the user sees at each zoom (figure-caption material)

- **≤ 100 kbp (detail tier, unchanged).** Per-segment graph; every
  SNV visible.
- **100 kbp — 5 Mbp (chain tier).** Each node represents a
  contig-collinear chain ≥ `min-sv-bp` (default 100 bp). Bubbles
  below 100 bp are absorbed into chains. Bubbles ≥ 100 bp render as
  branching paths.
- **5 Mbp — full chromosome (chain tier, same data, panned).** Same
  representation; visual density depends on local SV density.

`min-sv-bp` is a single per-build parameter, not a per-tier knob.
Multi-tier coarsening is reserved for v2 (see "Open questions"
below) — v1 ships one tier and measures.

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

## Implementation plan — ordered next steps

Each step has an explicit **go/no-go gate**. Don't proceed past a
gate that doesn't pass. Each lettered phase below lands as one PR.

### Step 0 — odgi spike (no commit; ~half-day)

**Goal.** De-risk the choice of `odgi unchop` before any code.

**Actions.**

- Install pinned `odgi` locally; record version.
- Run `odgi unchop` on each existing fixture
  (`volvox_pangenome_50`, `hprc-v1.1-mc-grch38-chrM`,
  `hprc-v1.1-mc-grch38-chr20` if `~/chr20-test/` is present).
  Record: wall time, input GFA size, output GFA size, output
  S-line count, output L-line count.
- Sanity-check the output: every super-segment's sequence is the
  concatenation of its constituents' sequences? (compare against
  detail-tier ord ranges via `odgi paths` + manual spot-check on
  three random super-segments).
- Confirm `vg mod -u` agrees on output S-line count and topology
  on the volvox fixture.

**Go/no-go gate.**

- `odgi unchop` finishes on chr20 in < 30 min single-machine wall.
- chr20 super-segment count is < 1/3 of detail-tier segment count
  (otherwise the coarsening doesn't buy enough; revisit primitive
  choice).
- vg and odgi agree on volvox.

**No code lands at this step.** Numbers go in `GRAPH_PERF.md`
under a new "Step 0 odgi spike" subsection. If gates fail, file a
finding in `GRAPH_PLAN.md` and pick a different primitive (e.g.,
`vg simplify` or hand-rolled chain contraction in Rust).

### Step 1 / Phase A — graph coarse file (Rust + odgi orchestration)

**Goal.** Emit `prefix.graph.coarse.bed.gz` + `.links.bed.gz` from
the existing GFA input, using `odgi unchop` as the coarsening
primitive.

**Code changes.**

- `tools/gfa-to-tabix/src/coarse_graph.rs` — **new file.**
  Orchestrates `odgi unchop --threshold=<min-sv-bp>`, parses the
  output GFA, walks ref-path intervals, emits the two BED files.
  Sub-shells `odgi`; runs into a temp dir; cleans up.
- `tools/gfa-to-tabix/src/main.rs` —
  - Add `--emit-graph-coarse` flag (default off pre-publication;
    flip to on once Phase A lands).
  - Add `--graph-coarse-min-sv-bp <int>` flag (default 100).
  - Wire `coarse_graph::emit()` into the build pipeline; add the
    new files to the JSON config emitter (analogous to
    `synteny_coarse_bed` lines).
  - Add odgi version check + pin warn (mirror the existing vg
    check).
- `tools/gfa-to-tabix/README.md` — document odgi pin and the new
  flags.
- `tools/gfa-to-tabix/prepare-fixtures.sh` — add
  `--emit-graph-coarse` to fixture builds; the volvox fixture's
  build directory now ships these two new files.

**Tests.**

- `tools/gfa-to-tabix/src/coarse_graph.rs` Rust unit tests
  (mirror existing `merge_coarse` tests):
  - `coarse_chain_collapses_linear_run` — synthetic 5-segment
    linear path collapses to one super-segment with
    `constituentOrds=1-5`.
  - `coarse_chain_preserves_bubble` — synthetic bubble of length
    ≥ `min-sv-bp` survives as a separate super-segment.
  - `coarse_chain_drops_small_bubble` — bubble < `min-sv-bp`
    absorbed into chain; row type emitted as
    `chain_with_dropped_alt` with `altOrds` populated.
  - `coarse_super_ord_is_smallest_constituent` — deterministic ID
    rule.
  - `coarse_emits_links` — companion `.links.bed.gz` rows produced
    for each adjacency at the coarse tier; orientation matches
    bidirected partner convention.
- New audit harness wiring in `tools/graph-truth-extractor`:
  - `coarse-concordance.ts` — extracts the same region via
    (a) `odgi unchop --threshold=N | odgi extract` → canonicalize
    and (b) the coarse tabix file → reconstruct → canonicalize.
    Asserts WL-canonical-form equality (existing
    `canonicalize.ts`). One test per fixture
    (`volvox_pangenome_50`, `hprc-v1.1-mc-grch38-chrM`,
    optionally `chr20` gated behind a slow flag).
- Determinism smoke test: re-run preprocessor twice on volvox
  fixture, assert identical SHA256 of output bytes.

**Go/no-go gate.**

- All Phase A Rust unit tests green.
- `coarse-concordance.ts` passes on volvox + chrM.
- Determinism smoke test passes.
- chrM coarse-tier emission < 30 s; chr20 < 30 min single-machine.
- Numbers logged in `GRAPH_PERF.md`.

If concordance fails, do **not** patch the test — fix the
preprocessor or revise the design. Concordance is the publication
claim.

### Step 2 / Phase B — runtime adapter consumption (TS)

**Goal.** When `prefix.graph.coarse.bed.gz` is configured and
`regionSize > 100_000`, `getSubgraph` returns a coarse GFA built
from tabix lookups against the new file, not from the per-segment
extraction path.

**Code changes.**

- `plugins/comparative-adapters/src/GfaTabixAdapter/configSchema.ts`
  — add `graphCoarseLocation` + `graphCoarseIndex` slots; add
  `graphCoarseLinksLocation` + `graphCoarseLinksIndex`. Wire
  preprocessor `prefix:` shorthand to populate them from
  `prefix.graph.coarse.bed.gz` and `.links.bed.gz`.
- `plugins/comparative-adapters/src/GfaTabixAdapter/GfaTabixAdapter.ts`
  — open the new tabix files in the constructor (alongside
  `syntenyCoarseFile`).
- `plugins/comparative-adapters/src/GfaTabixAdapter/coarseSubgraphReader.ts`
  — **new file.** Pure I/O wrapper over the two tabix files.
  Functions:
  - `fetchCoarseSubgraphRows(region, files)` → returns the parsed
    super-segment rows + link rows for a region.
  - `coarseRowsToGfa(rows, links, region)` → assembles GFA text.
    Output uses `superOrd` directly as the GFA segment ID;
    `LN:i:` is computed from `refEnd - refStart` (chain) or sum
    of constituent + alt segment lengths (chain_with_dropped_alt,
    snarl). Walks: **deferred to v2** (see Open Questions).
- `plugins/comparative-adapters/src/GfaTabixAdapter/GfaTabixAdapter.ts`
  `getSubgraph` — new branch:
  ```
  if (regionSize > 100_000 && this.graphCoarseFile) {
    return getCoarseSubgraph(region, ...)
  }
  ```
  Existing per-segment path runs only for ≤ 100 kbp, unchanged.
- `plugins/graph/src/GraphGenomeView/model.ts`
  `loadFromTabixSubgraph` — remove the `regionSize > 100_000 →
  loadFromTabixLarge` short-circuit. Route everything through
  `GetSubgraph` RPC; the adapter chooses the tier. (Large-mode
  synteny rectangles via `GetSyntenyBlocks` stays as-is for the
  synteny-display flow but is no longer the graph view's
  fallback.)

**Tests.**

- `plugins/comparative-adapters/src/GfaTabixAdapter/__tests__/getSubgraph.test.ts`
  — extend existing volvox fixture (now shipping coarse files):
  - `coarse_route_at_megabase_region` — call `getSubgraph` at
    1 Mbp region, assert returned GFA has S-line count
    proportional to coarse rows (not per-segment count).
  - `coarse_no_dangling_l_lines` — every L-line endpoint is in
    the S-line set (mirrors existing detail-tier test).
  - `coarse_super_ord_in_constituent_range` — every super-segment
    `superOrd` equals min of its `constituentOrds`.
- `plugins/comparative-adapters/src/GfaTabixAdapter/coarseSubgraphReader.test.ts`
  — **new file.** Unit tests for the pure assembly function on
  hand-built row inputs (no I/O).
- `plugins/graph/src/GraphGenomeView/model.test.ts` — adapt the
  existing test that mocks `GetSubgraph` so it's still hit at
  1 Mbp (currently routes around it).

**Go/no-go gate.**

- Phase A tests stay green.
- New TS tests green.
- Manual chr20 dogfood: 1 Mbp, 5 Mbp, 10 Mbp regions load and
  render in < 2 s in the dev server. Screenshots captured.
- No regression in existing detail-tier (≤ 100 kbp) behavior.

If chr20 5 Mbp / 10 Mbp render is too dense to be visually useful
(measured, not opined), proceed to Step 3. If usable, ship and
stop. Step 3 is conditional, not assumed.

### Step 3 / Phase C — snarl tier (conditional on Step 2 measurement)

**Goal.** Annotate `chain_with_dropped_alt` super-segments and
emit a separate `snarl` super-segment for top-level snarls
identified by `vg snarls`. Lets the renderer color SVs by
snarl-type and supports drill-down click → expand snarl.

**Code changes (sketch only — pin in a future PR).**

- `tools/gfa-to-tabix/src/coarse_graph.rs` — pipe through
  `vg snarls --include-trivial=false`, intersect snarl boundaries
  with chain boundaries, emit `snarl` super-segments.
- `prefix.snarls.bed.gz` companion file: snarl tree (parent /
  child / depth). Reserved magic in `GRAPH_INDEX_FORMAT.md`.

**Tests.**

- `vg snarls` concordance: every emitted `snarl` row matches a
  top-level snarl in the `vg snarls` output for the same fixture.

Phase C is **not a v1 blocker**. Ship if Phase B's chain tier alone
is too dense at full-chr20 zoom (measured, not assumed).

### Step 4 / Phase D — synteny coarse 100 kbp tier (Rust)

**Goal.** Add the second synteny coarse tier for chromosome-scale
zoom in `MultiLGVSyntenyDisplay`.

**Code changes.**

- `tools/gfa-to-tabix/src/main.rs` `merge_coarse` — already takes a
  `max_gap` parameter. Call it twice with 10 kbp and 100 kbp; emit
  to `prefix.synteny.coarse.bed.gz` and
  `prefix.synteny.coarse.100k.bed.gz`.
- `plugins/comparative-adapters/src/GfaTabixAdapter/configSchema.ts`
  — `syntenyCoarse100kLocation` + `syntenyCoarse100kIndex` slots.
- `plugins/comparative-adapters/src/GfaTabixAdapter/GfaTabixAdapter.ts`
  `getMultiPairFeatures` — extend the existing dispatch:
  ```
  if (bpPerPx > 10000 && this.syntenyCoarse100kFile)
    → syntenyCoarse100kFile
  else if (bpPerPx > 1000 && this.syntenyCoarseFile)
    → syntenyCoarseFile
  else → syntenyFile
  ```

**Tests.**

- `tools/gfa-to-tabix/src/main.rs` Rust unit tests — extend
  existing `coarse_*` test pattern to assert tier-2 row count <
  tier-1 row count on a fixture with mixed gap distances.
- `plugins/comparative-adapters/src/GfaTabixAdapter/__tests__/syntenyAdapter.test.ts`
  — `adapter_coarse100k_fewer_rows` mirroring the existing
  `adapter_coarse_fewer_rows`.

**Go/no-go gate.**

- chr20 full-chromosome `MultiLGVSyntenyDisplay` renders in < 2 s.
- < 5 k rectangles total per haplotype on chr20 full view.

### Step 5 — HPRC-scale validation (gates publication submission)

**Goal.** Full HPRC v1.1 numbers, not just chr20. Reviewer-bait
question: does this work at the actual data scale you claim?

**Actions.**

- Run Step 1 (Phase A) preprocessor on full HPRC v1.1 (24
  chromosomes × 90 haplotypes). Record per-chromosome wall time,
  output size, super-segment count, links count.
- Run Step 2 (Phase B) browser smoke on a sample of chromosomes:
  chr1 (large, gene-dense), chr20 (existing fixture), chrY
  (small, hemizygous), chrM (already covered).
- All numbers land in `GRAPH_PERF.md` under a new
  "HPRC v1.1 graph-coarse benchmark" section.

**Go/no-go gate (publication-bar).**

- Total preprocessor wall < 6 hours single-machine.
- Total `prefix.graph.coarse.*` size < 500 MB across all
  chromosomes.
- Per-Mbp browser render < 2 s on the fastest tier.
- All four sample chromosomes render correctly (manual
  inspection; screenshots in publication SI).

If any number misses, file a perf TODO in `GRAPH_PERF.md`; do
**not** loosen the spec to fit. Submit numbers as they are; let
reviewers see the limit.

## Open questions (decisions deferred to spike)

- **Coarse W-lines (per-haplotype walks through the coarse
  graph).** v1 emits no W-lines on the coarse tier — the chain
  graph is haplotype-agnostic. Pro: smaller files, faster render.
  Con: no per-haplotype highlight at coarse zoom. **Plan:**
  measure user demand from Phase B browser smoke; add as a
  separate `prefix.graph.coarse.walks.bed.gz` companion if needed.
  Schema reserved in this doc, file not emitted in v1.
- **Multi-tier graph coarse.** v1 ships one chain tier. If chr20
  full-chromosome render still too dense, add a second tier
  (e.g., `min-sv-bp=1000`) under
  `prefix.graph.coarse.1kb.bed.gz`. **Decision:** measure
  first.
- **odgi vs `vg simplify`.** Both can do the chain contraction.
  odgi has better C++ tooling and a cleaner CLI for this exact
  operation. **Pinned: odgi.** Revisit if odgi proves unstable
  at HPRC scale.
- **Snarl tree depth in the coarse file.** Phase C — defer.

## What this design does NOT contribute

To pre-empt reviewer over-claim:

- It does not introduce a new graph-coarsening algorithm. Chain
  contraction is `odgi unchop`. Snarl decomposition is
  `vg snarls`.
- It does not introduce a new graph-similarity metric. Concordance
  is the existing WL canonical form
  (`canonicalize.ts` — same as the detail-tier audit).
- It does not change the detail-tier guarantees. The ≤ 100 kbp
  path is byte-identical to today.

The contribution is the static-file packaging that lets a browser
read coarse graph data via tabix range queries with no compute on
the client. That is the publishable claim.

## Revised plan after Step 0 spike (2026-05-01)

**Linear-chain contraction is off the table.** `vg mod -u` on chr20 gives 0.95%
reduction (1,842,238 / 1,859,947 nodes). Gate requires < 620K. Root cause:
HPRC MC pangenomes at 90 haplotypes have near-zero chainable (degree-2) nodes.
Full numbers in `GRAPH_PERF.md` "Step 0" section.

### Two replacement primitives measured

| Approach | chr20 super-nodes | Compression | Wall time | Semantic |
|---|---|---|---|---|
| Coordinate tiles, 10kb | 6,188 | 300x | < 1s | No — fixed windows |
| vg snarls GFA, top-level | 497,227 (unfiltered) | TBD | 6:27 | Yes — SV sites + backbone |

**Gate status (2026-05-01 measurement):**
- Tiles: 6,188 < 50,000 ✓; < 1 s ✓ → **PASS**
- Snarls: 6:27 > 5 min → **FAIL time gate** (unfiltered count also very high)

The snarl numbers in the original table (1,089 super-nodes, 32s) were
estimates, not measured values from actual `vg snarls` runs. The actual measurement
shows vg snarls takes 6:27 on chr20.gfa with the integrated algorithm.
Post-filter count (ref-span >= 100bp) is TBD.

### Resolution: tiles as v1 default

Tiles pass all gates and are implemented. Snarls (`--graph-coarse-method snarl`)
are available for all inputs. For chr20 scale, the snarl method automatically
uses the co-located `.vg` file if present, reducing wall time from 6:27 to 52 s
(PASS). Without `.vg`, users can pre-generate with `vg convert -g input.gfa > input.vg`.

**Threshold choice (tiles).** 10 kbp tile size → 6,188 super-nodes for chr20.

**Threshold choice (snarls).** 100 bp min span. Total top-level snarls for chr20:
497,227. Count after ≥ 100 bp filter: TBD (most snarls are SNPs < 100 bp).

### Revised steps

**Revised Step 1 (was Phase A).** New flag `--graph-coarse` added to
`tools/gfa-to-tabix/src/main.rs`. Two sub-approaches, both in Rust:

- **Snarl approach** (`--graph-coarse-method snarl`, default): Subprocess
  `vg snarls input.gfa > tmp.snarls.pb`; parse JSON via `vg view -R`; filter
  snarls with ref-span >= `--graph-coarse-min-sv-bp` (default 100); merge
  backbone runs between large snarls into chain super-segments. Emits
  `prefix.graph.coarse.bed.gz`.
- **Tile approach** (`--graph-coarse-method tile`): Walk reference path, group
  into `--graph-coarse-tile-size` bp windows (default 10000). No external tool
  needed. Emits `prefix.graph.coarse.bed.gz` with same schema.

Both use the same BED schema (compatible with Revised Step 2):
```
refChrom  refStart  refEnd  superOrd  type  constituentOrds
```
`type` is `snarl`, `chain`, or `tile`. `superOrd` = min constituent ordinal.
`constituentOrds` = range-encoded ordinal list (e.g. `1-5,7,9-12`).

No `altOrds` or `identity` columns in v1 — add in v2 once render quality is
measured.

Links file (`prefix.graph.coarse.links.bed.gz`) deferred to v2. Render the
graph using only node rectangles in v1; add edge arcs once the node layout
is validated.

**Gate (both methods must pass before Step 2):**
- chr20 super-node count < 50,000 (well under 620K; ~1k–12k expected).
- chr20 wall time < 5 min.
- volvox fixture: coarse nodes are a strict subset of detail-tier nodes
  (no invented ordinals).
- Determinism: re-run gives byte-identical output.

**Revised Step 2 (was Phase B).** TS adapter `getSubgraph` routes
`regionSize > 100_000` to the coarse file. Render as flat rectangles (no OGDF
layout) — same as large-mode synteny, but keyed on coarse ordinals, not
synteny blocks. Gate: chr20 1 Mbp and 10 Mbp render in < 2 s.

**Steps 3–5** unchanged from original plan (snarl annotation, synteny tier 2,
HPRC-scale validation). Step 3 (snarl tier) may now be redundant since Step 1
already uses snarls — evaluate after Step 2.

### odgi bin status

`odgi bin` in the local v0.9.4 build produces zero output on all inputs
(separate bug from unchop crash). Not usable until rebuilt. If a working build
is available, `odgi bin -n N` is an alternative to coordinate tiles —
equivalent semantics, proven tool. Not blocking Step 1.

## Cross-references

- `GRAPH_INDEX_FORMAT.md` — file format spec; updated by Phase A
  to add the two new file types and their schemas.
- `GRAPH_PLAN.md` — phasing master; updated with the four phases
  here.
- `GRAPH_PERF.md` — perf benchmarks; updated with HPRC numbers
  during the Phase 0 spike.
- `GRAPH_AUDIT.md` — historical record; new audits go to
  `GRAPH_COMPLETED.md` per its own status banner.
- `GRAPH_ARCHITECTURE.md` — adapter pipeline; Phase B updates the
  `getSubgraph` flow diagram.
- `GRAPH_COMPLETED.md` — running log of completed work; Phases A–D
  each get a closing entry.
