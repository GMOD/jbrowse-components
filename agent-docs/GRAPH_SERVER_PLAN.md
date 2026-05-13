# Graph-server plan

Companion to `GRAPH_PLAN.md` — that file plans the **static-file tabix index**
publication path; this one plans the **express + odgi runtime backend**
(`tools/graph-server` + `plugins/comparative-adapters/src/GfaServerAdapter`).
The two paths are kept parallel so the server can serve as the ground-truth
oracle for the static-file output and as the prototyping vehicle for new
features before they get encoded into the preprocessor.

---

## Status (2026-05-12)

| Component | State |
|---|---|
| `tools/graph-server` Express service | done |
| `/setup`, `/subgraph`, `/synteny` endpoints | done |
| W→P GFA conversion + cached `.og` build | done |
| `GfaServerAdapter` (multi-pair + getSubgraph) | done |
| Volvox manual smoke + chr20 perf bench | done |
| Puppeteer e2e (`suites/graph-server.ts`) | done, gated `requiresRemote: true` |
| Bubble CS derivation from S-line sequences | done at server, correct at HTTP level |
| Multi-LGV synteny block rendering (server-fed) | works |
| Multi-LGV per-SNP top-stripe coloring (server-fed) | works (was a stale-snapshot artifact) |
| Graph view (Bandage layout) at SV region | works |

---

## Phase 1 — SNP top-stripe coloring (resolved 2026-05-12)

Confirmed by runtime instrumentation: the server adapter pipeline is correct
end-to-end on all three backends.

- Server emits 8658 substitution CS ops over 351 SNP positions for volvox
  ctgA:0-50001.
- Worker (`MultiPairGetFeatures`) builds `snpPositions/Heights/ColorTypes/
  RelDepths` with `snpCount=351`, `coverageMaxDepth=100`, all four base
  colors represented.
- Main-thread `buildSyntenyRegionMap` packs `packedSnpSegs=351`,
  `packedCovBins=1268`, with `showCoverage=true`.
- Canvas2D backend's `drawSnpSegments` issues 351 valid fillRect calls;
  WebGL backend renders the same buffers via the SNP pass shader.

Snapshots regenerated under default, `--backend=webgl`, and
`--backend=canvas2d` all show the full SNP top stripe and in-row SNP
detail. The originally checked-in
`__snapshots__/graph-server-multilgv-canvas.png` predated some change
in the upstream synteny rendering pipeline; nothing in the server-adapter
path itself ever produced the blank stripe.

Diagnostic probe `tools/graph-server/test/debug-snp.ts` is kept — it spawns
the server, fetches `/synteny` for ctgA:0-50001, runs the worker pipeline
locally, and dumps `snpCount`/`maxDepth`/per-genome coverage. Useful as a
sanity check when adding new server-side fields.

---

## Phase 2 — Reverse-strand + multi-strand runs

`collapseRunsWithBubbleCs` only chains forward-strand same-genome blocks; a
single negative-strand block breaks the run and gets emitted bare (no
bubble CS chained through it). This is fine for volvox (all forward) but
will mis-classify inversions in HPRC chr20.

- Add a reverse-strand chain branch: walk anchors in reverse on the query
  side, revcomp the alt sequences before `buildCs`.
- Unit test: a GFA with `2-` step in the alt path; expect cs reflects
  reverse-complemented alt diff.
- Verify against an HPRC chr20 inversion (one of the SV-bubble regions
  documented in `bubbles.bed.gz`).

---

## Phase 3 — Server ↔ tabix correctness oracle

The reason this runtime backend exists is to verify static-file outputs.
Build the diff loop.

- `tools/graph-server/test/compare-vs-tabix.ts`: for a set of regions,
  query the server's `/synteny` endpoint and parse the corresponding
  `synteny.bed.gz` + `bubbles.bed.gz` slice with the same logic; assert
  identical block extents, CS strings, and identity values.
- Catalogue any systematic differences (e.g., coarse-merge thresholds,
  block edges off by 1 at chunk boundaries).
- Run on:
  - volvox (`test_data/volvox/volvox_pangenome_50.*`)
  - HPRC chr20 (~/chr20-test) — large enough that any bug surfaces but
    small enough to debug
- Document divergences in this file under "Known divergences."

---

## Phase 4 — Perf

`test/perf-chr20.ts` already times `/subgraph` and `/synteny` across 1kb,
10kb, 100kb, 1Mb regions. Outstanding:

- Capture current numbers as a baseline in `agent-docs/GRAPH_PERF.md`.
- Identify the longest stage (extract vs parse+walk).
- If `/synteny` >500ms for 1Mb regions, profile `parseExtractedGfa` —
  string concatenation in `concatOrientedSeq` is the most likely hot path
  for sequence-heavy GFAs.

---

## Phase 5 — Documentation

- Update `tools/graph-server/CLAUDE.md` "Endpoints" section to document
  the bubble-CS algorithm (path-pair walk → alt-seq diff → cumulative cs).
- Add an ADR at `agent-docs/architecture-decision-records/adr-XXX-server-vs-tabix-parity.md`:
  - Why two backends.
  - Where CS derivation logic lives (server: `synteny.ts`; tabix:
    `bubbleOverlay.ts`). Risk: drift between them. Mitigation: Phase 3
    oracle test runs in CI on volvox.
  - Decision: server is the canonical bubble-CS implementation; tabix
    preprocessor mirrors the same algorithm. New CS features ship in
    server first, then port to the Rust preprocessor.

---

## Phase 6 — Graph view aesthetic (lowest priority)

Current bandage rendering shows many "pills" because each node gets
subdivided into `nodeSegmentLength=5` chunks, and every internal edge gets
an arrow. The user's reference image is a clean Bandage with one block
per segment.

- Plumb `nodeSegmentLength` through the `LaunchView-GraphGenomeView`
  extension point so callers can override per dataset.
- Try `nodeSegmentLength: 50` on volvox; check FMMM layout time and visual
  cleanliness. If layout is still <5s, raise the default.
- Per-segment color hashing for the Bandage style: each node gets a stable
  hue from its ord, segments of the same node share color.
- Note: this is a `plugins/graph` change, not a server change. Lower
  priority than Phase 1–3.

---

## Open questions

- Should bubble CS derivation move into `tools/gfa-to-tabix` (the Rust
  preprocessor) so the static-file path can drop the side `bubbles.bed.gz`
  index? Pro: smaller index, single algorithm. Con: forces Rust port of
  the JS sequence-diff code; the bubble file currently encodes per-sample
  presence vectors that don't fall out of pairwise CS — verify these are
  derivable from path-pair walk alone before consolidating.
- Should `GfaServerAdapter` cache `/setup` and recent `/synteny` responses
  in IndexedDB? Right now every cold tab load hits the server. Cheap to
  add if the server is the bottleneck; harmful if responses might change
  (e.g., during dev).
- Do we want a CLI for the graph-server (`@jbrowse/graph-server start ...`)
  for end-user installs, or keep it as a dev/researcher tool?

---

## Non-goals

These are explicitly out of scope for the graph-server path; they belong
to the static-file pipeline only:

- Coarsening tiers (`synteny.coarse.bed.gz`). The server is for
  interactive prototyping; offline preprocessing builds the tiers.
  See `feedback_static_file_coarsening`.
- CDN-friendly delivery (range-fetched static files). Server requires a
  live process; static files don't.
- Multi-tenant auth + rate limiting. See `tools/graph-server/CLAUDE.md`
  "Things that don't go in here."
