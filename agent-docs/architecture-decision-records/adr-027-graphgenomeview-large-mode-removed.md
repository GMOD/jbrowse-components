# ADR-027: `GraphGenomeView` "large mode" is removed

## Status

Accepted (2026-05-14)

## Context

`GraphGenomeView` is the Bandage-style 2-D graph view of a selected locus. It
shipped with **two modes**, selected by region size in `doSubgraphLoad`:

- **Detail mode** (`regionSize ≤ 100,000`) — `GetSubgraph` extracts a real
  subgraph, lays it out with OGDF, and renders an actual graph.
- **Large mode** (`regionSize > 100,000`) — `loadFromTabixLarge` calls
  `GetSyntenyBlocks`, and `LargeModeSyntenyCanvas.tsx` draws colored rectangles
  per synteny block. Not a graph. The model carries `largeModeRegion` and
  `syntenyBlocks` state purely for this path.

Large mode existed for one reason: the original extraction path (`odgi extract`
over a custom binary index) was too slow for big regions, so rather than show
nothing, the view fell back to a degraded, non-graph rectangle rendering.

Two things make large mode both unnecessary and actively confusing:

- **`vg find` extraction is fast.** 0.7 s @ 10 kb, 0.9 s @ 100 kb
  (`GRAPH_PERF.md`). The detail path is sub-second across the entire range
  large mode was meant to cover. The slowness that justified the fallback is
  gone.
- **It overlaps with `MultiLGVSyntenyDisplay`.** Under the new architecture
  (`GRAPH_PLAN.md`), linearized synteny at all scales is
  `MultiLGVSyntenyDisplay`'s job. A "draw synteny rectangles instead of a
  graph" mode *inside the graph view* duplicates that display and gives the
  same view two unrelated behaviors depending on zoom.

## Decision

**Remove large mode.** `GraphGenomeView` has exactly one mode: `vg find`
subgraph extraction → OGDF layout → graph render.

Past a size cap — the existing 100 kb threshold, now a hard cap rather than a
mode switch — the view shows a **"zoom in to view graph"** message instead of a
degraded rectangle rendering. Large-region and full-genome synteny is
`MultiLGVSyntenyDisplay`, a separate display the user opens deliberately.

The 100 kb number is retained (it matches `vg find`'s sub-second envelope), but
it is no longer a *mode boundary* — there is only one renderer, and above the
cap the view declines rather than degrading.

## Consequences

- Removed: `plugins/graph/src/GraphGenomeView/components/LargeModeSyntenyCanvas.tsx`,
  `loadFromTabixLarge`, the `largeModeRegion` and `syntenyBlocks` model fields,
  the `GetSyntenyBlocks` RPC call from `GraphGenomeView`, and the large-mode
  branch in `GraphGenomeView.tsx`.
- `doSubgraphLoad`'s `regionSize > 100,000` branch becomes a "zoom in to view
  graph" status message — it no longer calls `loadFromTabixLarge`.
- `clearGraph` loses its `largeModeRegion` / `syntenyBlocks` resets along with
  the fields.
- Clear division of labor, no overlap:
  - **`GraphGenomeView`** — on-demand 2-D graph of one locus, ≤ size cap.
  - **`MultiLGVSyntenyDisplay`** — linearized synteny at every scale,
    full-genome.
- `GetSyntenyBlocks` as an RPC may still be used by `MultiLGVSyntenyDisplay`;
  only `GraphGenomeView`'s use of it is removed. Confirm before deleting the
  RPC method itself.
- Matches the user's hard requirement that the graph view be **one mode** with
  no size-dependent behavior the user has to reason about.

## Cross-references

- `agent-docs/GRAPH_PLAN.md` "GraphGenomeView — one mode" — the target design.
- `agent-docs/GRAPH_PERF.md` "Graph-server backend perf" — the `vg find`
  latency numbers that make a single fast mode viable.
- `agent-docs/architecture-decision-records/adr-024-untangle-replaces-synteny-build.md`
  — establishes `MultiLGVSyntenyDisplay` as the linearized-synteny display.
