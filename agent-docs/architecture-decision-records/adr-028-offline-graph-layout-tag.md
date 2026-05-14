# ADR-028: Offline graph layout as a GFA segment tag; node-count limit replaces the bp cap

## Status

Accepted (2026-05-14). Rewritten same-day after critical review — see
"Rejected alternatives" for the first draft's separate-sidecar design and why
it was dropped before any implementation.

## Context

`GraphGenomeView` computes its 2-D layout by sending the extracted subgraph
GFA to the `GraphComputeLayout` RPC, which runs OGDF FMMM (a Bandage-style
force-directed layout) in a worker. adr-027 made this the *only* mode and
capped usable regions at **100 kb of reference span** — past that the view
shows "zoom in to view graph".

Cross-referencing established pangenome tools (`agent-docs/GRAPH_PLAN.md`,
"Cross-reference: PangyPlot / BubbleGun") surfaced two problems:

- **The 100 kb cap is arbitrary and measures the wrong thing.** The cost that
  forced a cap — FMMM layout time — scales with *node count*, not reference
  span. A dense 10 kb region across 90 haplotypes can contain far more nodes
  than a sparse 1 Mb region. A bp cap declines the cheap case and admits the
  expensive one. Bandage and PangyPlot both limit by graph size.
- **Live FMMM is non-deterministic.** Force-directed layout gives different
  coordinates every run; `refetchIfNeeded` re-runs it on session restore and
  overlapping regions get unrelated layouts. PangyPlot (the published prior
  art) computes `odgi layout` (SGD) **once, offline, for the whole graph** and
  bakes the coordinates into its index — every subgraph view is then a
  coordinate *lookup*, stable across regions and free of per-view layout cost.

Two facts about the existing code make the right design small:

- **PangyPlot stores layout coordinates as columns on the segment record.**
  `pangyplot/db/sqlite/segment_db.py`: the `segments` table is
  `(id, gc_count, n_count, length, x1, y1, x2, y2, seq)`. Coordinates are an
  *attribute of the segment*, alongside length and sequence — not a separate
  file.
- **`GfaTabixAdapter.getSubgraph` already reads a flat per-ordinal binary and
  already emits segment tags.** It reads `seglens.bin` (4 bytes/ordinal) over
  the contiguous ordinal range of the subgraph and emits
  `S\t<ord>\t*\tLN:i:<len>` lines (`GfaTabixAdapter.ts` ~430-443).

## Decision

### 1. Offline layout travels as an optional GFA segment tag

Layout coordinates are carried on the `S` line as an optional tag — e.g.
`S\t<ord>\t*\tLN:i:<len>\tLO:Z:<x0,y0,x1,y1>` (exact tag spelling and float
encoding are an implementation detail; a `Z` string of comma-joined floats
needs no GFA parser change, integers or reduced precision cut payload size).

Layout becomes **just another segment annotation, exactly like `LN` and `dp`**,
which `convertGFAToGraph` already reads. This generalises across *every*
`getSubgraph` source with one wire convention:

- `GfaTabixAdapter` emits it from the per-ordinal binary (below).
- `graph-server` / `GfaServerAdapter` may emit it (run or serve `odgi layout`).
- A hand-authored or odgi-emitted GFA file may carry it.
- `vg find` output simply does not — which trips the fallback automatically.

`getSubgraph`'s return type stays `string`. No new RPC, no new model-facing
config slot, no change to the shared adapter interface.

### 2. Storage: widen the existing per-ordinal binary, no new file

`seglens.bin` is already the per-ordinal segment-attribute binary the adapter
reads. Widen its record from 4 bytes (`length: u32`) to 20 bytes
(`length: u32`, `x0,y0,x1,y1: f32`) — the flat-binary equivalent of
PangyPlot's columns-on-the-segment storage. The adapter reads the same
contiguous ordinal range it already reads; it just gets coordinates with the
lengths. The file is renamed for honesty (it is no longer only lengths); the
`preProcessSnapshot` prefix derivation and the config slot carry over.

`odgi layout` requires its input graph to be sorted and id-compacted and emits
two coordinate pairs per segment (start, end point) — so the node id *is* the
ordinal and maps directly to the binary's record index. This adds no new
constraint; id-compaction is already mandatory for `odgi layout`. The one
implementation risk is that the GFA-serving path must emit node ids that match
the binary's ordinals — preprocessing must layout and serve *the same*
id-compacted graph.

### 3. The model: read the tag, else fall back to FMMM

`parseGFA` already parses optional tags. `parseAndLayout` reads the layout tag
off the parsed segments; if present for the subgraph's nodes it builds
`LayoutResult` directly and **skips the `GraphComputeLayout` RPC**; if absent
it calls FMMM exactly as today. A two-link fallback chain — tag, then FMMM —
expressed as one branch in `parseAndLayout`. No other model change.

### 4. Node-count limit replaces the bp cap

`MAX_GRAPH_REGION_BP` (100 kb of reference span) is replaced by a node-count
ceiling — the constraint that actually bounds geometry build, GPU upload,
render, and the FMMM fallback. Past the ceiling the view still shows the
adr-027 "zoom in to view graph" message: **adr-027's core decision — one mode,
no degraded large-mode rectangle rendering — stands; only its "100 kb hard bp
cap" clause is superseded here.**

Enforcement point is an implementation detail: a cheap pre-fetch count from the
adapter's position index where available, otherwise a count after fetch; a high
bp value may be retained purely as a "do not attempt to fetch something absurd"
safety valve, not as the UX limit. Because offline layout removes per-view
FMMM cost, the node ceiling can sit well above what 100 kb of span implied.
The node-count limit is **interim** — adr-029 makes this ADR phase 1 of a
skeleton/detail two-tier architecture; once the skeleton tier (adr-029 phase 3)
lands, the overview path no longer needs the limit.

## Consequences

- **New:** an `LO`-style optional segment tag convention; a preprocessing step
  (`tools/gfa-to-tabix` or a companion) that runs `odgi sort --optimize` →
  `odgi layout` and writes coordinates into the widened per-ordinal binary.
- **Changed:** the per-ordinal binary record widens 4 → 20 bytes (file renamed);
  `GfaTabixAdapter.getSubgraph` reads coords and emits the tag in the loop that
  already emits `LN`; `gfaConverter` / `parseAndLayout` read the tag and build
  `LayoutResult`; `doSubgraphLoad` swaps the `regionSize > MAX_GRAPH_REGION_BP`
  check for a node-count limit.
- **Not changed:** the `getSubgraph` adapter interface, the `GetSubgraph` RPC
  return type (`string`), the `GraphComputeLayout` RPC, any model-facing config.
- **Determinism:** with the tag present, layout is stable across runs and
  overlapping regions; the `refetchIfNeeded` re-layout flake is gone for
  layout-tagged graphs.
- **Generality:** one wire convention covers every GFA source; sources without
  layout degrade gracefully to FMMM.
- **TubeMapView is unaffected** — it does its own main-thread lane layout.
- **Out of scope (avoiding complexity explosion):** BubbleGun bubble-collapse,
  server-side per-request layout, any change to the FMMM fallback itself.
- **Tradeoff:** coordinates ride in the GFA payload (bounded text bloat,
  mitigated by float-encoding choice), and the node-id↔ordinal contract between
  the layout step and the GFA-serving path must be kept consistent. The FMMM
  fallback means a missing or mismatched tag degrades gracefully rather than
  breaking.

## Rejected alternatives

- **Separate `.layout.bin` sidecar + `GetGraphLayout` RPC + `layoutLocation`
  config slot** (this ADR's first draft). Redundant surface: `seglens.bin` is
  already the per-ordinal binary, the adapter already emits segment tags, and
  PangyPlot itself stores coords *on* the segment record, not beside it. The
  RPC also only helped the tabix case — a segment tag helps every source.
- **Widening `getSubgraph` to return `{ gfa, layout }`.** A cleaner data shape
  than a text tag, but it touches a shared adapter interface (3 implementations
  + the RPC return type + 3 consumers) for no gain over a tag `parseGFA`
  already parses.

## Cross-references

- `agent-docs/GRAPH_PLAN.md` — "Cross-reference: PangyPlot / BubbleGun".
- `agent-docs/architecture-decision-records/adr-027-graphgenomeview-large-mode-removed.md`
  — its one-mode decision stands; its 100 kb bp-cap clause is superseded here.
- `~/src/vendor/pangyplot` `pangyplot/db/sqlite/segment_db.py` /
  `pangyplot/preprocess/parser/parse_layout.py` — coords-on-the-segment storage
  and the odgi/Bandage layout parsers this follows.
- `plugins/comparative-adapters/src/GfaTabixAdapter/GfaTabixAdapter.ts` — the
  `getSubgraph` loop (~430-443) that already reads the per-ordinal binary and
  emits `LN` tags.
