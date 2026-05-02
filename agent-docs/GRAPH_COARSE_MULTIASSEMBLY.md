# Graph Coarse — Multi-Assembly Symmetric Design

> **Status: design (v2).** Supersedes the reference-biased v1 coarse tier described
> in `GRAPH_COARSE_DESIGN.md` "Revised plan" and `GRAPH_COARSE_SYSTEM.md`. v1
> implementation (tile + snarl methods, reference-path only) remains in the codebase
> as the starting point; this document describes what must change and why.

## Why v1 is insufficient

v1's `graph.coarse.bed.gz` is keyed on reference coordinates and processes only
the reference assembly's path. Two consequences:

- **Structural variants absent from the reference are invisible.** A 50 kbp CHM13
  insertion has zero span on the reference path; it fails the ≥ 100 bp filter and
  disappears from the coarse index entirely.
- **The view is not symmetric.** Switching the browsing assembly from GRCh38 to
  CHM13 produces an incorrect picture: GRCh38's deletions are not shown in CHM13
  space, and CHM13's insertions are not shown in GRCh38 space.

The user's stated goal: load the GFA tabix track once, browse from any assembly,
and see the correct structural variation picture relative to whichever assembly is
the current reference. Browsing GRCh38 should show CHM13's insertion as present;
browsing CHM13 should show GRCh38's deletion at the same locus.

## Design principle: the graph is the truth; the assembly is the query lens

Snarls are graph-level structures, defined by boundary nodes that exist independent
of any assembly. Every assembly path either traverses a given snarl (passes through
both boundary nodes) or does not. The span of a snarl on a given assembly's path is
that assembly's coordinate distance between the two boundary nodes — which may
differ substantially from the reference span.

The coarse index is therefore indexed per-assembly path, each row in that assembly's
coordinate space. Rows for the same snarl across different assemblies share a
graph-level `superOrd` (the ordinal of the snarl's entry boundary node). The
renderer groups rows by `superOrd` to find corresponding super-segments and draws
synteny links between them.

## Schema v2

```
#schema=graph-coarse/v2
#engine=snarl
#min-sv-bp=100
#assemblies=all          # or comma list of assembly names

pathChrom  pathStart  pathEnd  superOrd  type  hap_count  constituentOrds
```

**Field changes from v1:**

- `pathChrom` — PanSN path name of the assembly being indexed (e.g.,
  `grch38#chr20`, `CHM13#1#chr20`, `HG002#1#chr20`). Tabix query key. Replaces
  `refChrom`.
- `pathStart` / `pathEnd` — coordinates in that assembly path's space. For the
  reference assembly the values are identical to v1's `refStart`/`refEnd`; for
  other assemblies they reflect the actual span in that assembly's coordinates.
- `superOrd` — ordinal of the snarl's entry boundary node. Graph-level identifier;
  the same value appears on every assembly's row for the same snarl. For backbone
  chain rows, the ordinal of the exit boundary node of the preceding snarl (or 0
  for the first chain before any snarl). Deterministic and assembly-agnostic.
- `type` — `snarl` | `chain`. Tile type removed from v2; see "Tile method" below.
- `hap_count` — number of assembly paths in the index that traverse this snarl.
  Precomputed at index time. Same value on all rows for the same `superOrd`. Used
  by the renderer to color by conservation (e.g., a snarl private to 3/96
  haplotypes vs. one traversed by all 96).
- `constituentOrds` — the segments on **this assembly's path** through this
  super-segment (snarl or chain). Not a union across assemblies; per-path. Two
  assemblies with identical `constituentOrds` for the same `superOrd` share the
  same sequence path through that region. Two assemblies with different
  `constituentOrds` took different paths — structural variation.

**Example: CHM13 insertion invisible in v1, visible in v2**

A snarl with entry boundary at ordinal 42, spanning 50 kbp in CHM13 and ~0 bp
in GRCh38:

```
grch38#chr20    48000   48010   42   snarl   12   42,205        ← 10 bp, passes filter in grch38 space
CHM13#1#chr20   49000   99000   42   snarl   12   42,200-203,205 ← 50 kbp, passes filter in CHM13 space
HG002#1#chr20   48000   48010   42   snarl   12   42,205        ← same as grch38
```

Browsing GRCh38: query `grch38#chr20` → gets the 10 bp row. The 12 hap_count tells
the renderer 12/96 haplotypes traverse this snarl. Links to CHM13 rows with the
same `superOrd` show CHM13's large insertion.

Browsing CHM13: query `CHM13#1#chr20` → gets the 50 kbp row. The GRCh38 row with
the same `superOrd` has different `constituentOrds`, so GRCh38 is shown as taking
a shorter/absent path — a deletion in GRCh38 terms.

## Preprocessor changes (tools/gfa-to-tabix)

### Snarl computation (one-time, graph-level)

`vg snarls` runs once on the full GFA/VG and produces all top-level snarl boundary
pairs. This step is unchanged from v1. Result: a list of `(ord_A, ord_B)` pairs.

Relevant vendor: `~/src/vendor/vg/src/snarls.hpp`, `integrated_snarl_finder.hpp`.
The `-A integrated` algorithm produces the nested snarl tree used by `vg
deconstruct`; top-level snarls (`!snarl.has_parent()`) are the correct granularity
for the coarse tier.

### Per-assembly path iteration (new)

Currently `graph_coarse_build_snarls` iterates only paths where
`path.assembly == ref_assembly`. Change: iterate all paths (or the assembly
list from `--graph-coarse-assemblies`), running the same snarl-mapping logic per
path.

For each assembly path P:
1. Build `ord → path_offset` map from P's step list (first occurrence wins for
   re-entering paths, same convention as v1).
2. For each snarl `(ord_A, ord_B)`: if both are present on P, compute
   `span = |path_offset_B - path_offset_A|`. If span ≥ min_sv_bp, record as
   a large snarl on P.
3. Sort large snarls by position on P.
4. Emit backbone chain rows between consecutive large snarls on P, with chain
   constituent ordinals drawn from P's steps in that span.
5. Emit snarl rows for large snarls, with constituent ordinals drawn from P's
   steps between the two boundary nodes.
6. Paths that don't traverse a snarl's boundary nodes get no row for that snarl —
   correct behavior (assembly is absent from that snarl).

### hap_count computation

After all paths are processed, for each `superOrd` (snarl or chain), count how
many paths emitted a row for it. Store on every row before writing. This is
O(snarls × paths) in memory and trivially parallelizable.

### Flag changes

- `--ref-assembly` becomes optional when `--graph-coarse` is set. If omitted,
  all paths are processed. If set, only that assembly's rows are emitted (backward
  compatibility for the v1 use case).
- `--graph-coarse-assemblies <all|comma-list>` — explicit assembly filter (default
  `all`). Useful for building a single-assembly index for testing without the full
  HPRC dataset.
- `--graph-coarse-method` remains; `tile` method is now secondary (see below).

### Tile method status

The tile method remains in the codebase and emits `#schema=graph-coarse/v1-tile`
to distinguish it from the snarl-based v2. It is reference-biased by construction
(tiles are defined by fixed-size windows on the reference path) and is useful as:
- A fast smoke-test fixture when vg is not available
- A performance baseline for comparisons

For production multi-assembly use, the snarl method is required.

### Performance at HPRC scale

HPRC chr20: 96 assemblies. Estimate ~3,000–8,000 large snarls per assembly plus
~4,000 chain rows = ~7,000–12,000 rows per assembly. Total: ~700k–1.2M rows. At
~80 bytes/row, ~100 MB pre-compression, ~10–20 MB bgzipped. Within the 500 MB
publication gate.

Wall time: the `vg snarls` step is the bottleneck (~52 s on chr20 with `.vg` file).
The per-path iteration is O(n_assemblies × n_steps) and runs in-memory in Rust —
negligible compared to vg. Total expected: < 5 min for chr20.

Reference: `~/src/vendor/vg` `vg snarls -A integrated -t 4` for the snarl step.
`~/src/vendor/odgi` `odgi paths -H` (haplotype matrix) is an independent
cross-check for hap_count validation.

## TS adapter changes (plugins/comparative-adapters)

### Query routing

Currently `coarseSubgraphReader.ts` queries `graphCoarseLocation` with chrom =
the JBrowse assembly's chrom name (e.g., `chr20`). In v2 the chrom in the BED
file is a PanSN path name (`grch38#chr20`).

The adapter needs to construct the path name from the assembly config. Two options:
- **Option A**: store an assembly → GFA sample name mapping in the adapter config
  (e.g., `graphCoarseAssemblyName: "grch38"`). Preprocessor emits this in the JSON
  config sidecar.
- **Option B**: the preprocessor emits a `prefix.assembly_map.json` sidecar that
  maps `{gfa_sample_name: string, chroms: string[]}[]`. Adapter reads it once and
  builds the lookup.

Option B is more robust; the preprocessor already knows all assembly names from
the GFA W-lines. This sidecar can also inform the adapter about which assemblies
are present, enabling the MultiLGVSyntenyDisplay to offer a "load all assemblies"
option.

### Multi-assembly query loop

When `MultiLGVSyntenyDisplay` renders with N assembly rows, the adapter queries
the coarse BED once per assembly row (by its PanSN chrom). The returned rows for
each assembly are grouped by `superOrd` to identify corresponding super-segments.
Rows with the same `superOrd` across two assemblies are linked by synteny
connectors; absent `superOrd` means structural variation (one assembly has no path
through that snarl).

### Renderer color encoding

`hap_count` / total_assemblies gives a conservation fraction:
- 1.0 (all haplotypes share this path) → neutral/grey
- 0.1 (rare variant) → high-saturation color

This is a single additional column that the renderer reads directly; no runtime
computation needed.

## Validation plan

### Symmetry test (new invariant)

For any snarl with `superOrd = X` that appears in both assembly A and assembly B:

> Browsing assembly A, the link to assembly B shows the correct bp span in B's
> coordinates. Browsing assembly B, the link to assembly A shows the correct bp
> span in A's coordinates.

Mechanically: query coarse BED for `A#chrN` and `B#chrN`, join on `superOrd = X`,
assert `A_row.pathEnd - A_row.pathStart ≈ vg find --path A --node X span` and
same for B.

Oracle: `odgi position -r <assembly_path> -p <other_path>,<offset>` lifts a
position on one path to another. Use this to independently verify the span values
for a sample of snarls.

Reference: `~/src/vendor/odgi/src/subcommand/position_main.cpp`, `-b FILE` for
BED-format batch liftover.

### Insertion visibility test (targeted)

Identify a known CHM13-specific insertion in chr20 (can be found via
`vg deconstruct -p grch38#chr20` from `~/src/vendor/vg`). Verify:
- v1 index: no row for this snarl in GRCh38 coordinates (filtered out).
- v2 index: row present in `CHM13#1#chr20` coordinates with large span; row
  present in `grch38#chr20` coordinates with small/zero span.

### hap_count cross-check

For a sample of snarls, verify hap_count matches the count from
`odgi paths -H` (haplotype matrix): number of paths with a 1 in the snarl's
boundary node column.

### Scale gate (unchanged from v1)

- chr20 total rows across all assemblies < 2M.
- chr20 wall time (vg snarls + per-path iteration) < 5 min.
- bgzipped file size < 50 MB.
- Query at 1 Mbp region (any assembly) returns < 5k rows.

## What vendor tools contribute

| Tool | Role in this design |
|------|---------------------|
| `vg snarls -A integrated` | One-time global snarl decomposition. Boundary nodes define graph-level super-segment IDs. |
| `vg deconstruct -p` | Test oracle: generates per-assembly VCF of snarl traversals. Cross-check that our snarl row constituent_ords agree with vg's traversal records. |
| `odgi position -b` | Validation oracle: independent BED liftover between assemblies. Spot-check that pathStart/pathEnd in v2 rows match odgi's coordinate translation. |
| `odgi paths -H` | hap_count oracle: haplotype coverage matrix per node. Aggregate over snarl interior nodes to independently verify hap_count. |
| `odgi bin -n N` | Alternative tile method if local build is fixed. Semantically equivalent to coordinate tiling but uses odgi's path-aware binning. Not blocking. |
| `strangepg` | Reference for hierarchical coarsening algorithm design (adjacent-node merging with threshold). Informs v3 multi-tier design; not used in v2. |

## Open questions deferred to v3

- **Nested snarls.** v2 uses only top-level snarls. Drill-down click on a coarse
  snarl row could expand to its nested snarl children. Requires emitting the snarl
  tree (parent/child relationships from `vg snarls`). Deferred; v2 treats nested
  snarls as interior segments of their parent.
- **Chain topology (L-lines).** Chains in v2 have no edges between them in the
  emitted GFA. Adding edges at the coarse tier requires knowing adjacency between
  super-segments; straightforward to compute during the per-path iteration but
  deferred until v2 nodes render correctly.
- **Multi-resolution tiers.** If v2 at min_sv_bp=100 is still too dense at full-
  chromosome zoom, a second tier at min_sv_bp=1000 (fewer snarls) can be added
  as `prefix.graph.coarse.1kb.bed.gz`. Same schema; same code path with different
  parameter.
- **Assembly map sidecar.** Exact format TBD when implementing the TS adapter
  query routing. JSON is simplest; TSV is more tabix-adjacent.

## Implementation order

These land as sequential PRs, each gated:

**PR 1 — Schema v2 + per-assembly preprocessor**
- `graph_coarse_build_snarls` iterates all paths
- Adds `hap_count` column
- Changes chrom field to PanSN path name
- Emits `#schema=graph-coarse/v2` header
- New flag `--graph-coarse-assemblies`
- Gate: volvox fixture emits correct per-assembly rows; symmetry test passes on
  volvox; CHM13 insertion visibility test passes on chr20.

**PR 2 — Assembly map sidecar**
- Preprocessor emits `prefix.graph.coarse.assembly_map.json`
- Gate: JSON is present and lists all assemblies in the GFA.

**PR 3 — TS adapter v2 query routing**
- `coarseSubgraphReader.ts` reads assembly map, constructs PanSN chrom for query
- Multi-assembly row grouping by `superOrd`
- Gate: unit tests with hand-built rows pass; dogfood chr20 with both grch38 and
  CHM13 as reference shows correct picture.

**PR 4 — Renderer hap_count coloring**
- Color encoding from hap_count / total_assemblies
- Gate: visual inspection on chr20.
