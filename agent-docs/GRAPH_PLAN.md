# Graph Pangenome Plan

> **Rewritten 2026-05-14.** This supersedes the GfaTabix static-index plan
> (pairwise `synteny_build`, `bubbles.bed.gz`, coarse tiers, custom binary
> formats). The rationale for each removal is in ADRs 024–027. The old plan's
> Phase 0 audit is preserved read-only in `GRAPH_AUDIT.md`.

## Goal

Two ways to look at an HPRC-style graph pangenome in JBrowse:

- **MultiLGVSyntenyDisplay** — linearized: each haplotype shown as a row of
  synteny blocks against a reference path (GRCh38), full genome, all zooms.
- **GraphGenomeView** — a Bandage-style 2-D graph of a selected locus, on
  demand.

Hard requirements from the user: works at **full-genome** scale; **no "tier"
concepts** the user has to think about; **simple, intuitive** track behavior.

## Architecture: two displays, two standard tools, no custom formats

```
HPRC .gbz
  │  vg convert -f → .gfa → odgi build → .og        (one-time)
  │  vg convert -x → .xg                            (one-time, for graph view)
  │
  ├─ odgi untangle -R <ref> -j <floor> -m <floor>   → sort | bgzip | tabix
  │     → <ref>.synteny.paf.gz (+ .tbi)             ── feeds MultiLGVSyntenyDisplay
  │
  ├─ vg deconstruct -P <ref>                        → bgzip | tabix
  │     → <ref>.variants.vcf.gz (+ .tbi)            ── standard VCF track (per-base detail)
  │
  └─ (graph view) vg find -x .xg -p region -c ctx   → GFA → OGDF layout
        ── feeds GraphGenomeView on demand
```

Everything the *browse* experience reads is a static, tabix-indexed file —
no server. The graph view's `vg find` extraction is the only piece that needs
a process, and it fires only on an explicit "open graph view here" action.

### MultiLGVSyntenyDisplay — one mode

Reads `synteny.paf.gz` via tabix range query. Renders untangle blocks colored
by identity. The user zooms; tabix returns the blocks in view; they render.
No `bpPerPx` thresholds, no coarse file, no modes — it behaves like any other
JBrowse track.

- **Per-base SNP/indel detail** is the separate `variants.vcf.gz` VCF track
  (standard JBrowse variant track). Not overlaid on the synteny display in v1;
  overlay is a later enhancement (adr-025).
- **Copy number / paralogy** needs no special data: a duplicated reference
  region appears at two reference x-positions and the haplotype's row simply
  has a block at each. The only renderer case is a copy-number *gain*
  (overlapping blocks within one row) — a draw-time concern, not a data one.

### GraphGenomeView — one mode

`vg find -p region -c context` → GFA → OGDF WASM layout → render. Sub-second
for regions ≤ 100 kb. Past a size cap it says "zoom in to view graph" — there
is no "large mode" fallback (adr-027). This is the odgi `extract_selected_loci`
workflow.

## Preprocessing recipe

`odgi untangle` parameters are **baked into the static file**, so bake
*permissive* and filter up at runtime:

- `-n 1` — n-best > 1 produces only noise (mean jaccard ~0.02, validated on
  chr20 segdups); never use it.
- `-j` — bake a *low* jaccard floor (kills degenerate `id:f:0` artifacts but
  keeps borderline-real blocks). The `jc:f:` tag is carried into the PAF so
  the adapter can filter *up* at runtime.
- `-m` — bake a *low* merge-distance (or 0). Visual merging of adjacent
  collinear blocks happens render-side. Verify whether `-m` affects segment
  *boundaries* or only post-merge before finalizing the floor.
- `-e/--cut-every` — leave at default (off); it changes segmentation
  boundaries and cannot be undone at runtime.
- `-R` — the reference anchor is the one genuinely unrecoverable choice. One
  untangle run per reference (GRCh38, probably also CHM13).

`-j 0.5 -m 1000` was the *clean-output* recipe in benchmarking (24k blocks,
median 10.6 kb, no junk); treat those as the *upper* end of filtering, not
the bake values.

## Benchmark results (HPRC chr20, 919 paths, 90 haplotypes — 2026-05-14)

| Operation | Result |
|---|---|
| Whole-graph `odgi untangle` | **1m39s wall, 2.1 GB RSS**, ran 4× clean |
| `-j 0.5 -m 1000` output | 24,376 blocks, **11 MB**, median block 10.6 kb |
| Raw output (no filter) | 69k blocks, ~21% degenerate `id:f:0` artifacts |
| `vg find` extract | 0.7 s @10 kb · 0.9 s @100 kb · 20 s @1 Mb |
| `odgi extract` | 8 s/call (full `.og` deserialize — one-shot binary) |

The whole-graph precompute is cheap enough that the *static-file* model is
clearly viable; the expensive thing the original plan worried about does not
exist. Full numbers and the segdup / segfault investigations are in
`GRAPH_PERF.md`.

## Open question: static file vs. service

Both are viable; pick per deployment need:

- **Static** — `odgi untangle` once → tabix → ship files. No server for the
  browse path. The publication-friendly "host these files anywhere" story.
- **Service** — `graph-server` runs `vg find → odgi build → odgi sort →
  odgi untangle` per region (all fast on a small subgraph). Every parameter
  becomes a live query knob; always fresh. Needs a process.

(`odgi extract → odgi untangle` segfaults because extract emits unsorted node
IDs — `odgi sort` between them fixes it. It's an odgi bug, not a fundamental
limit; see `GRAPH_PERF.md`.)

A reasonable hybrid: ship the permissive static file as the default, and let
`graph-server` regenerate a custom-parameter untangle on demand for power
users. Decide after a direct static-vs-service comparison in the browser.

## Known limitations

- **untangle output is unaudited.** The old `synteny_build` had a (weak) audit
  harness; untangle replaces it untested. Needs a correctness check (against
  `vg deconstruct`, or the source alignment) before publication.
- **The vendored odgi build is unstable** — broken `unchop`/`view`, segfaults
  on unsorted graphs. Needs a version-pinned, known-good odgi.
- **Block-level only** — a block tagged `id:f:96` hides where the 4 %
  divergence is; all per-base positioning comes from the `vg deconstruct` VCF.
- **Linearization can't show non-reference sequence.** Haplotype-novel
  insertions / unplaceable contigs are absent or degenerate-blocked. The
  graph view is the answer for that sequence.
- **chr20 is segdup-poor** (4 large intra-chr segdups). The segdup handling
  story should be re-checked on a segdup-heavy chromosome (chr1, chr16).
- **untangle determinism** under 16 threads is unverified — matters for a
  reproducible published pipeline.

## Next steps

- Correctness check of untangle output vs. `vg deconstruct` / source alignment.
- Re-run the segdup multi-mapping check on chr1 or chr16.
- Wire `AllVsAllPAFAdapter` (PR #4985) into an *indexed* tabix-PAF adapter so
  MultiLGVSyntenyDisplay consumes `synteny.paf.gz` directly.
- Confirm `vg find` / `graph-server` path for GraphGenomeView; remove large mode.
- Static-vs-service browser comparison; pick the delivery model.
- Version-pin odgi + vg; verify untangle thread-determinism.

## What was removed (see ADRs)

| Removed | Replacement | ADR |
|---|---|---|
| GfaTabix `synteny_build` O(ref×hap) pipeline, `synteny.bed.gz` / `.rev` / `.coarse` | whole-graph `odgi untangle` → tabix PAF | adr-024 |
| `bubbles.bed.gz` overlay, X-CIGAR contract, `bubbleOverlay.ts` | `vg deconstruct` VCF track | adr-025 |
| Graph coarsening tier (tile + snarl, `graph.coarse.bed.gz`, `GRAPH_COARSE_*`) | resolution-independent untangle blocks + render-time merge | adr-026 (supersedes adr-014) |
| GraphGenomeView "large mode" (coloured rectangles > 100 kb) | one mode — `vg find` subgraph extraction, "zoom in" past a size cap | adr-027 |

## See also

- `GRAPH_ARCHITECTURE.md` — end-to-end pipeline of the new design.
- `GRAPH_PERF.md` — untangle benchmark, segfault and segdup investigations.
- `GRAPH_SERVER_PLAN.md` — graph-server's role under the new design.
- `GRAPH_AUDIT.md` — read-only archive of the retired GfaTabix Phase 0 audit.
- `architecture-decision-records/adr-024..027` — removal rationale.
