# Graph Subgraph Index — Plan

A static-file index for pangenome GFAs that supports `vg find`-equivalent
subgraph extraction in the browser, integrated with JBrowse's comparative
LGV via an "Open in graph view" drill-down. Prior art (cite, don't fight):
sequencetubemap-tabix (Monlong, `~/src/sequencetubemap@tabix`), vg-gaf-annot.

## What's proved (and what isn't)

The structural correctness story is settled. Two concrete claims,
both with running tests:

- **Per-path correctness** (the headline). For any reference path
  and viewport, our extraction is byte-isomorphic to
  `vg find -p PATH:start-end -c K` under canonicalization. Verified
  by `auditConcordance.test.ts` on volvox + chr20 spot-checks; runs
  in CI (vg ≥ 1.59 provisioned).
- **Cross-path symmetry on fully-traversed chromosomes.** On chrM,
  44 haplotypes querying the same locus produce one fingerprint
  (`3d0e925d0f33b04a`). Verified by
  `tools/graph-truth-extractor/test-path-symmetry.sh`.

What is **not** claimed: cross-path symmetry on fragmented-contig
chromosomes (chr20). Each haplotype's contig has its own
fragmentation, so the bounding-box equivalent-ranges mapping
extracts structurally different subgraphs from each path. This is
a real property of fragmented pangenomes, not a bug.
`GRAPH_PERF.md` "Lightning-rod finding 2026-04-30" has the per-pair
numbers and the history of the rejected intersection-restricted
reframing.

If a future agent is tempted to revive a cross-path-symmetry claim
on fragmented chromosomes: any test restricting both extractions to
their shared segment subset is a tautology (both sides read the
same binary index, so shared segments necessarily share edges).
Don't.

## Open backlog

The structural claims are proved by tests that now run in CI. The
remaining work is the browser-side workflow for the figure plus
writing.

1. **Browser-side lightning rod (the figure).** The CLI proves
   per-path correctness. The paper figure needs the LGV → Graph
   drill-down running in the live UI: pick a real chr20 SV (MAPT
   is wrong — that's chr17; SHANK2/SCARB1 region or a documented
   inversion), open from a reference path, capture screenshots.
   Browser-only; can't be done from the CLI.

Deferred until needed: snarls index, tile pyramid, Rust coarsener
port, bubble-row regrouping. None of these block publication.

### Plausible follow-up cleanups (not blocking)

- **`canonicalize.ts` may be redundant.** All audit comparisons go
  through `structuralFingerprint`, which is sequence-grounded and
  hashes sorted multisets — i.e. order-invariant by construction.
  The `canonicalize()` step before it (WL label refinement +
  canonical-id rewrite) does not affect the fingerprint. If true,
  every `structuralFingerprint(canonicalize(gfa))` call site can
  collapse to `structuralFingerprint(gfa)`. Verify by computing
  both forms across the audit fixtures and asserting equality, then
  delete `canonicalize()` and the WL machinery.
- **Consolidate audit subprocess chain.** `equivalent-ranges` →
  `dump-subgraph` per path → `truth-extractor` → `canonicalize`
  is 3+ Node spawns per comparison, each re-loading the same
  binary indexes. A library entry point (one process, shared
  state) would cut wall time noticeably and let the path-symmetry
  Jest test run on chrM in CI without a 60-second timeout.

## What we're shipping

Five runtime-consumed index files per fixture (`pos.bed.gz`,
`segments.bin`, `edges.bin`, `bubbles.bed.gz`, `segments.seq.fa`),
one alternative encoding tier (`segments.seq.bin` — 2-bit-packed
ACGT + N-bitmap, opt-in), one sidecar (`vcf.gz` — JBrowse VariantTrack
only). Format spec: `agent-docs/GRAPH_INDEX_FORMAT.md`.

Two extraction paths in the adapter:
- **Per-segment** (`buildGfaFromEdges`) — sub-megabase queries,
  full bubble detail, multi-haplotype subwalks. BFS k hops from seed.
- **Coarsened** (`buildGfaCoarsened`) — ≥1 Mbp queries, super-segment
  GFA with threshold-gated preserved bubbles, ref-path W-line only.
  Linear walk along ref ordinals.

Both consume the same edge index. Region-size dispatch in
`BaseGfaTabixAdapter.getSubgraph`.

## Non-goals

To bound reviewer expectations:

- Not a new graph file format. Output is GFA 1.1.
- Not a new graph alignment / mapping algorithm.
- Not a new graph layout algorithm.
- Not incremental index updates. Rebuild-on-update.
- Not a graph editing UI.

## Decisions locked in by the user

- **Static files only.** No runtime vg/odgi calls.
- **Runtime perf > index footprint.** Network-fetched working sets
  matter more than total file size.
- **Multiple encodings of the same logical content allowed
  (SAM/BAM-style).** Sequences ship as both plaintext FASTA and
  2-bit binary; magic-byte dispatcher picks at open time. **Not**
  authorization for parallel mechanisms solving different problems
  (the snarls + tile-pyramid + coarsener trap earlier plan drafts
  fell into).
- **Preprocess-time vg/odgi calls are fine.** Rust tool already
  shells out to bgzip/tabix/sort/`vg deconstruct`.
- **One algorithm for multi-resolution.** Runtime edge-walk coarsener
  handles megabase scale. No precomputed tile pyramid; no separate
  snarls index for context expansion.

## Claims (for the paper)

- **C1** Per-path correctness against `vg find` (under
  canonicalization). *Status: proved by `auditConcordance.test.ts`.*
- **C2** Correctness against sequencetubemap-tabix's `chunkix.py`.
  *Status: harness backend exists, not yet wired into Jest.*
- **C3** Path symmetry on fully-traversed chromosomes. *Status:
  proved on chrM by `test-path-symmetry.sh` (44 paths, one
  fingerprint). Explicitly does not extend to fragmented-contig
  chromosomes — see "What's proved (and what isn't)" above.*
- **C4** Browser-native at HPRC scale. *Status: chr20 latency
  numbers in `GRAPH_PERF.md`; figure pending the browser-side
  workflow.*
- **C5** LGV → graph-view drill-down works end-to-end. *Status:
  puppeteer suite covers the launch entry points; figure pending.*
- **C6** (Supporting) per-base bubble detail at zoom. *Status:
  bubble pipeline shipped, Phase 7 polish deferred.*

Index-footprint is supplementary, not a headline claim.

## Quickstart for a fresh agent

Pre-reqs: `vg ≥ 1.59.0` on PATH, Node `≥ 24`
(`--experimental-strip-types`).

```bash
# 1. Build/refresh fixtures (idempotent).
bash tools/gfa-to-tabix/prepare-fixtures.sh

# 2. Volvox smoke test.
bash tools/graph-truth-extractor/test-subgraph-concordance.sh

# 3. Full Jest audit.
pnpm --filter @jbrowse/plugin-comparative-adapters test \
  GfaTabixAdapter

# 4. chrM cross-path symmetry (the C3 working example).
bash tools/graph-truth-extractor/test-path-symmetry.sh

# 5. chr20 — needs local fixtures (~/chr20-test/) or wired-up S3.
bash tools/graph-truth-extractor/test-path-symmetry.sh \
  --prefix /home/cdiesh/chr20-test/chr20 \
  --path GRCh38#0#chr20 --start 30000000 --end 30001000 --context 0
# Will report DIVERGENT — that's the documented finding, not a
# regression. See "What's proved (and what isn't)" above.
```

HPRC source URLs (for fixture rebuilds):
- chrM: `https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/freeze1/minigraph-cactus/hprc-v1.1-mc-grch38/hprc-v1.1-mc-grch38.chroms/chrM.vg`
- chr20: same prefix, `chr20.vg`

Convert with `vg view -f` before passing to `gfa-to-tabix`. HPRC is
permissively licensed; cite
https://github.com/human-pangenomics/HPRC_pangenome_resources in
the paper's Methods.

## Critical files

### Adapter
- `plugins/comparative-adapters/src/GfaTabixAdapter/gfaTabixUtils.ts` —
  `BaseGfaTabixAdapter.getSubgraph`. Region-size dispatch between the
  per-segment and coarsened builders.
- `plugins/comparative-adapters/src/GfaTabixAdapter/gfaSubgraphBuilders.ts` —
  per-segment builder (`buildGfaFromEdges` + path-inference fallback).
- `plugins/comparative-adapters/src/GfaTabixAdapter/gfaCoarsener.ts` —
  coarsened builder for megabase-scale queries.
- `plugins/comparative-adapters/src/GfaTabixAdapter/gfaEmitHelpers.ts` —
  shared canonical-link / PanSN / orientation helpers used by both
  builders.
- `plugins/comparative-adapters/src/GfaTabixAdapter/bubbleOverlay.ts` —
  bubble pipeline (per-pair → per-site grouping, CS construction).

### RPC + graph view
- `plugins/linear-comparative-view/src/LinearSyntenyRPC/GetSubgraph.ts`
- `plugins/graph/src/GraphGenomeView/model.ts:549` (`loadFromTabixSubgraph`)

### Rust preprocessor
- `tools/gfa-to-tabix/src/main.rs`
- `tools/gfa-to-tabix/README.md`

### Audit harness (oracle, not runtime)
- `tools/graph-truth-extractor/index.ts` — `extractTruthSubgraph` with
  `vg`/`odgi`/`chunkix`/`naive` backends.
- `tools/graph-truth-extractor/canonicalize.ts` — `canonicalize` +
  `structuralFingerprint`.
- `tools/graph-truth-extractor/cli.ts`
- `plugins/comparative-adapters/scripts/dump-subgraph.ts` — adapter
  side of the comparison.
- `plugins/comparative-adapters/scripts/equivalent-ranges.ts` —
  bounding-box mapper from one path's viewport to per-other-path
  ranges that overlap the same physical segments. Useful for
  multi-path queries; does **not** by itself establish path
  symmetry on fragmented chromosomes.
- `plugins/comparative-adapters/src/GfaTabixAdapter/auditConcordance.test.ts` —
  Jest concordance suite. Three describe blocks: per-segment vs
  vg-find concordance, coarsener bp-bound concordance vs vg-find,
  and intra-fixture path-symmetry on volvox `ref#0#ctgA` (the
  chrM-shaped fully-traversed case). Skips when `vg` is not on
  PATH; CI provisions vg ≥ 1.59.0 in `.github/workflows/push.yml`.

### Test fixtures
- `test_data/volvox/volvox_pangenome_50.*` — primary CI fixture.
- `test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-chrM.*` — 44-hap
  realistic case.
- `test/data/synteny-demo/hprc/config_hprc_chr20.json` — chr20
  config (fixtures on S3 at
  `s3://jbrowse.org/demos/gfadata/hprc-v1.1-mc-grch38/`).

## Related docs

- `agent-docs/GRAPH_INDEX_FORMAT.md` — file-format spec.
- `agent-docs/GRAPH_COMPLETED.md` — shipped work.
- `agent-docs/GRAPH_AUDIT.md` — Phase 0 audit (static archive, do not
  edit). Re-entrant-path semantics note + chr20 path-symmetry finding
  remain load-bearing.
- `agent-docs/GRAPH_PERF.md` — perf numbers archive.
- `agent-docs/GRAPH_ARCHITECTURE.md` — fragile-boundaries reference.
- `architecture-decision-records/` — ADRs.
- `~/src/sequencetubemap/README.tabix.md` — prior-art format spec.
