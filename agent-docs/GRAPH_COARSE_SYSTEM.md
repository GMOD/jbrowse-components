# Graph Coarsening System — Technical Description

Companion to `GRAPH_COARSE_DESIGN.md` (design decisions and phase plan),
`GRAPH_INDEX_FORMAT.md` (file format spec), and `GRAPH_PERF.md` (benchmarks).
This document describes the implemented system as it exists, what correctness
properties it holds, and what its limitations are.

---

## Problem statement

Pangenome graphs derived from HPRC minigraph-cactus (MC) alignments of 90
haplotypes have a mean segment length of approximately 34 bp. At that density,
a 1 Mbp region of GRCh38 chr20 contains approximately 30,000 segments. The
browser graph view (`plugins/graph`) cannot render or lay out a graph of that
size interactively; and even if it could, the resulting rendering would not
convey biologically meaningful structure at that zoom level.

The goal of the coarsening system is to produce a reduced representation of the
pangenome graph that:

- is keyed on reference coordinates so that tabix range queries can retrieve it;
- is computed entirely offline (at index build time, not at query time);
- does not require client-side graph computation;
- scales to HPRC-chromosomal inputs (tens of thousands of super-segments for a
  full chromosome, not millions).

---

## Why linear-chain contraction is not used

The classical graph-coarsening primitive for sequence graphs is linear-chain
contraction (implemented as `odgi unchop`, `vg mod -u`, and BandageNG
`mergeAllPossible`). It collapses maximal runs of degree-2 nodes — nodes with
exactly one predecessor and one successor — into single super-nodes, preserving
the graph as a topological minor.

This primitive is not viable for HPRC MC pangenomes. Measured on HPRC v1.1
mc-grch38 chr20 (1,859,947 segments; see `GRAPH_PERF.md`), `vg mod -u`
produces 1,842,238 super-segments — a 0.95% reduction. The gate for this step
required < 33% of the input count (< 620,000 super-segments). The gate fails.

The root cause is structural: MC pangenomes at 90 haplotypes have near-zero
degree-2 nodes. At this haplotype density, virtually every node borders a
variant site in at least one haplotype and therefore has bidirected degree > 2.
Linear-chain contraction requires degree-2 nodes; such nodes are absent in MC
graphs. The unchop algorithm is correct but the input has no chains to collapse.

This is in contrast to the use case for which unchop was designed: graphs that
have been artificially chopped to a fixed node length (e.g., for seeding), where
long haplotype-invariant stretches remain chainable. HPRC MC graphs were not
chopped; their short nodes reflect actual variant density.

---

## Implemented methods

Two coarsening methods are implemented in `tools/gfa-to-tabix/src/main.rs` and
are selectable via `--graph-coarse-method`:

### Method 1: coordinate-tile coarsening (`--graph-coarse-method tile`, default)

**Algorithm.** Walk the reference path step-by-step. Accumulate steps into the
current tile until the accumulated reference span reaches `tile_size` bp (default
10,000). Close the tile, record its reference interval `[refStart, refEnd)` and
the sorted, deduplicated set of constituent segment ordinals, then begin a new
tile. The final tile holds any remainder regardless of span.

The super-segment ID (`superOrd`) is defined as the minimum ordinal in the
tile's constituent set. This assignment is deterministic given a fixed ordinal
assignment in the input GFA.

**Output.** One BED row per tile per reference chromosome:

```
refChrom  refStart  refEnd  superOrd  type  constituentOrds
ctgA      0         10677   0         tile  0-112
ctgA      10677     20691   113       tile  113-231
```

`constituentOrds` uses range encoding (`lo-hi`) for contiguous ordinal runs and
comma-separated encoding for non-contiguous sets.

**Correctness properties (tile method).**

- **T-COMPLETE**: The union of `constituentOrds` across all tile rows for a
  given reference chromosome equals the set of all ordinals traversed by the
  reference path on that chromosome. Every reference-path ordinal appears in
  exactly one row.
- **T-DISJOINT**: For reference-path ordinals specifically, no ordinal appears
  in more than one tile. (Non-reference alt-allele ordinals that happen to share
  an ordinal assignment with a reference-path ordinal follow the same
  partitioning; ordinals not on the reference path are not represented in the
  tile index at all.)
- **T-DETERMINISTIC**: Given the same input GFA and the same preprocessor
  binary, the output is byte-identical. SHA256 of output verified on all tested
  fixtures.
- **T-CONTIGUOUS**: Tile boundaries on the reference path are gapless and
  non-overlapping. The `refEnd` of row `i` equals the `refStart` of row `i+1`.

**What the tile method does not claim.**

- It does not preserve graph topology within a tile. Segments from structurally
  distinct positions in the de Bruijn graph may be grouped into the same tile if
  they lie in the same reference coordinate window.
- It does not produce a graph minor or topological quotient of the input graph.
- It does not preserve haplotype-specific paths (walks) through the coarse tier.
  The coarse file records only the reference-path partition; alt-allele structure
  within a tile is not represented.
- The tile boundaries do not correspond to biologically meaningful features
  (e.g., gene boundaries, variant sites, repeat boundaries) unless they happen to
  fall at multiples of `tile_size`.

**Performance.** < 1 s on chr20 (1.86 M segments, 90 haplotypes). 6,188 tiles
at 10 kbp tile size. See `GRAPH_PERF.md`.

---

### Method 2: snarl-based coarsening (`--graph-coarse-method snarl`)

**Algorithm.** Invoke `vg snarls` on the input graph to enumerate all snarl
boundaries. Parse the JSON output via `vg view -R`. Retain only top-level snarls
(those with no parent in the snarl tree). For each top-level snarl, compute its
reference-coordinate span by mapping snarl boundary node IDs to their positions
on the reference path. Discard snarls whose reference span is less than
`--graph-coarse-min-sv-bp` (default 100 bp). Walk the reference path, emitting:

- `chain` rows for maximal backbone stretches between consecutive large snarls;
- `snarl` rows for each retained top-level snarl.

The `superOrd` for each row is the minimum ordinal in the step range, consistent
with the tile method.

**What `vg snarls` computes.** The snarl decomposition of Paten et al. (2018)
partitions a sequence graph into a hierarchy of ultrabubbles (and, when the
graph is non-acyclic, bridgeless components). Top-level snarls are those at the
root of this hierarchy. In the context of a pangenome graph, top-level snarls
correspond to the largest structural variation sites: inversions, translocations,
complex insertions. Backbone stretches between snarls are the collinear segments
where all haplotypes agree at the graph-topology level.

**Correctness properties (snarl method).**

- **S-COMPLETE**: Same as T-COMPLETE — all reference-path ordinals appear in
  exactly one row.
- **S-SNARL-FIDELITY**: Every row of type `snarl` corresponds to a top-level
  snarl in the `vg snarls` output for the same input, with reference span ≥
  `min-sv-bp`. No snarl rows are invented; none that meet the threshold are
  omitted (subject to the overlap-handling note below).
- **S-BACKBONE**: Every row of type `chain` corresponds to a maximal contiguous
  stretch of reference-path steps that lies between two consecutive large snarls
  (or between the chromosome start and the first large snarl, or between the last
  large snarl and the chromosome end).
- **S-NO-OVERLAP**: `vg snarls` guarantees that top-level snarls are
  non-overlapping (they are the children of the root in the snarl tree). The
  preprocessor additionally skips any snarl that begins before the current
  cursor position, handling edge cases from GFA paths that revisit nodes.

**What the snarl method does not claim.**

- Nested snarls (those with a parent) are not represented. The coarse tier
  captures only the top level of the snarl hierarchy.
- Snarls that are filtered out by `min-sv-bp` are absorbed into the enclosing
  backbone chain. Their presence as variant sites is not recorded in the coarse
  tier.
- Path-level walks through snarls are not emitted. The coarse tier records the
  snarl boundary ordinals, not the internal haplotype structure.

**Performance.** On chr20:
- GFA input: 6:27 wall time (fails the 5 min gate).
- `.vg` input (co-located file automatically preferred): 52 s (passes).

The preprocessor automatically uses a co-located `.vg` file (e.g., `input.vg`
alongside `input.gfa`) as input to `vg snarls` when one is present, because vg's
native binary format avoids GFA parsing overhead. Users can pre-generate with
`vg convert -g input.gfa > input.vg`. See `GRAPH_PERF.md`.

---

## Output format

Both methods emit `prefix.graph.coarse.bed.gz` (BGZF-compressed, tabix-indexed).
The format is:

```
# header lines (# prefix):
#schema=graph-coarse/v1
#engine=<tile|snarl>
#tile-size=<N>    (tile method only)
#min-sv-bp=<N>    (snarl method only)

# data rows:
refChrom  refStart  refEnd  superOrd  type  constituentOrds
```

All fields are tab-separated. `refChrom` is the chromosome or contig name
derived from the reference path's PanSN name by stripping the
`assembly#haplotype#` prefix. `refStart` and `refEnd` are 0-based half-open
coordinates on the reference path. `superOrd` is a uint32 segment ordinal
(namespace-shared with the detail tier, so drill-down requests can map directly).
`type` is one of `tile`, `chain`, or `snarl`. `constituentOrds` is a
comma-separated, range-encoded list of ordinals in the super-segment.

The file is indexed with `tabix -c '#' -p bed`, making comment lines transparent
to the tabix library. The index file is `prefix.graph.coarse.bed.gz.tbi`.

---

## Runtime adapter integration

`GfaTabixAdapter.getSubgraph` (in
`plugins/comparative-adapters/src/GfaTabixAdapter/GfaTabixAdapter.ts`) routes
on region size:

```
if (regionSize > 100_000 && graphCoarseFile configured) →
    query graph.coarse.bed.gz → return coarse GFA
else →
    existing per-segment detail path (unchanged)
```

The coarse GFA emits one `S` line per super-segment:
```
S  {superOrd}  *  LN:i:{refEnd - refStart}
```

`LN:i` is the reference-coordinate span of the super-segment (not the sum of
constituent segment sequences). No `L` lines (edges) or `W` lines (haplotype
walks) are emitted in v1. The coarse GFA is structurally valid but contains no
topology or path information — it is a flat list of nodes with reference-span
lengths, suitable for rendering as rectangles proportional to reference
coverage.

Reference name resolution follows the same `resolveTabixRefName` logic used for
all other tabix files: try `assemblyName#refName`, then bare `refName`, then the
reverse `assemblyNameMap` lookup. Because the coarse file uses bare chromosome
names (e.g., `ctgA`) rather than PanSN-qualified names, the bare-`refName`
branch is the typical match path.

---

## Applicability to pangenome graph structures

### PanSN naming is required

The preprocessor identifies the reference path by the `--ref-assembly` argument,
which is matched against the assembly component of PanSN-formatted path names
(`assembly#haplotype#contig`). Pangenome graphs that use arbitrary path names
without PanSN structure are not supported without manual specification of the
reference path name prefix.

### Chromosome splitting is not required, but is the recommended workflow

The preprocessor operates on a single GFA file at a time. It processes all
paths in that file and builds the coarse index anchored on the reference
assembly's paths. A whole-genome GFA file (all chromosomes in one file) can be
processed without modification: the resulting `graph.coarse.bed.gz` will contain
rows for all chromosomes, each tabix-queryable by chromosome name.

In practice, HPRC v1.1 data is distributed as per-chromosome GFA files (or can
be split with `vg convert`), and the existing `prepare-fixtures.sh` workflow
operates per-chromosome. The system does not impose a chromosome-split
requirement.

### Re-entering paths (segments visited multiple times by one path)

The tile method calls `dedup()` on ordinals within a tile, so if the reference
path revisits a segment, the ordinal appears once in the `constituentOrds` list.
The snarl method similarly uses `ord_to_rank` with `entry().or_insert` semantics
(first occurrence wins) to handle multi-visit segments. In both cases, T-COMPLETE
and S-COMPLETE hold for the de-duplicated ordinal set.

Pangenome graphs with inversion-traversing reference paths (where the reference
path visits segments in reverse orientation) may produce tiles or snarls that
span non-contiguous reference intervals. The BED row records `[refStart, refEnd)`
as the extent of the reference path steps grouped into that row; the interval
is correct but may span a region larger than the sum of constituent segment
lengths when orientation changes occur.

### Graphs without a designated reference path

If no path in the GFA matches the `--ref-assembly` prefix, no coarse rows are
emitted. The preprocessor does not fall back to any path as a reference; the
caller must specify one. This is consistent with the rest of the index (e.g.,
`synteny.bed.gz` is also reference-anchored).

### Fragmented haplotype contigs

HPRC chr20 haplotype contigs are fragmented (most < 500 kb). The coarse index
is anchored on the reference path (GRCh38) only. Haplotype-specific coordinate
ranges are not represented in the coarse tier. The C3 path-symmetry property
(querying the same locus from multiple reference paths yields the same subgraph)
does not hold for fragmented-contig chromosomes; see `GRAPH_PERF.md` for the
full finding. The coarse tier inherits this limitation — it is reference-path
anchored and does not claim symmetry across haplotype paths.

---

## Limitations summary

| Limitation | Scope |
|---|---|
| Tile topology is not preserved | Tile method |
| Alt-allele structure within tiles is not represented | Both methods |
| Nested snarls are dropped | Snarl method |
| No L-lines (edges) in coarse GFA | Both methods, v1 |
| No W-lines (haplotype walks) in coarse GFA | Both methods, v1 |
| Snarl method requires `.vg` input for chr20-scale speed | Snarl method |
| Region size threshold (100 kbp) is hardcoded | Runtime adapter |
| `constituentOrds` drill-down is not yet implemented in the adapter | Runtime adapter, v1 |
| Reference path must be PanSN-named | Both methods |
| Path-symmetry across fragmented haplotype contigs is not claimed | Both methods |
| Linear-chain contraction is not viable for HPRC MC graphs (0.95% reduction) | Not applicable to v1 |

---

## Cross-references

- `GRAPH_COARSE_DESIGN.md` — design decisions, phase plan, gate criteria.
- `GRAPH_PERF.md` — measured benchmarks (tile counts, wall times, gate pass/fail).
- `GRAPH_INDEX_FORMAT.md` — file format specification for all index files.
- `GRAPH_ARCHITECTURE.md` — end-to-end adapter pipeline.
- `tools/gfa-to-tabix/src/main.rs` — `compute_tile_rows`, `graph_coarse_build_tiles`,
  `graph_coarse_build_snarls`.
- `plugins/comparative-adapters/src/GfaTabixAdapter/coarseSubgraphReader.ts` —
  runtime BED row parser and GFA assembler.
- `plugins/comparative-adapters/src/GfaTabixAdapter/GfaTabixAdapter.ts` —
  `getSubgraph` routing and `getCoarseSubgraph`.
- Paten B, Eizenga JM, et al. "Superbubbles, Ultrabubbles, and Cacti for Genome
  Graphs." *Journal of Computational Biology* 2018 — canonical reference for
  `vg snarls` decomposition algorithm.
