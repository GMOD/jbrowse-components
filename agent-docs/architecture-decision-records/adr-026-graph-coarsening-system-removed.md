# ADR-026: The graph coarsening system is removed (supersedes adr-014)

## Status

Accepted (2026-05-14). Supersedes adr-014, which itself superseded the
original linear-chain-contraction design.

## Context

The graph effort assumed that viewing a pangenome zoomed out far enough would
overwhelm the renderer — ~1.86 M segments on HPRC chr20 — and therefore needed
a precomputed *coarse tier*: fewer, larger super-nodes for the wide view, with
the detail graph reserved for close zoom.

That assumption drove a long design lineage:

- The original design chose **linear-chain contraction** (`odgi unchop`) as the
  coarsening primitive.
- **adr-014** abandoned linear-chain contraction (0.95 % reduction on chr20 —
  at 90 haplotypes nearly every node borders a variant site) and adopted
  **coordinate-tile** and **vg-snarl** coarsening, emitting
  `prefix.graph.coarse.bed.gz`.
- A later **tile-pyramid** refinement added multi-resolution
  `prefix.tiles.<stride>.{bin,idx}` files (TILB/TILI magic) consumed by
  `gfaCoarsener.ts`.

At runtime this was a whole subsystem: `getCoarseSubgraph`,
`coarseSubgraphReader.ts`, `gfaCoarsener.ts`, a `graphCoarseLocation` config,
and a `regionSize > 100,000` routing branch in `getSubgraph`.

The pivot to `odgi untangle` (adr-024) **invalidates the founding assumption.**
untangle blocks are resolution-independent:

- 24,376 blocks for the *entire* HPRC chr20 at the clean-output recipe
  (`-j 0.5 -m 1000`), median block 10.6 kb.
- A tabix range query returns only the blocks intersecting the view.

A whole chromosome is 24 k features. There is no "too many features to render
at zoom-out" problem — the coarse tier was solving a problem the untangle data
model does not have.

## Decision

**Remove the graph coarsening system entirely.** No `graph.coarse.bed.gz`, no
tile pyramid, no `--graph-coarse-method`, no `getCoarseSubgraph`, no
`graphCoarseLocation`. `MultiLGVSyntenyDisplay` reads one tabix-indexed
untangle PAF at every zoom level — it behaves like any other JBrowse track.

Visually merging adjacent collinear blocks at extreme zoom-out is a
**render-time** concern: `odgi untangle -m` is baked low/0 (adr-024) and the
renderer merges blocks at draw time. It is not a precomputed file.

This retires the whole lineage — `unchop`, coordinate tiles, vg snarls, the
tile pyramid. adr-014's "coordinate-binned / snarl-structured coarsening with
tabix packaging" publication framing is dropped; there is no coarsening left to
frame.

## Consequences

- Removed from `tools/gfa-to-tabix`: `--graph-coarse-method`,
  `--graph-coarse-min-sv-bp`, the tile and snarl coarseners, the tile-pyramid
  emitter, and the `prefix.graph.coarse.bed.gz` / `prefix.tiles.*` outputs.
- Removed from the runtime: `coarseSubgraphReader.ts`, `gfaCoarsener.ts`,
  `getCoarseSubgraph`, the `graphCoarseLocation` config slot, `largeMode.test.ts`,
  and the `regionSize > 100,000` coarse-routing branch in `getSubgraph`.
- `vg snarls` is no longer a build-time dependency *for coarsening*. `vg` is
  still pinned — `vg deconstruct` needs it (adr-025), `vg find` needs it
  (adr-027).
- The graph-coarsening design docs (`GRAPH_COARSE_DESIGN.md`,
  `GRAPH_COARSE_SYSTEM.md`, `GRAPH_COARSE_MULTIASSEMBLY.md`) and the custom
  index-format spec (`GRAPH_INDEX_FORMAT.md`) are deleted — this ADR is the
  surviving record of that design.
- The user's hard requirement of **"no tier concepts the user has to think
  about"** is now met *structurally*: there is one file and one mode, so there
  is no tier to expose.
- **adr-014 is fully superseded.** Its tile/snarl replacement decision no
  longer holds; neither does the original unchop decision it replaced.

## The surviving principle

adr-014 and its successors were also expressing a real, still-valid principle:
**do not re-derive graph topology on every runtime query — precompute once on
the preprocessing machine.**

That principle is preserved, honored differently. The "precompute once" is now
the single whole-graph `odgi untangle` run (~1 m 39 s on chr20, see
`GRAPH_PERF.md`); the runtime is a pure tabix range query over the resulting
PAF. Same discipline — pay the cost once, off the critical path — without a
multi-resolution file format.

If render performance at extreme zoom-out ever becomes a problem, the fix is
render-time block merging or a feature cap, **not** a new precomputed
coarse-tier / LOD file format.

## Cross-references

- `agent-docs/architecture-decision-records/adr-014-linear-chain-contraction-abandoned.md`
  — the design this supersedes.
- `agent-docs/architecture-decision-records/adr-024-untangle-replaces-synteny-build.md`
  — the pivot that invalidated the coarse-tier premise.
- `agent-docs/GRAPH_PERF.md` "Step 0" / "Revised Step 1" — the coarsening
  benchmarks, now historical.
