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
  ├─ odgi untangle -R <ref>  →  minimap2 --cs per block  →  sort | bgzip | tabix
  │     → <ref>.synteny.cs.paf.gz (+ .tbi)          ── feeds MultiLGVSyntenyDisplay
  │        block structure (untangle) + per-base SNP/indel detail (cs: tag) in
  │        one track — no separate VCF (adr-030)
  │
  └─ (graph view) vg find -x .xg -p region -c ctx   → GFA
        ── feeds GraphGenomeView (OGDF) or TubeMapView on demand
```

Everything the *browse* experience reads is a static, tabix-indexed file —
no server. The graph view's `vg find` extraction is the only piece that needs
a process, and it fires only on an explicit "open graph view here" action.

### MultiLGVSyntenyDisplay — one mode

Reads `synteny.paf.gz` via tabix range query. Renders untangle blocks colored
by identity. The user zooms; tabix returns the blocks in view; they render.
No `bpPerPx` thresholds, no coarse file, no modes — it behaves like any other
JBrowse track.

- **Per-base SNP/indel detail** rides in the same `synteny.cs.paf.gz` via the
  `cs:` tag — the existing `TabixPAFAdapter` → `MultiPairGetFeatures` →
  `GpuMultiSyntenyRenderer` path renders allele-colored SNP ticks and indel
  glyphs on the haplotype rows. One track, one file, one display; no separate
  VCF and no sample-name join (adr-030). See "Per-base variant detail" below.
- **Copy number / paralogy** needs no special data: a duplicated reference
  region appears at two reference x-positions and the haplotype's row simply
  has a block at each. The only renderer case is a copy-number *gain*
  (overlapping blocks within one row) — a draw-time concern, not a data one.

### Graph views — two complementary renderers

`vg find -p region -c context` → GFA → render. Sub-second for regions ≤ 100 kb;
past a size cap both views say "zoom in to view graph" — there is no "large
mode" fallback (adr-027). This is the odgi `extract_selected_loci` workflow.

The same `GetSubgraph` GFA feeds two interchangeable renderers, both launchable
from `MultiLGVSyntenyDisplay`'s feature/track menus (`SUBGRAPH_VIEW_TYPES`) and
standalone via their import forms (file/URL or a `GfaTabixAdapter` track + locus):

- **GraphGenomeView** — Bandage-style 2-D layout (OGDF FMMM force-directed,
  computed in a worker via the `GraphComputeLayout` RPC). Best for tangled
  topology; imposes no left-to-right order.
- **TubeMapView** — SequenceTubeMap-style linearized lane layout; each
  haplotype path is an explicit ribbon threading shared nodes. Best for reading
  "which haplotype goes where". The lane layout is a few main-thread array
  passes — no worker.

GFA parsing is shared between the two via `@jbrowse/graph-core` (`parseGFA`).

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

## Per-base variant detail — `cs:`-enriched synteny PAF (adr-030)

Per-base SNP/indel detail is **not** a separate `vg deconstruct` VCF track and
**not** a `variantsAdapter` display-config slot. Both block structure and
per-base detail live in **one `cs:`-tagged synteny PAF**, rendered by the
existing `TabixPAFAdapter` → `MultiPairGetFeatures` → `GpuMultiSyntenyRenderer`
path — no new config slot, RPC, or shader. The fragile PanSN-↔-VCF sample-name
join is gone: a `cs:` string is intrinsic to the block it tags, and the block
already belongs to a known haplotype. Rationale and what it supersedes:
`adr-030`.

The runtime side is proven (a crafted `cs:`-tagged fixture renders
allele-colored SNP ticks and indel glyphs correctly). All remaining work is
**offline data prep**: enriching the untangle PAF with `cs:`. `odgi untangle`
gives the graph-aware block structure; `minimap2 --cs` per block adds the
base-level `cs:` tag. The data-prep workstream is in "Next steps" below.

**Open decision (settled by the volvox prototype):** *enrich* the untangle PAF
with `cs:` (keeps untangle's graph-aware block structure — recommended) vs.
*replace* it with a per-haplotype `minimap2 --cs` PAF (simpler, naturally has
`cs:`, but sequence-aligned not graph-aware — diverges from adr-024).

## Pipeline viability audit (2026-05-14)

Audited the documented preprocessing recipes against the runtime code and the
cross-referenced tool docs.

- **`jaccardFilter` round-trips — verified.** `odgi untangle` carries `jc:f:`
  into the PAF; `TabixPAFAdapter` has a `jaccardFilter` config slot and drops
  blocks with `jc:f:` below the floor (`TabixPAFAdapter.ts`, `configSchema.ts`).
  `pafIdentity` prefers untangle's `id:f:`. The "bake permissive, filter up at
  runtime" design is actually implemented, not just planned.
- **`tools/gfa-to-tabix` is partially stale.** adr-024 retired the
  `synteny_build` → `synteny.bed.gz` path, but `main.rs` still contains
  `synteny_build` and the README still lists `synteny.bed.gz` /
  `synteny.rev.bed.gz` as outputs. The tool is *not* fully retired — its
  `pos.bed.gz` / `edges.spatial.bed.gz` still feed GraphGenomeView's
  `GetSubgraph`. The README needs to be split: keep the GetSubgraph outputs,
  drop the retired synteny ones.
- **Stale `test_data/hprc` artifacts.** `bubbles.bed.gz` (adr-025),
  `graph.coarse.bed.gz` / `synteny.coarse.bed.gz` (adr-026) and
  `synteny.bed.gz` (adr-024) are committed leftovers from retired pipelines;
  only `synteny.paf.gz` is current. Safe to remove once nothing references them.

## Known limitations

- **untangle output is unaudited.** The old `synteny_build` had a (weak) audit
  harness; untangle replaces it untested. Needs a correctness check (against
  `vg deconstruct`, or the source alignment) before publication.
- **The vendored odgi build is unstable** — broken `unchop`/`view`, segfaults
  on unsorted graphs. Needs a version-pinned, known-good odgi.
- **Per-base detail depends on `cs:` enrichment** — a block tagged `id:f:96`
  alone hides where the 4 % divergence is; the per-base positioning comes from
  the `cs:` tag, which the offline prep step must add (adr-030). A PAF without
  `cs:` renders block-level only.
- **Linearization can't show non-reference sequence.** Haplotype-novel
  insertions / unplaceable contigs are absent or degenerate-blocked. The
  graph view is the answer for that sequence.
- **chr20 is segdup-poor** (4 large intra-chr segdups). The segdup handling
  story should be re-checked on a segdup-heavy chromosome (chr1, chr16).
- **untangle determinism** under 16 threads is unverified — matters for a
  reproducible published pipeline.

## Cross-reference: PangyPlot / BubbleGun (2026-05-14)

Checked our approach against PangyPlot (Mastromatteo et al. 2025, bioRxiv —
vendored at `~/src/vendor/pangyplot`), a published pangenome graph browser, and
against Bandage, odgi, SequenceTubeMap and vg docs. Our *individual* approaches
hold up: Bandage uses OGDF FMMM exactly as `GraphComputeLayout` does; `odgi
untangle -R` → PAF is its intended linearization use; `vg find -p -c` is the
documented subgraph-extraction recipe.

The one substantive divergence is **graph simplification**, and it is the
reason GraphGenomeView caps at 100 kb (adr-027):

| | PangyPlot | GraphGenomeView |
|---|---|---|
| 2-D layout | `odgi layout` SGD, **precomputed offline**, baked into a SQLite index | OGDF FMMM, **recomputed live in a worker** on every subgraph load |
| Simplification | **BubbleGun** bubble/superbubble hierarchy; sub-threshold bubbles collapse to one node | none — every GFA segment is a node |
| Large regions | abstract via the hierarchy; rendered node count stays bounded | declined past 100 kb |

The 100 kb cap is a workaround for not having simplification. PangyPlot's
preprocessing (`pangyplot/preprocess/bubble/`): compact the graph, run BubbleGun
`find_bubbles`/`connect_bubbles`/`find_parents`, store a nested bubble index;
at query time `decompose_chain` expands chains only down to a size threshold so
sub-threshold bubbles render as single nodes. adr-026 removed coarsening for the
*synteny* path; bubble-collapse for the *2-D graph* path is a different,
still-open question. Also note PangyPlot precomputes layout (deterministic);
our live FMMM is non-deterministic between runs — `refetchIfNeeded` re-running
it on session restore is a snapshot-flakiness risk.

Decision (adr-028): adopt offline `odgi layout` as the primary layout source
with live FMMM as fallback, and replace the arbitrary 100 kb bp cap with a
node-count limit. BubbleGun-style bubble-collapse to push the node ceiling
higher remains future work, not yet scheduled.

Soft flag from the same review: `vg find` extraction latency — not WebGL
rendering — is the documented real-world bottleneck in tools like
SequenceTubeMap, so it is the thing to instrument and budget.

## Next steps

Three workstreams. The `cs:`-PAF data prep (A) and the GraphGenomeView phases
(B) are independent; the cross-cutting items (C) gate publication.

### Workstream A — `cs:`-enriched synteny PAF data prep (adr-030)

The runtime is proven; this is all offline data prep.

- **Prototype on volvox** — script: untangle PAF → per block extract query +
  target subsequences (handle PanSN names, subwalk suffixes like
  `volvox#0#ctgB:0-6079`, strand) → `minimap2 --cs` → append `cs:Z:` → bgzip +
  tabix. Validate it renders with the diagnostic harness. Settles the
  enrich-vs-replace open decision.
- **Scale to chr20** — ~27 k blocks; a naive per-block `minimap2` subprocess is
  too slow. Batch (all block query-subseqs in one FASTA, matched back by record
  name) or per-haplotype-align-then-slice; benchmark and pick. Produce
  `hprc-v1.1-mc-grch38-chr20.synteny.cs.paf.gz`.
- **Productionize the prep tool** — committed script under `tools/` first; Rust
  port into `tools/gfa-to-tabix` only if perf demands it.
- **Migrate CI** — regenerate the committed `volvox.untangle.paf.gz` fixture
  `cs:`-enriched so `multi-lgv-tabix-paf.ts` exercises per-base rendering;
  migrate `multi-lgv-pangenome-vcf.ts` / `MultiLGVSyntenyPangenome.test.tsx`
  off the VCF shape; enrich the committed chr20 PAF; add an explicit
  mismatch/indel-renders assertion (not just "canvas non-blank").

### Workstream B — GraphGenomeView skeleton/detail (adr-028 → adr-029)

Four phases, each independently shippable; phase 3 is the headline
whole-chromosome overview.

- **Phase 1 (adr-028)** — offline layout as a GFA `LO` segment tag, FMMM
  fallback, node-count interim limit: widen the per-ordinal binary, emit/parse
  the tag, add the `parseAndLayout` fallback branch, swap `MAX_GRAPH_REGION_BP`
  for the node-count limit, add the `odgi layout` preprocessing step.
- **Phase 2** — bubble-hierarchy preprocessing (BubbleGun-equivalent) → static
  bubble index + adapter read path. Validatable in isolation.
- **Phase 3** — skeleton tier: multi-resolution polyline preprocessing +
  skeleton overview rendering. Whole-chromosome overview works here; the
  node-count limit is lifted for the overview path.
- **Phase 4** — detail tier: progressive `decompose_chain`-style expansion, the
  two-tier handoff, subgraph layout anchored to skeleton polylines.

Per-phase ADRs nail the index/binary formats and RPC surface as each is built.

### Workstream C — cross-cutting / publication gates

- Correctness check of untangle output (vs. `vg deconstruct` as an oracle, or
  the source alignment) before publication.
- Re-run the segdup multi-mapping check on a segdup-heavy chromosome (chr1/16).
- Confirm the `vg find` / `graph-server` path for GraphGenomeView.
- Static-vs-service browser comparison; pick the delivery model.
- Version-pin odgi + vg; verify untangle thread-determinism.
- Clean up the partially-stale `tools/gfa-to-tabix` (README + retired
  `synteny_build`) and the stale `test_data/hprc` artifacts — see "Pipeline
  viability audit".

## `TabixPAFAdapter` preprocessing requirement

The browse path must work at full-genome scale, so the adapter cannot scan the
PAF to enumerate query genomes. The genome list is read from a single
`#genomes=` comment line the preprocessing prepends before bgzip:

```
odgi paths -L <ref>.og | <derive sample#hap, unique>  →  "#genomes=HG00438#1,HG00438#2,..."
( echo "#genomes=..."; odgi untangle ... | sort -k6,6 -k8,8n ) | bgzip > <ref>.synteny.paf.gz
tabix -0 -s6 -b8 -e9 <ref>.synteny.paf.gz
```

`#` lines are skipped by tabix and returned by `getHeader()`. A file with no
header still works if the track config sets `assemblyNames` explicitly.

## chr20 proof-of-concept (verified 2026-05-14)

The full pipeline runs end-to-end on the HPRC chr20 graph:

```
chr20.gfa.og (919 paths, 90 genomes, 1.86 M nodes)
  → odgi untangle -r GRCh38#0#chr20:0-64444167 -j 0.1 -m 1000 -n 1 -p   (~1 m 40 s)
  → strip trailing tab | sort -k6,6 -k8,8n | prepend #genomes= | bgzip   (580 KB)
  → tabix -0 -s6 -b8 -e9
  → TabixPAFAdapter  (jaccardFilter: 0.5 in the track config — files baked
                      permissive at -j 0.1, filtered up at runtime)
```

Result: 26,862 blocks for the whole chromosome; a `chr20:1-500,000` view
returns ~2,400 blocks and renders ~89 haplotype rows in `MultiLGVSyntenyDisplay`
in the browser. Coverage:

- `plugins/comparative-adapters/src/TabixPAFAdapter/TabixPAFAdapter.test.ts`
  — committed unit tests over a volvox fixture
  (`test_data/volvox/volvox.untangle.paf.gz`) whose target names mirror real
  odgi shape: plain `volvox#0#ctgA` and subwalk-suffixed `volvox#0#ctgB:0-6079`,
  `id:f:` as a percentage, `jc:f:`/`sc:f:`/`nb:i:` tags.
- `products/jbrowse-web/browser-tests/suites/multi-lgv-tabix-paf.ts` — CI
  browser test on the volvox fixture.
- `products/jbrowse-web/browser-tests/suites/multi-lgv-pangenome-vcf.ts` /
  `products/jbrowse-web/src/tests/MultiLGVSyntenyPangenome.test.tsx` — CI
  stand-ins on local volvox data. These currently mirror the retired
  untangle-PAF-plus-separate-VCF shape and are being migrated to the single
  `cs:`-enriched PAF (adr-030) — see "Next steps".
- `products/jbrowse-web/browser-tests/suites/hprc-pangenome.ts` — the chr20
  PoC, `requiresRemote` (config `test_data/hprc/config_hprc_chr20_untangle.json`).
  The 580 KB `test_data/hprc/hprc-v1.1-mc-grch38-chr20.synteny.paf.gz` is
  committed (gitignore exception); the chrM data and the chr20 VCF/cytoband
  load from S3 at runtime. Run it with `runner.ts --smoke` (or the
  `test:browser:smoke` script), which enables every `requiresRemote` suite.
- `products/jbrowse-web/browser-tests/suites/graph-genome-tabix.ts` — the
  large-mode removal: the over-cap region now asserts the "zoom in to view
  graph" message instead of a rectangle canvas.

## What was removed (see ADRs)

| Removed | Replacement | ADR |
|---|---|---|
| GfaTabix `synteny_build` O(ref×hap) pipeline, `synteny.bed.gz` / `.rev` / `.coarse` | whole-graph `odgi untangle` → tabix PAF | adr-024 |
| `bubbles.bed.gz` overlay, X-CIGAR contract, `bubbleOverlay.ts` | `vg deconstruct` VCF track (per-base mechanism later superseded — adr-030) | adr-025 |
| Graph coarsening tier (tile + snarl, `graph.coarse.bed.gz`, `GRAPH_COARSE_*`) | resolution-independent untangle blocks + render-time merge | adr-026 (supersedes adr-014) |
| GraphGenomeView "large mode" (coloured rectangles > 100 kb) | one mode — `vg find` subgraph extraction, "zoom in" past a size cap | adr-027 |
| `vg deconstruct` VCF track + `variantsAdapter` display-config design (planned, never built) | `cs:`-enriched synteny PAF — block + per-base detail in one track | adr-030 |

## See also

- `GRAPH_PERF.md` — untangle benchmark, segfault and segdup investigations.
- `GRAPH_SERVER_PLAN.md` — graph-server's role under the new design.
- `architecture-decision-records/adr-024..027` — rationale for what was
  removed; the retired GfaTabix static-index docs were deleted, the ADRs are
  the record of that design.
- `GRAPH_AUDIT.md` — read-only archive of the retired GfaTabix Phase 0 audit.
