# Graph Coarsening System — Technical Description

Companion to `GRAPH_COARSE_DESIGN.md` (design decisions and phase plan),
`GRAPH_INDEX_FORMAT.md` (file format spec), `GRAPH_PERF.md` (benchmarks), and
`GRAPH_ARCHITECTURE.md` (end-to-end adapter pipeline).

---

## Problem statement

Pangenome graphs derived from HPRC minigraph-cactus (MC) alignments of 90
haplotypes have a mean segment length of approximately 34 bp. A 1 Mbp region of
GRCh38 chr20 contains approximately 30,000 segments. The browser graph view
(`plugins/graph`) cannot render or lay out a graph of that size interactively.

The coarsening system produces a reduced representation that:

- is keyed on reference coordinates for tabix range queries;
- is computed entirely offline at index build time;
- scales to HPRC-chromosomal inputs (thousands of super-segments per chromosome,
  not millions).

---

## Why linear-chain contraction is not used

Linear-chain contraction (`odgi unchop`, `vg mod -u`) collapses degree-2 nodes
into single super-nodes, preserving the graph as a topological minor. Measured
on HPRC v1.1 mc-grch38 chr20 (1,859,947 segments), `vg mod -u` yields
1,842,238 super-segments — 0.95% reduction. The design gate required < 33% of
input count. Gate fails.

Root cause: at 90 haplotypes, virtually every node borders a variant site in at
least one haplotype, giving it bidirected degree > 2. Degree-2 nodes (the input
required by unchop) are essentially absent. HPRC MC graphs were not chopped to a
fixed node length; their short nodes reflect natural variant density, not an
artifact of a chopping step. See `GRAPH_PERF.md` for full measurements.

---

## What the coarse tier actually produces (v1)

**Critical framing.** The v1 coarse GFA has no L-lines (edges) and no W-lines
(haplotype walks). It is a flat list of S-lines — one per coordinate window or
snarl — with `LN:i` set to the window's reference span. The graph view renders
this as a row of proportional-width rectangles, not as a graph with topology.
Calling this "graph coarsening" is accurate in the sense that graph nodes are
grouped into super-nodes, but the output suppresses all graph connectivity.

This is a deliberate v1 choice: validate that the coordinate partition and the
runtime routing work correctly before adding edge emission. L-lines and W-lines
are deferred to v2 (see Next steps).

---

## Implemented methods

Two coarsening methods are in `tools/gfa-to-tabix/src/main.rs`, selectable via
`--graph-coarse-method`:

### Method 1: coordinate-tile coarsening (default, `--graph-coarse-method tile`)

**Algorithm.** Walk the reference path step-by-step. Accumulate steps into the
current tile until the accumulated reference span reaches `tile_size` bp (default
10,000). Close the tile, record `[refStart, refEnd)` and the sorted,
deduplicated set of constituent ordinals from those steps, then begin a new tile.
The final tile holds the remainder regardless of span.

`superOrd` is the minimum ordinal in the tile's constituent set — deterministic
given a fixed ordinal assignment, which is established by the preprocessor's
S-line encounter order and is shared with `pos.bed.gz`, `seglens.bin`, and all
other index files.

**Invariants (tile method).**

- **Per-step assignment**: each reference-path step is assigned to exactly one
  tile. This is the invariant the algorithm actually enforces — no step is
  counted twice or omitted.
- **Contiguity**: `refEnd` of tile *i* equals `refStart` of tile *i*+1. Verified
  on all fixtures.
- **Determinism**: same input GFA + same preprocessor binary → byte-identical
  output. SHA256 verified on all fixtures.

**Important caveat — re-entering reference paths.** If the reference path visits
the same segment at two distinct genomic positions (e.g., an inverted repeat),
that segment's ordinal appears in the `constituentOrds` of each tile that
contains a step visiting it. It is NOT guaranteed that each ordinal appears in
exactly one tile. This is observable in the volvox fixture: ordinals 644 and 645
appear in both the tile covering 30891–41996 and the tile covering 41996–50001.
The per-step assignment guarantee holds; the per-ordinal uniqueness guarantee
does not, for re-entering paths.

**`constituentOrds` and drill-down.** The column is designed to support future
interactive expansion: a user clicking a coarse super-segment could request the
detail tier for those ordinals directly from `pos.bed.gz` and `seglens.bin`,
transitioning to per-segment resolution. This is not implemented in v1. When
implemented, the re-entrant ordinal case must be handled — the same ordinal
appearing in two tiles means it maps to two coordinate windows, and expanding
one tile should show only the segments at that tile's coordinates, not the
other occurrence.

**What the tile method does not claim.**

- Graph topology within a tile is not preserved. Segments from structurally
  distinct positions in the variation graph may be grouped if they lie in the
  same coordinate window.
- It does not produce a graph minor or quotient of the input graph.
- Alt-allele segments (ordinals visited only by non-reference paths) are absent
  from the coarse index entirely.
- Tile boundaries do not correspond to biologically meaningful features.

**Performance.** < 1 s on chr20 (1.86 M segments, 90 haplotypes). 6,188 tiles
at 10 kbp tile size. See `GRAPH_PERF.md`.

---

### Method 2: snarl-based coarsening (`--graph-coarse-method snarl`)

**Algorithm.** Invoke `vg snarls` on the input graph; parse JSON output via
`vg view -R`. Retain only top-level snarls (no `parent` field in the JSON).
Map each top-level snarl's boundary node IDs to their first occurrence on the
reference path to compute a reference-coordinate span. Discard snarls with span
< `--graph-coarse-min-sv-bp` (default 100 bp). Walk the reference path emitting:

- `chain` rows for chains between consecutive large snarls;
- `snarl` rows for each retained top-level snarl.

`superOrd` is the minimum ordinal among steps in the row's range.

**What `vg snarls` computes.** The snarl decomposition (Paten, Novak, Eizenga,
Garrison. *J. Comput. Biol.* 2018) partitions a bidirected sequence graph into
a snarl tree: an alternating hierarchy of snarls (variation sites delimited by
boundary nodes) and chains (linear sequences of nodes and snarls between
consecutive snarl boundaries). Top-level snarls are direct children of the root
chain — the largest structural variation sites not enclosed by any other snarl.
The `vg snarls` subcommand is part of the variation graph toolkit (Garrison,
Sirén, Novak, Hickey, et al. *Nat. Biotechnol.* 2018).

**Invariants (snarl method).**

- **Per-step assignment**: same guarantee as the tile method. Each reference-path
  step is assigned to exactly one row. The cursor-based walk over sorted snarl
  intervals ensures non-overlapping coverage.
- **Snarl fidelity**: every `snarl`-type row corresponds to a top-level snarl in
  the `vg snarls` output with reference span ≥ `min-sv-bp`. No rows are
  invented; no qualifying snarls are omitted (subject to the overlap-skip note
  below).
- **Chain completeness**: every `chain`-type row is a maximal stretch of
  reference-path steps lying between two consecutive large snarls or between a
  chromosome endpoint and the first or last large snarl.

**Caveats.**

- The preprocessor maps snarl boundaries to reference coordinates using
  first-occurrence of each boundary node ordinal on the reference path. If the
  reference path revisits a boundary node (re-entering path), the snarl is mapped
  to the first occurrence only — the second traversal may be silently absorbed
  into an adjacent chain row.
- `vg snarls` guarantees top-level snarls are non-overlapping in the graph.
  After coordinate projection, two snarls whose boundary nodes are close together
  on the reference path could produce overlapping intervals; the preprocessor
  skips any snarl interval that starts before the current cursor and logs the
  skip to stderr.
- Nested snarls (those below the root level) are not represented.
- Snarls filtered by `min-sv-bp` are absorbed into adjacent chains with
  no record of their existence.
- The count of chr20 top-level snarls after the ≥ 100 bp filter has not been
  measured; only the pre-filter count (497,227) is known.

**External tool dependency.** Snarl method requires `vg` (v1.69.0; see
`GRAPH_INDEX_FORMAT.md` for the versioning policy). The tile method requires
only `tabix` and `bgzip`.

**Performance.** chr20 GFA: 6:27 (fails the 5 min gate). With a co-located
`.vg` file (auto-detected): 52 s (passes). Pre-generate with
`vg convert -g input.gfa > input.vg`. See `GRAPH_PERF.md`.

---

## Output format

```
#schema=graph-coarse/v1
#engine=<tile|snarl>
#tile-size=<N>       (tile method only)
#min-sv-bp=<N>       (snarl method only)

refChrom  refStart  refEnd  superOrd  type  constituentOrds
```

Tab-separated BED. `refChrom` is derived from the reference path's PanSN name
by stripping `assembly#haplotype#`. `refStart`/`refEnd` are 0-based half-open
reference coordinates. `superOrd` shares the ordinal namespace of `pos.bed.gz`
and `seglens.bin` (assigned in S-line encounter order during the preprocessor's
single-pass GFA parse). `type` is `tile`, `chain`, or `snarl`.
`constituentOrds` is a comma-separated, range-encoded ordinal list.

Indexed with `tabix -c '#' -p bed`. Index file: `prefix.graph.coarse.bed.gz.tbi`.

**Distinction from `synteny.coarse.bed.gz`.** The synteny coarse file merges
*haplotype alignment blocks* from `synteny.bed.gz` for `MultiLGVSyntenyDisplay`.
The graph coarse file merges *graph segments* for `getSubgraph` (the graph view).
Both are tabix-indexed and reference-anchored; they carry different content and
serve different consumers. See `GRAPH_ARCHITECTURE.md`.

---

## Runtime adapter integration

`GfaTabixAdapter.getSubgraph` routes on region size:

```
regionSize > 100_000 && graphCoarseFile configured
    → query graph.coarse.bed.gz → coarse GFA (flat S-lines, no L/W)
else
    → per-segment detail path (unchanged)
```

The 100,000 bp threshold is hardcoded. The two paths produce structurally
compatible GFA (same header, same S-line format) but diverge at the detail tier:
the coarse path returns super-segment ordinals (`superOrd` values from the coarse
file), while the detail path returns individual segment ordinals.

The coarse GFA:

```
H  VN:Z:1.1
S  {superOrd}  *  LN:i:{refEnd - refStart}
...
```

`LN:i` is the tile's reference-coordinate span. For a linear reference path with
no overlapping segment junctions this equals the sum of the constituent segment
sequence lengths; in practice a 1 bp discrepancy is observed in the volvox
fixture, likely from boundary-segment junction handling. For re-entering paths
(T-REENTER), `LN:i` reflects the tile's coordinate window, not the total
sequence the reference path visits within it.

Reference name resolution uses the same `resolveTabixRefName` logic as all other
tabix files. The coarse file uses bare contig names (e.g., `ctgA`), so the
bare-`refName` branch is the typical match.

---

## Applicability

### PanSN naming

The reference path is identified by `--ref-assembly` matched against the
assembly component of PanSN path names (`assembly#haplotype#contig`). Non-PanSN
path names are not supported without manual prefix specification.

### Chromosome splitting

Not required. A whole-genome GFA produces a multi-chromosome `graph.coarse.bed.gz`
queryable by contig name. In practice, HPRC data is distributed per-chromosome
and `prepare-fixtures.sh` operates per-chromosome; this is workflow convention,
not a system constraint.

### Graphs without a reference path

If no path matches `--ref-assembly`, no rows are emitted. Consistent with the
rest of the index (`synteny.bed.gz`, `pos.bed.gz` are all reference-anchored).

### Fragmented haplotype contigs

The coarse index is anchored on the reference path only. The C3 path-symmetry
property does not hold for fragmented-contig chromosomes such as HPRC chr20
haplotypes. See `GRAPH_PERF.md` for the full chr20 path-symmetry finding.

---

## Limitations

| Limitation | Scope |
|---|---|
| v1 output has no L-lines or W-lines — no graph topology, no haplotype paths | Both methods, v1 |
| Per-ordinal uniqueness fails for re-entering reference paths (e.g., volvox ordinals 644–645) | Both methods |
| Alt-allele segment ordinals are absent from the coarse index | Both methods |
| Tile boundaries are coordinate-fixed, not biologically meaningful | Tile method |
| Nested snarls (below root level) are not represented | Snarl method |
| Snarl boundary nodes revisited by the reference path are mapped by first occurrence only | Snarl method |
| Post-filter snarl count for chr20 (≥ 100 bp ref-span) is unmeasured | Snarl method |
| Snarl method requires vg (v1.69.0); chr20 scale requires co-located `.vg` for < 5 min wall time | Snarl method |
| Region size threshold (100 kbp) is hardcoded in the runtime adapter | Runtime |
| `constituentOrds` drill-down to the detail tier is not implemented | Runtime, v1 |
| Reference path must use PanSN naming | Both methods |
| Linear-chain contraction is not viable for HPRC MC pangenomes | Background |

---

## Next steps

The immediate gate for the current implementation (Revised Step 2 of
`GRAPH_COARSE_DESIGN.md`) is a browser dogfood test: chr20 at 1 Mbp and 10 Mbp
must render in < 2 s. This has not yet been run. Steps in order:

**Step 2 gate (pending).** Start the dev server against a chr20 GFA-tabix index
with `graph.coarse.bed.gz` configured. Navigate to a 1 Mbp and 10 Mbp region.
Confirm render time < 2 s and that the coarse S-lines produce visible rectangles.
Capture screenshots for `GRAPH_PERF.md`.

**Step 2 extension — L-lines (edges).** The coarse file currently has no edges.
For the graph view to show any topology at coarse zoom, the preprocessor must
emit `prefix.graph.coarse.links.bed.gz` (deferred from v1; schema defined in
`GRAPH_COARSE_DESIGN.md`). Without L-lines, the coarse graph view is
topologically identical to the synteny view. Whether this is acceptable depends
on the Step 2 dogfood result.

**Constituentords drill-down.** When the user clicks a coarse super-segment,
the adapter should re-query the detail tier (`pos.bed.gz`, `seglens.bin`) for
the ordinals in `constituentOrds` and transition to per-segment resolution. This
requires handling the re-entrant ordinal case (T-REENTER) — the drill-down must
use the tile's `[refStart, refEnd)` as the coordinate scope, not the ordinal set
alone, to avoid fetching segments from the wrong occurrence.

**Snarl post-filter count.** The chr20 snarl count after filtering to ≥ 100 bp
reference span is TBD. This number determines whether the snarl method produces
a useful number of super-segments (expected: far fewer than 497,227 because most
HPRC top-level snarls are SNP-scale). Measure and record in `GRAPH_PERF.md`.

**Synteny coarse 100 kbp tier (Phase D).** A second tier of `synteny.coarse.bed.gz`
at 100 kbp gap threshold for chromosome-scale `MultiLGVSyntenyDisplay` zoom.
Independent of the graph coarse work. See `GRAPH_COARSE_DESIGN.md` Step 4.

**HPRC-scale validation (Step 5).** Run the preprocessor on all 24 HPRC
chromosomes. Record per-chromosome wall time, output size, and super-segment
count in `GRAPH_PERF.md`. Browser smoke test on chr1, chr20, chrY, chrM. Gate:
total preprocessor wall < 6 h, total output size < 500 MB. This gates
publication submission.

---

## Prior art

**Coordinate-binned pangenome visualization.** `odgi bin` (Guarracino et al.
*Bioinformatics* 2022) bins graph nodes into fixed-size coordinate windows along
a reference path for 1D visualization. The tile method here is conceptually
equivalent but differs in output (tabix-indexed BED for interactive range queries
vs. TSV for static whole-graph matrix output) and consumer (per-region browser
query vs. `odgi viz` whole-graph rasterization).

**Snarl decomposition.** Paten, Novak, Eizenga, Garrison. "Superbubbles,
Ultrabubbles, and Cacti for Genome Graphs." *J. Comput. Biol.* 2018. Canonical
reference for the algorithm implemented in `vg snarls`. Used here without
modification as an upstream dependency.

**The vg toolkit.** Garrison, Sirén, Novak, Hickey, et al. "Variation graph
toolkit improves read mapping by representing genetic variation in the reference."
*Nat. Biotechnol.* 2018. `vg snarls` and `vg convert` are subcommands of this
toolkit.

**sequencetubemap tabix branch.** Jean Monlong's per-region GFA extraction
(scripts `pgtabix.py` and `chunkix.py` in `~/src/sequencetubemap`) uses a
tabix-indexed `pos.bed.gz` for the same reference-anchored extraction pattern.
The `GfaTabixAdapter` detail tier follows this pattern directly; the coarse tier
is a new addition not present in sequencetubemap. See `GRAPH_INDEX_FORMAT.md`
for a field-by-field format comparison.

---

## Cross-references

- `GRAPH_COARSE_DESIGN.md` — design decisions, phase plan, gate criteria, Step 0
  spike narrative ruling out linear-chain contraction.
- `GRAPH_PERF.md` — measured benchmarks; chr20 path-symmetry finding; Step 2
  dogfood results (pending).
- `GRAPH_INDEX_FORMAT.md` — file format spec for all index files; sequencetubemap
  format comparison.
- `GRAPH_ARCHITECTURE.md` — end-to-end adapter pipeline; getSubgraph flow
  including the coarse routing added in v1.
- `tools/gfa-to-tabix/src/main.rs` — `compute_tile_rows`, `graph_coarse_build_tiles`,
  `graph_coarse_build_snarls`, `emit_coarse_row`.
- `plugins/comparative-adapters/src/GfaTabixAdapter/coarseSubgraphReader.ts` —
  `parseCoarseLine`, `coarseRowsToGfa`.
- `plugins/comparative-adapters/src/GfaTabixAdapter/GfaTabixAdapter.ts` —
  `getSubgraph` routing, `getCoarseSubgraph`.
- `plugins/comparative-adapters/src/GfaTabixAdapter/__tests__/getSubgraph.test.ts` —
  integration tests for the coarse route (4 new tests).
- `plugins/comparative-adapters/src/GfaTabixAdapter/__tests__/coarseSubgraphReader.test.ts` —
  unit tests for `parseCoarseLine` and `coarseRowsToGfa`.
