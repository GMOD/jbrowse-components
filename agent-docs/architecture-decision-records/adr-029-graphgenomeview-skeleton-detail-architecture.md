# ADR-029: GraphGenomeView skeleton/detail two-tier architecture

## Status

Accepted (2026-05-14). Architecture + phasing ADR; per-phase ADRs nail the
details. ADR-028 is phase 1 of this plan.

## Context

The user decided `GraphGenomeView` should scale to **whole-chromosome 2-D
overviews**, matching PangyPlot (Mastromatteo et al. 2025), rather than staying
locus-scoped. adr-027 capped it at a locus; adr-028 adds offline layout and an
interim node-count limit. Neither makes a whole chromosome viable — FMMM cannot
lay out millions of nodes, and the renderer cannot draw them.

PangyPlot solves this with a **two-tier viewer over precomputed structure**
(`~/src/vendor/pangyplot`, `docs/source/advanced/{schema,rendering}.rst`):

- **On-disk, per chromosome:** `segments.db` (S-line info + `odgi layout`
  coords), `links.db`, `bubbles.db` (the BubbleGun bubble/superbubble/chain
  hierarchy — parent/child/siblings, source/sink/inside segments, ref-coord
  ranges, layout bbox), `step_index.db` (bp ↔ segment), `paths/`, and a
  `skeleton/` of multi-resolution chain polylines + per-ref spine, plus
  `polychain-data` (bubble-free segment runs for the detail tier).
- **Preprocessing:** parse GFA → DBs; `odgi layout` TSV → coords; BubbleGun
  (compact → find bubbles → connect → find parents) → bubble hierarchy; then a
  skeleton pipeline grid-simplifies chain polylines at ~8 zoom levels
  (`VIEWER_GRID_SIZES`).
- **Runtime:** a **skeleton tier** draws the whole chromosome as a handful of
  precomputed chain polylines (default view); a **detail tier** progressively
  expands chains *under a complexity threshold* into laid-out subgraphs
  anchored to the skeleton polyline as the user zooms in (`get_chains` /
  `get_detail_tile` / `decompose_chain` / `pop_bubble`). Larger chains stay
  polylines.

The hard part for JBrowse: PangyPlot is **server-backed** — Flask + SQLite +
memory-mapped numpy indexes + per-request Python query layer. JBrowse's browse
path is **static-file-first** (`GRAPH_PLAN.md`: "no server").

## Decision

### 1. Adopt PangyPlot's two-tier model, mapped onto JBrowse's static-file + RPC-worker architecture

- **Skeleton tier** — precomputed multi-resolution chain polylines, whole
  chromosome, the default/overview view.
- **Detail tier** — chains under a complexity threshold progressively expand
  into laid-out subgraphs as the user zooms, anchored to their skeleton
  polyline; over-threshold chains stay polylines.

This is the headline behavior the user asked for and it is PangyPlot's, not a
JBrowse invention.

### 2. Static, range-queryable artifacts + RPC-worker query logic — not a required server

The bubble hierarchy and skeleton are **static files**: the bubble hierarchy as
a tabix-indexed BED keyed by reference-coordinate range (range-queryable per
region); the skeleton polylines as a per-chromosome binary (small — it is the
*simplified* geometry — fetched whole). The `decompose_chain`-equivalent
progressive-expansion logic is **pure computation**: it runs in an RPC worker
over the range-fetched indexes. `graph-server` remains an *optional* alternative
that can serve the same shapes. This preserves the publication story; PangyPlot's
mmap indexes are a resident-server optimization JBrowse does not need when the
heavy logic is computation in a per-session worker.

### 3. Preprocessing produces the artifacts; minimize artifact count

Extend `tools/gfa-to-tabix` (or a companion) so one preprocessing pass over
`GFA + odgi layout` emits: the phase-1 widened per-ordinal binary (length +
coords, adr-028), a bubble-hierarchy index, multi-resolution skeleton polylines,
and polychain data. Combine artifacts where the access pattern allows (per
adr-028's "no new file" principle); keep them separate only where access
patterns genuinely differ (bubble index = range-query by ref coord; skeleton =
whole-chromosome fetch). Bubble detection is BubbleGun's superbubble algorithm —
run BubbleGun as a preprocessing subprocess, or port the algorithm to Rust; that
is a phase-2 decision.

### 4. Phasing — four independently shippable phases

- **Phase 1 — offline layout foundation (ADR-028).** Layout as a GFA segment
  tag, FMMM fallback, node-count *interim* limit. Coordinates must exist before
  anything else can.
- **Phase 2 — bubble hierarchy.** Bubble detection in preprocessing → static
  bubble index; the adapter read path for it. Validatable in isolation (no
  renderer change yet).
- **Phase 3 — skeleton tier.** Multi-resolution polyline preprocessing +
  skeleton overview rendering in `GraphGenomeView`. **Whole-chromosome overview
  works here** (as polylines). The phase-1 node-count limit is removed for the
  overview path.
- **Phase 4 — detail tier.** Progressive `decompose_chain`-style expansion, the
  two-tier handoff, subgraph layout anchored to skeleton polylines. The full
  PangyPlot experience, including `pop`-style interactive expansion.

The node-count limit is not discarded across phases — it *evolves*: phase 1
"decline the whole view", phase 4 "this chain stays a polyline instead of
expanding" (PangyPlot's `expand_threshold` is exactly a per-chain complexity
limit).

### 5. Per-phase ADRs own the details

This ADR fixes the shape, the static-file-vs-server decision, and the sequence.
Bubble-index format, skeleton binary format, the RPC surface
(`GetGraphSkeleton` / `GetGraphChains` / `GetGraphDetailTile` and friends), and
the two-tier renderer handoff are decided in per-phase ADRs as each is built.

## Consequences

- Large, multi-phase effort — essentially a JBrowse port of PangyPlot's
  renderer architecture. Each phase ships standalone value; phase 3 is the
  headline capability.
- New static artifacts, new preprocessing, new adapter read paths, new RPCs,
  and a substantially reworked `GraphGenomeView` renderer/model.
- The static-file decision means `decompose_chain` and the skeleton/detail
  query layer are *ported to TypeScript RPC-worker code*, not reused from
  PangyPlot's Python.
- BubbleGun's superbubble detection is the one genuinely new algorithm to bring
  in; subprocess-vs-port is a phase-2 call.
- **History note:** JBrowse previously had a `bubbles.bed.gz` (adr-025 removed
  it). That was the *synteny CS overlay* — a different bubble concept for
  `MultiLGVSyntenyDisplay`. The phase-2 bubble index here serves *graph-view
  LOD* and is unrelated; do not conflate them.
- `MultiLGVSyntenyDisplay` and `TubeMapView` are unaffected.
- Scope discipline per phase is essential — this is the "complexity explosion"
  risk the user flagged, accepted deliberately because whole-chromosome 2-D
  topology overview is a real capability linearized synteny cannot provide.

## Rejected alternatives

- **Render-time spatial LOD only** (bin precomputed coords into cells, draw
  aggregates). Lighter, but collapses by spatial proximity rather than
  biological structure, gives no interactive bubble expansion, and does not
  match PangyPlot. Considered and not chosen by the user.
- **Require `graph-server`.** Breaks the static-file publication story.
  PangyPlot's server architecture exists for resident-process mmap perf;
  JBrowse's heavy logic is pure computation that runs fine in a worker over
  range-fetched static indexes.
- **Stay locus-scoped (node-count limit is final).** The other not-chosen
  option; whole-chromosome 2-D topology is the explicit goal.

## Cross-references

- `agent-docs/architecture-decision-records/adr-028-offline-graph-layout-tag.md`
  — phase 1 of this plan.
- `agent-docs/architecture-decision-records/adr-027-graphgenomeview-large-mode-removed.md`
  — its locus-only scope is superseded by this ADR's phased expansion.
- `agent-docs/architecture-decision-records/adr-025-vg-deconstruct-vcf-replaces-bubbles.md`
  — the *unrelated* prior bubble index (synteny CS overlay), noted to avoid
  confusion.
- `agent-docs/GRAPH_PLAN.md` — "Cross-reference: PangyPlot / BubbleGun" and the
  "static file vs. service" open question this ADR resolves toward static.
- `~/src/vendor/pangyplot` — `docs/source/advanced/{schema,rendering,layout,bubblegun}.rst`,
  `pangyplot/preprocess/bubble/`, `pangyplot/preprocess/skeleton/`,
  `pangyplot/db/query.py`, `pangyplot/routes.py` — the architecture being ported.
