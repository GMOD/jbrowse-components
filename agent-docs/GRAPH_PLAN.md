# Graph Subgraph Index — Publication Plan

## Goal

A static-file index for graph genomes (pangenomes encoded as GFA) that supports
`vg find`-equivalent subgraph extraction **from any path's perspective**,
enabling Linear-Genome-View → Graph-View drill-down without runtime vg/odgi
launches. The publication contribution is the indexing scheme. Rendering
polish (bubble CS, structural events) is supporting work, not the headline.

## North-star UX

A user browses a region in a normal LGV → `MultiLGVSyntenyDisplay` → clicks
"Open in graph view" → the resulting subgraph is graph-isomorphic to what
`vg find -p PATH:start-end -c <k> graph.gfa` produces. Including: real
sequences, all path subwalks through the region, snarl boundaries, with the
context expansion `k` chosen via experiments (see open questions).

The motivation is parallel to vg-gaf-annot
(https://jmonlong.github.io/manu-vggafannot/): they tabix-index annotations
*on* the graph; we tabix-index the *graph itself* for retrieval-by-region from
any reference frame. rGFA-indexed approaches let you query only from one
perspective; this index is symmetric across all paths.

## Decisions already made by user

- **Static files only.** As many files as needed for efficient modular
  fetching. No runtime vg/odgi calls.
- **Bubble-CS work is supporting**, not the headline. Don't get pulled back
  into rendering polish unless Phase 7 is up.
- **Context expansion semantics is an open question.** Run experiments in
  Phase 0 / Phase 3 to decide between fixed `-c k`, snarl-boundary expansion,
  or both.

## What exists today

### Plumbing (already wired)

- `LinearSyntenyRPC/GetSubgraph.ts:23-60` — RPC entry; calls
  `adapter.getSubgraph(region)`.
- `GraphGenomeView/model.ts:535-569` — `loadFromTabixSubgraph` action;
  consumes GFA text, runs through gfaParser/gfaConverter, lays out and
  renders.
- `GfaTabixAdapter.getSubgraph` at
  `plugins/comparative-adapters/src/GfaTabixAdapter/gfaTabixUtils.ts:333-370`
  — entry point on the adapter side; routes to one of two builders.

### Static index files emitted by `tools/gfa-to-tabix/src/main.rs`

- `prefix.pos.bed.gz` — tabix-indexed segment positions per path. Schema in
  the file header (`#genomes=`, `#sizes=`, `#paths=`).
- `prefix.segments.bin` — fixed 15-byte records, ordinal-keyed:
  `segOrd:u32 | pathNameIdx:u16 | offset:u32 | segLen:u32 | orient:u8`.
- `prefix.segments.idx` — byte-offset table for ordinal lookup.
- `prefix.edges.bin` / `.idx` — ordinal-keyed adjacency (when graph has L
  lines).
- `prefix.bubbles.bed.gz` — per-pair bubble CS rows from `vg deconstruct` VCF.
  Schema: `path | start | end | alleleA | alleleB | identity | cs |
  genomesA | genomesB`.
- `prefix.vcf.gz` — rewritten `vg deconstruct` VCF (PanSN-stripped).

### Subgraph builders

`plugins/comparative-adapters/src/GfaTabixAdapter/gfaSubgraphBuilders.ts`:

- `buildGfaFromEdges` (lines 5-49): preferred path when `edges.bin` exists.
  Walks edges 1 step from seed `viewportRefOrds`, adds neighbor segments,
  emits `H` + `S` + `L` lines.
- `buildGfaFromPathInference` (lines 51-159): fallback when no edges file.
  Uses path co-traversal to derive links. Emits `H` + `S` + `L` + `P` lines.

## Likely gaps vs `vg find` (Phase 0 confirms)

Reading `buildGfaFromEdges`:

- **No real sequences.** S lines emit `*` placeholder + `LN:i:<len>`.
  `segments.bin` carries no nucleotides. Cannot round-trip through vg or
  render base-level detail in graph view.
- **No P lines.** Edge-based path emits zero path traversals. Users see
  segments + edges but cannot tell which haplotype takes which route through
  bubbles. (Path-inference fallback does emit P, but only for paths sharing
  ref segments — not the same as vg's full subwalk.)
- **Hardcoded 1-step context** — and even that is filtered to "kept only if
  both endpoints are seed segments." `vg find -c k` is parameterized.
- **No snarl decomposition output.** Bubble structure is in `bubbles.bed.gz`
  as path-coordinate annotations, not as graph structural metadata. The graph
  view cannot color/highlight snarl boundaries.
- **No verification of graph isomorphism.** Currently a hope, not a measurement.

## Phase 0 — Audit harness (DO THIS FIRST)

This is the gate. Without it, every other phase is a guess. The phase
priorities below assume Phase 0's likely findings; re-rank if surprised.

### Setup

- Install `vg` (https://github.com/vgteam/vg/releases). Verify:
  `vg version`. If unavailable on host, use Docker
  (`quay.io/vgteam/vg:latest`).
- Test fixtures already in repo:
  - `test_data/volvox/volvox_pangenome_50.gfa` — small, has bubbles, edges
    file built. Primary fixture.
  - `test_data/volvox/volvox_indel_pangenome.gfa` — has structural variants.
  - `test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-chrM.*` — HPRC chrM, 44
    haplotypes. The realistic stress test. Note: `.gfa` source may need
    re-fetching from the HPRC release; only the tabix outputs are in repo.
- HPRC chr20 (`test/data/synteny-demo/hprc/config_hprc_chr20.json` exists)
  is too big for CI fixtures but should be exercised locally for paper
  benchmarks.

### Harness

Create `tools/gfa-to-tabix/test-subgraph-concordance.sh` (or similar):

```bash
# Pick a region
PATH_NAME="ctgA"; START=1000; END=5000; CONTEXT=1
GFA="test_data/volvox/volvox_pangenome_50.gfa"
PREFIX="test_data/volvox/volvox_pangenome_50"

# Truth: vg find subgraph
vg find -p "${PATH_NAME}:${START}-${END}" -c "${CONTEXT}" \
  --gfa-input "${GFA}" > /tmp/truth.gfa

# Ours: getSubgraph via a small TS harness
node --experimental-strip-types tools/gfa-to-tabix/dump-subgraph.ts \
  "${PREFIX}" "${PATH_NAME}" "${START}" "${END}" > /tmp/ours.gfa

# Diff
node --experimental-strip-types tools/gfa-to-tabix/diff-gfa.ts \
  /tmp/truth.gfa /tmp/ours.gfa
```

`dump-subgraph.ts` should construct the adapter directly (see
`plugins/comparative-adapters/src/GfaTabixAdapter/GfaTabixAdapter.test.ts`
for the construction pattern) and call `getSubgraph(region)`.

`diff-gfa.ts` should report concordance per category, modulo segment-ID
renaming (canonicalize by sequence hash, or — if Phase 1 hasn't landed yet —
by length + adjacency signature):

- segments: present-in-both / only-in-truth / only-in-ours, with sequence
  agreement
- edges: present-in-both / only-in-truth / only-in-ours
- paths: per path, subwalk-edit-distance vs truth's subwalk
- summary: graph-isomorphic? yes/no, with breakdown

### Deliverables of Phase 0

- Run on at least the volvox pangenome and HPRC chrM.
- Produce a table in `agent-docs/GRAPH_AUDIT.md` with concordance numbers.
- A judgment call from these numbers about whether sequences (Phase 1),
  P-lines (Phase 2), or context (Phase 3) is the biggest gap.

## Phase 1 — Real sequences

Likely needed; Phase 0 will confirm.

- New static file `prefix.segments.seq.bin`: 4-bit packed nucleotides
  (ACGT + N), ordinal-keyed. Plus `prefix.segments.seq.idx` byte-offset
  table for variable-length sequences.
- Sharded variant `prefix.segments.seq.<assembly>.bin` for very large graphs
  (parallels existing `--sharded` flag in the Rust tool).
- Rust tool: emit during the GFA pass. Sequences are already read from S
  lines for `encode_bubble_cs`; we just need to also persist them.
- Adapter: lazy-fetch sequences only for `getSubgraph` responses (working
  set is small — viewport-scoped). Don't load for `getMultiPairFeatures`
  (synteny rendering doesn't need them).
- New method on `BaseGfaTabixAdapter`:
  `getSegmentSequences(ordinals: number[]): Promise<Map<number, string>>`.
- Update `buildGfaFromEdges` and `buildGfaFromPathInference` to populate the
  S-line sequence column instead of `*`.
- Test: round-trip a subgraph through `vg view` → `vg snarls` and verify
  snarl decomposition matches `vg snarls` on the original GFA restricted to
  the same segments.

## Phase 2 — P lines in edge-based subgraph

- For each path visiting any segment in `allNodeOrds`, walk its records via
  `segments.bin` (already keyed by ordinal — see `getSegsForOrdinals` in the
  abstract base). Emit the contiguous in-subgraph subwalk(s) as P lines.
- Match `vg find` semantics: a path can enter and exit the subgraph
  multiple times → emit one P line per contiguous subwalk, suffixed
  `_seg<N>` for disambiguation (or whatever vg does — verify and copy).
- Orientation tags must come from the segment record's `orient` field.
- Test: P-line concordance with `vg find` output, per path.

## Phase 3 — Context expansion

- Extend `getSubgraph(region, opts)` signature. Add `context?: number`
  (default 1) for k-step edge expansion.
- Walk edges k steps from seed segments. Boundary handling: cut off at
  context limit even if a path continues — match `vg find -c k`.
- The RPC method (`LinearSyntenyRPC/GetSubgraph.ts:23`) and the graph view
  caller (`GraphGenomeView/model.ts:535`) both need to accept this option.
- **Open question for experiments**: does fixed-k expansion or
  snarl-boundary expansion give the better UX? Snarl-boundary requires
  Phase 4 to be live first; fixed-k can ship independently.
  - Experiment 1: fix k ∈ {1, 2, 3, 5}, eyeball the resulting graphs in
    `GraphGenomeView` for several HPRC chrM regions. Which feels right?
  - Experiment 2: expand-to-snarl-boundary (round to enclosing top-level
    snarl). Compare visually.
  - Document the choice in `agent-docs/GRAPH_PLAN.md` (this file) before
    locking it in.

## Phase 4 — Snarl decomposition index

Strongly preferred: option (a). Option (b) is an escape hatch.

- **(a) Static `prefix.snarls.bed.gz`** emitted at preprocess time. Schema:
  `refPath | refStart | refEnd | snarlType | LV | parentSnarlId |
   startOrd | endOrd | netGraphSize`.
  Compute via `vg snarls graph.gfa` once, then convert to BED + tabix.
  Pure tabix lookup at query time, zero runtime tools.
- **(b) Compute snarls from edge index at query time.** Bubble decomposition
  from edges + paths is O(|subgraph|). Cheaper file footprint, more
  runtime code. Reject unless (a) proves too large or too slow.
- Adapter: `getSnarlsForRegion(region): Promise<SnarlRecord[]>`. Consumed by
  graph view to color/highlight bubbles.
- Test: snarl boundaries match `vg snarls` output for the same GFA.

## Phase 5 — vg find concordance as CI test

- Codify Phase 0's diff harness as a Jest test in
  `plugins/comparative-adapters/src/GfaTabixAdapter/`.
- Test fixtures: volvox pangenome + volvox indel pangenome (small enough
  for CI). HPRC chrM gated on local `vg` install.
- Pass criteria: graph-isomorphic to `vg find` output, modulo segment-ID
  renaming. Per-category concordance ≥ 99%.

## Phase 6 — Linear-view → graph-view UX polish

- Plumbing exists (`loadFromTabixSubgraph` on `GraphGenomeView`).
- Add an "Open in graph view" track menu item on `MultiLGVSyntenyDisplay`.
  Pass current visible region + adapter config + context option.
- Spawn a `GraphGenomeView` in the session (or focus existing one) and
  dispatch to `loadFromTabixSubgraph`.
- Keyboard shortcut consideration (deferred — pick something non-conflicting).
- End-to-end browser test (Chrome DevTools MCP):
  load synteny → click → graph view appears with subgraph. Pin via screenshot.

## Phase 7 — Bubble-CS work as supporting (the original plan)

The previous plan in this conversation (`buildCsFromCigarAndBubbles`,
`n.repeat()` removal, GPU parity, identity definition, multi-reference
orientation) becomes Phase 7. It demonstrates that the static index also
carries per-base bubble detail when zoomed in. **Do not start this until
Phases 0–6 are landed and the headline contribution is solid.**

The detailed sub-plan from the prior conversation:

- A. Replace `n.repeat()` synthetic-base hack: bubble CS describes only
  positions inside CIGAR `=`/`M` runs; structural ops come from CIGAR.
- B. GPU pipeline parity: pass `len` through `onInsertion` (currently
  `_len` is discarded at
  `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/shared/extractCigarFeatures.ts:36`).
- C. Identity definition lockdown — pick `matchBp / refSpanBp`, document.
- D. Quantify bubble-cap drops on real data (`MAX_PAIRS_PER_SITE=500`,
  `MAX_ALLELE_LEN=10000` in the Rust tool).
- E. Performance benchmarks.
- F. Multi-reference orientation correctness (positional golden tests, not
  `/[+-]/.test(cs)`).
- G. Test rigor.

## Phase 8 — Performance & scale validation

- Subgraph extraction latency: ours vs `vg find` on HPRC chr20 at 10kb /
  100kb / 1Mb regions.
- Index size: total static-file footprint (pos.bed.gz + segments.bin +
  segments.seq.bin + edges.bin + bubbles.bed.gz + snarls.bed.gz) vs HPRC's
  `.gbz`.
- Streaming working set: peak heap during extraction.
- Cold vs warm cache (matters for Cache API in browser).
- Document in `agent-docs/GRAPH_PERF.md` (existing file; extend, don't replace).

## Phase 9 — Publication artifacts

- **Headline figure:** HPRC chr20 region in synteny LGV → click → graph
  view with sequences, paths, snarls. One screenshot pair.
- **Concordance table:** % match with `vg find` per category (segments,
  edges, paths, sequences) on volvox + HPRC chrM + HPRC chr20.
- **Index size table:** static files vs `.gbz` baseline.
- **Performance table:** latency vs `vg find`.
- **Methods section:** file format spec for each new file (segments.seq.bin
  byte layout, snarls.bed schema, etc.). One paragraph per file.

## Critical files reference

### Adapter side

- `plugins/comparative-adapters/src/GfaTabixAdapter/gfaTabixUtils.ts`
  — `BaseGfaTabixAdapter` class, `getSubgraph` at line 333.
- `plugins/comparative-adapters/src/GfaTabixAdapter/gfaSubgraphBuilders.ts`
  — `buildGfaFromEdges`, `buildGfaFromPathInference`.
- `plugins/comparative-adapters/src/GfaTabixAdapter/gfaBinaryIO.ts`
  — segment + edge binary record parsing, ordinal lookups.
- `plugins/comparative-adapters/src/GfaTabixAdapter/segmentFeatureBuilder.ts`
  — synteny feature CIGAR construction (separate from subgraph; touches
  Phase 7).
- `plugins/comparative-adapters/src/GfaTabixAdapter/configSchema.ts`
  — adapter config schema. Add new file locations here as Phase 1+ adds them.

### RPC + graph view

- `plugins/linear-comparative-view/src/LinearSyntenyRPC/GetSubgraph.ts`
  — RPC entry. Will need to accept `opts` (context, etc.).
- `plugins/graph/src/GraphGenomeView/model.ts:535-569`
  — `loadFromTabixSubgraph`. Consumes GFA, runs through layout.
- `plugins/graph/src/gfa/gfaParser.ts`, `gfaConverter.ts`
  — GFA-text parser; check support for new fields.

### Rust preprocessor

- `tools/gfa-to-tabix/src/main.rs`
  — single-file Rust tool. Two-phase pass: scan S lines first, then walk P
  lines. The bubble VCF generation is at lines 1273-1527. Sequence emission
  for Phase 1 should fit in the existing S-line scan.
- `tools/gfa-to-tabix/README.md` — current CLI reference.

### Linear synteny display (Phase 7 only)

- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/`
  — main display.
- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/shared/extractCigarFeatures.ts:36`
  — the GPU `_len` discard.
- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/features/insertion/extract.ts:8`
  — `emitInsertionGpu` collapses `endBp = startBp` (1px line).
- `packages/alignments-core/src/labelConstants.ts:113-141`
  — `drawInsertion` Canvas2D path with the labeled-box branch GPU lacks.
- `plugins/comparative-adapters/src/MultiPairFeature.ts:3-18`
  — feature schema. Both `cigar` and `cs` are strings.

### Test fixtures

- `test_data/volvox/volvox_pangenome_50.{gfa,pos.bed.gz,segments.bin,
  edges.bin,bubbles.bed.gz,vcf.gz}` — primary small fixture.
- `test_data/volvox/volvox_indel_pangenome.gfa` — has SVs.
- `test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-chrM.*` — 44-haplotype
  realistic case.
- `test/data/synteny-demo/hprc/config_hprc_chr20.json` — chr20 config (fixtures
  not in repo; for local benchmarking).

## Open questions / experiments

- **Context expansion semantics.** Phase 3 — fixed k vs snarl-boundary vs
  both. Run experiments after Phase 0 + (Phase 1 or 4) is in.
- **Sharded sequences file.** Phase 1 — when is the sharded variant worth
  it? Likely for HPRC chr20-scale graphs only. Decide based on Phase 8
  numbers.
- **Snarl computation source.** Phase 4 — `vg snarls` output, or compute in
  the Rust tool? Cleaner separation if it stays a vg call at preprocess
  time. But it adds a vg dependency to preprocessing (acceptable; user only
  rejected runtime vg, not preprocess vg).
- **Bubble-cap drops.** Phase 7 D — `MAX_PAIRS_PER_SITE=500`,
  `MAX_ALLELE_LEN=10000` in `tools/gfa-to-tabix/src/main.rs`. Quantify on
  HPRC chr20 before deciding to lift.
- **Cycles, duplications, inversions.** Real pangenomes have these.
  Currently no explicit handling. Phase 0 audit on HPRC chrM (which has a
  control region that's hairy) will surface issues.

## Memory / context bridge for fresh agents

The user does not want runtime tool launches in the browser. Static files
only. They are fine with adding files at preprocess time (the Rust tool
already shells out to `bgzip`, `tabix`, `sort`; adding `vg snarls` is fine).

The previous agent over-rotated on bubble-CS rendering polish (Phase 7
material) and called it "publication-grade." It was a good bug fix but not
the contribution. Don't repeat.

When adding new fields to `MultiPairFeature` or new file types, follow the
project's existing naming conventions (see `tools/gfa-to-tabix/src/main.rs`
for emit; the test in `GfaTabixAdapter.test.ts` for the construction pattern).

The repo has a `webgl-poc` branch as the active branch. Bubble-CS work
already on this branch should not be reverted; it lands as Phase 7 polish.

See also:
- `CLAUDE.md` (root) for project guardrails.
- `agent-docs/PRD.md` for the broader WebGPU migration context.
- `agent-docs/ARCHITECTURE.md` for coordinate conventions and RPC boundaries.
- `agent-docs/GRAPH_PERF.md` for prior perf notes (extend, don't replace).
