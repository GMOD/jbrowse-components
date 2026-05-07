# ADR-014: Linear-chain contraction abandoned; coordinate tiles and vg snarls adopted for graph coarsening

## Status

Superseded (decision recorded; original design retired)

## Context

The graph coarse tier needs to reduce ~1.86M segments (HPRC chr20) to a number
renderable interactively (gate: < 50k super-nodes). The initial design
(`GRAPH_COARSE_DESIGN.md` original plan) chose **linear-chain contraction**
(`odgi unchop`) as the coarsening primitive because:

- It is lossless: concatenating constituent sequences reconstructs the original.
- Three independent peer-reviewed implementations exist as validation oracles:
  - `odgi unchop` (Guarracino et al., *Bioinformatics* 2022)
  - `vg mod -u` (Garrison et al., *Nat. Biotechnol.* 2018)
  - BandageNG `AssemblyGraph::mergeAllPossible`
- The publication framing was "peer-reviewed primitives, novel static-file packaging."

A Step 0 spike was planned to de-risk this choice before any implementation.

## Decision

**Abandon linear-chain contraction.** Step 0 measurement on HPRC chr20
(1,859,947 segments, 90 haplotypes):

- `vg mod -u` wall time: 1 m 37 s ✓ (gate < 30 min)
- Output super-segment count: **1,842,238** — **0.95% reduction** ✗ (gate < 620k)

Root cause: at 90 haplotypes, virtually every node borders a variant site in
at least one haplotype, giving it bidirected degree > 2. Degree-2 nodes (the
only ones unchop can merge) are essentially absent. The algorithm is correct;
the input has no chains to collapse. See `GRAPH_PERF.md` "Step 0" for full
numbers.

Additionally, the local odgi v0.9.4 build had `unchop` crashing on all inputs
(libhandlegraph ABI mismatch). The backup oracle (`vg mod -u`) confirmed the
fundamental gate failure independently.

## Replacement: coordinate tiles (v1 default) and vg snarls (optional)

Two new methods implemented in `tools/gfa-to-tabix/src/main.rs`:

**Tile method** (`--graph-coarse-method tile`, default):
- Walk reference path, group steps into fixed N-bp windows (default 10,000 bp).
- chr20: 6,188 tiles, < 1 s wall time. Gate: PASS.
- No external tool needed beyond `tabix`/`bgzip`.
- Fast smoke-test fixture when vg is unavailable.

**Snarl method** (`--graph-coarse-method snarl`):
- Invoke `vg snarls` to find top-level snarl boundaries; filter to ≥ min_sv_bp
  reference span; emit snarl rows + chain rows.
- chr20 with `.vg` file (auto-detected): 52 s. Gate: PASS.
- chr20 GFA alone: 6:27. Gate: FAIL. Pre-generate with `vg convert -g input.gfa > input.vg`.
- Semantically meaningful: snarl boundaries correspond to structural variation sites.

The three-oracle validation approach (odgi/vg/BandageNG) no longer applies to
either replacement. The tile method is independently verifiable by inspection
(deterministic coordinate arithmetic). The snarl method uses `vg snarls` as the
single source of truth for snarl boundaries.

The lossless coarsening framing is also retired: both methods are lossy.
The tile method discards intra-tile topology; the snarl method discards nested
snarls below min_sv_bp. The publication claim is narrowed to "coordinate-binned /
snarl-structured coarsening with tabix range-query packaging."

## Consequences

- `odgi unchop` is not a build-time dependency; `odgi` is no longer pinned.
- `vg` remains pinned (v1.69.0) for the snarl method and for `vg deconstruct`.
- Schema `altOrds` and `identity` columns (planned for the odgi-based design)
  deferred to v2 — the tile method has no natural identity value per tile.
- BandageNG and the three-oracle concordance discipline are not used in v1.
- For v2 multi-assembly support, the snarl method is required (tiles are
  reference-biased; see `GRAPH_COARSE_MULTIASSEMBLY.md`).
