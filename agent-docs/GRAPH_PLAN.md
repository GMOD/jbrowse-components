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

## Scope: what we are building, what we are not

This section is the honest one. Read before publication framing.

### What v1 is

A **linearized pangenome browse** — each haplotype as a row of synteny blocks
against a single reference (GRCh38), with per-base SNP/indel ticks rendered
inside each block. Plus a standard JBrowse VCF track for the same variants.
No server; static tabix-indexed files; runs in any JBrowse deployment.

The implementation re-uses three things rather than inventing them:

- **`odgi untangle`** projects haplotype paths against the reference into PAF
  blocks. Standard pangenome tool.
- **`vg deconstruct -a -u`** decomposes the graph into per-snarl variant
  records with `AT/AP/LV/PS` graph-aware fields. Standard pangenome tool.
- **JBrowse's existing alignments-style cs:Z: renderer** draws SNP ticks /
  indel glyphs / coverage rows. Built for read-vs-reference; we're feeding it
  haplotype-vs-reference data.

The new code is roughly: a 200-line Python script
(`tools/enrich-untangle-paf/project-vcf-to-cs-paf.py`) that joins the two
tool outputs into a single `cs:`-enriched PAF, plus the synteny display
plumbing (already done for ordinary PAF).

### What v1 actually achieves

- HPRC-scale pangenome browse in the genome browser most academic biologists
  already use, against a reference they recognize, with no server to run.
  This is a real gap to fill — PangyPlot needs Flask, SequenceTubeMap needs
  `vg`, IGV doesn't do pangenome at all.
- Demonstrably renders end-to-end on volvox (51 paths) and HPRC chr20
  (90 haplotypes) — see "Working demos" below.
- Two artifacts, no runtime join — clean separation between block geometry
  and per-base detail; standalone variant track preserves full vg deconstruct
  output for filter/widget UX.

### What v1 is *not*

It is not "proper pangenome visualization." Concretely, here are the things
the architecture can't do and the reasons why:

- **No node-ID provenance on synteny ticks.** A SNP tick on the synteny
  display can't link back to the graph node it came from, because the cs:Z:
  format carries only sequence — no `AT` traversal, no node IDs. The
  standalone variant track has node IDs but they're in a separate display
  with no cross-link. A real graph-pangenome viewer would let you click a
  SNP and jump to that node in a graph view.
- **Snarl decomposition is flattened.** `vg deconstruct -a` emits nested
  snarls with `LV/PS`; cs:Z: is intrinsically flat (a linear walk). On
  chr20 the script silently drops 282k overlapping variants to keep the cs
  string monotonic. The dropped detail is real graph-aware information.
- **`odgi untangle` and `vg deconstruct` decompose the graph differently.**
  Untangle gives reference-relative blocks; deconstruct gives snarl-rooted
  variants. They don't align at boundaries. The projection script handles
  this by anchoring variants to whichever block contains the reference
  position, but the choice is heuristic — a snarl that straddles two
  untangle blocks gets clipped.
- **Untangle's strand column is graph-internal, not biological.** ~51% of
  chr20 bp tags `-` strand even after `odgi groom`, because untangle's
  threshold is "majority of node traversals are inverted in graph
  representation," which is largely a graph-construction artifact. We
  ignore the strand column and project unconditionally — a workaround,
  not a fix.
- **Reference-bound by design.** The whole synteny view assumes one
  reference path is the anchor. A user can't pick a different anchor (any
  haplotype as the reference) without re-running the full prep pipeline
  per anchor. The architecture supports it (cs-PAF is just (query, target)),
  but the multi-anchor flow isn't built. See "Beyond reference-bound" below.
- **Visual overload at zoom + scale.** 88 haplotypes × per-base detail in a
  20kb window produces ~16k mismatch ticks in the chr20 demo. That's
  honest data but not useful as visualization. Real pangenome viz needs
  haplotype clustering by population, allele-frequency filters, or zoom
  thresholds that swap to a different representation.
- **Re-uses a renderer designed for short reads.** The cs:Z: → SNP-tick +
  indel-glyph + indicator-triangle pipeline was built for read alignments.
  Concepts like the "indicator triangle" don't have a clean meaning for
  haplotype data; we get them anyway because we're piggybacking on the
  existing renderer. A pangenome-native renderer would have a different
  visual vocabulary.

### What "ideal" looks like

The destination this is a step toward, not the destination itself. In rough
order of how much architectural change each requires:

- **Honest visual treatment of inversions, multi-mapping, novel insertions,
  and nested bubbles.** Distinct glyphs for each, instead of "every linearized
  artifact looks like a SNP tick or an absent block." Renderer work; doesn't
  change the data model.
- **Allele-frequency filtering and haplotype clustering.** "Show only
  variants present in >5% of haplotypes," "group haplotypes by 1KG
  super-population." Display-level controls; the underlying data is
  unchanged.
- **Cross-link between synteny ticks and graph nodes.** Requires carrying
  node IDs through the prep pipeline (the `AT` field from `vg deconstruct`
  is the source) — possibly as a separate per-block tag alongside cs:Z:,
  not in the cs string itself. The graph view (GraphGenomeView /
  TubeMapView) already exists and uses node IDs; this just needs the join
  key to be preserved.
- **Multi-vantage-point linearization** (any haplotype as anchor, not just
  GRCh38). See "Beyond reference-bound: multi-vantage-point linearization"
  below. The architecturally clean path is `impg query` over a TPA-indexed
  near-all-vs-all alignment, with a runtime `ImpgTpaAdapter` (or
  `graph-server` endpoint) returning viewport-bounded `=`/`X` CIGAR for
  any chosen anchor.
- **Viewport-bounded per-base reconstruction.** Today the cs strings are
  baked at prep time and cover the whole chromosome. With impg+tracepoints,
  per-base detail is reconstructed only for the visible window — scales
  with view, not with chromosome size.
- **A renderer designed for haplotype-vs-haplotype data.** Not a re-skin of
  the alignment renderer. Per-haplotype color, snarl-aware grouping,
  population-stratified summaries. Largest scope item; deferred until v1
  reveals what users actually want.

### How to frame this externally

For publication / community-facing material, the framing should be:
*"first-class HPRC pangenome support in JBrowse, deliberately scoped to a
reference-anchored linearized view as v1, with a documented v2 path for
multi-anchor and graph-native variant linking."* Both halves matter. The
graph-pangenome community is tired of viz tools that overclaim; honesty
about what linearization can and can't show is itself a feature.

The unique deployment story (static-file, ship-anywhere, runs in the
academic-default genome browser) is real value even at v1 scope. It's not
"the" answer to pangenome visualization; it's the answer for users who want
HPRC variation against GRCh38 in a familiar interface.

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

## Per-base variant detail — `cs:`-enriched synteny PAF + standalone VCF (adr-030)

Two artifacts, no runtime join between them:

- **Synteny display** consumes a single **`cs:`-enriched untangle PAF**.
  Both block structure and per-base detail in one file, rendered by the
  existing `TabixPAFAdapter` → `MultiPairGetFeatures` →
  `GpuMultiSyntenyRenderer` path — no new config slot, RPC, or shader. The
  `cs:` strings are derived offline using one of (preferred) `impg query`
  over a TPA-indexed all-vs-all alignment, or `vg deconstruct -a -u` AP/AT
  projection. `minimap2 --cs` is fallback only.
- **Standalone variant track** ships the `vg deconstruct -a -u` VCF as a
  standard JBrowse variant track. Standard variant feature widget, genotype
  matrix, and filter UX preserved. Independent of the synteny display.
- **(Phase 2)** ship the TPA artifact and add an `ImpgTpaAdapter` that wraps
  `impg query` for viewport-bounded per-base reconstruction. The static
  cs-PAF becomes redundant once this lands.

The runtime side of the synteny display is proven (a crafted `cs:`-tagged
fixture renders allele-colored SNP ticks and indel glyphs correctly). All
remaining work is **offline data prep**: AP/AT projection. The data-prep
workstream lives in `CS_ENRICHED_PAF_PLAN.md` and "Next steps" below.

**Why impg + tracepoints, not minimap2 re-alignment.** `impg query` over a
TPA index reconstructs exact `=`/`X` CIGAR for the requested range by lazily
re-running BiWFA on the underlying sequences guided by stored tracepoints
(github.com/AndreaGuarracino/tracepoints — adaptive sparse anchors,
score-lossless reconstruction). It directly answers "give me per-base
alignment for haplotype H against the reference in window W" — exactly the
problem we were about to hand-roll with per-block minimap2 spawns. The TPA
input is the same all-vs-all PAF that built the graph (wfmash output for
PGGB, or `minimap2 -X --eqx -c`); no graph re-derivation is happening.

**Why also keep `vg deconstruct -a -u`.** `AT/AP/LV/PS` carry node IDs,
reference-relative allele positions, and snarl nesting — graph-derived data
that impg's sequence-coordinate output can't reproduce. Use `vg deconstruct`
when the synteny display itself needs node-ID-anchored ticks (e.g., to link
back to the graph view); otherwise it's the standalone variant track's data
source.

**Why keep the VCF artifact.** Standard JBrowse variant-track UX (feature
widget, genotype matrix, filtering) is a real win for users coming from a VCF
world. Two artifacts cost nothing once the runtime join is offline.

**Why not reinvent any of this.** impg, tracepoints, TPA, `vg deconstruct -u`
each solve a piece we were about to write ourselves. The custom solution we
were converging on was minimap2-per-block + a hand-rolled snarl-aware
graph-walk; both are subsumed by these existing tools. See ADR-030 "Rejected
alternatives".

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
- **Linearization is fundamentally lossy.** Several pangenome features cannot
  be faithfully linearized; surface each in the renderer rather than dropping
  silently:
  - **Haplotype-novel insertions** — no reference coordinate. Render an
    insertion glyph at the position, not absence. The graph view is the full
    answer.
  - **Multi-mapping (segdups, paralogy)** — `odgi untangle -n 1` keeps one
    best mapping; the other paralog vanishes. Surface `n.th > 1` mappings if
    we ever bake them.
  - **Inversions** — currently negative-strand blocks. Distinguish visually
    from substitutions.
  - **Nested bubbles** — flattened by the cs-PAF row layout. The variant
    track preserves `LV/PS`; cross-link from a synteny tooltip to the variant
    feature widget.
  - **Unplaceable contigs** — absent.
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

## Beyond reference-bound: multi-vantage-point linearization (forward-looking)

A pangenome's natural shape is "any path can be the anchor" — not "all paths
are projected against GRCh38." A reference-bound display under-uses the
graph: the same graph linearized against CHM13 vs GRCh38 vs HG002#1 reveals
genuinely different structure (segdup boundaries shift, "novel" insertions
become reference matches and vice versa, paralogy decisions flip). The
long-term direction is **user-pickable vantage point**: any haplotype as the
anchor, with all other haplotypes laid out against it.

This is *not* the HPRC v1 design (reference-bound is fine for v1). But it
shapes the v2+ architecture and should inform what we commit to now.

### Why this re-prioritizes impg+tracepoints

Reference-bound is a star topology — n haplotype-vs-reference alignments,
shipped as a single cs-PAF. Multi-anchor is many-to-many — n possible
anchors × (n-1) other haplotypes = O(n²) potential views. Three approaches,
none free:

- **Pre-bake all anchors.** n cs-PAFs, one per possible anchor. Quadratic
  file count, intractable at HPRC scale (90+ haplotypes → 90+ files per
  chromosome, each 580 KB-ish on chr20 → manageable, but extends linearly
  with n and combines awkwardly with `vg deconstruct` per-anchor runs).
- **On-demand with a server.** `graph-server` runs `odgi untangle -R <anchor>`
  + `vg deconstruct -p <anchor> -u` per request. Fresh, any anchor, but
  requires a process — conflicts with the static-files deployment story for
  the browse path.
- **Pre-bake the alignment graph once, query per anchor.** `impg index`
  over a (subset-of-)all-vs-all PAF; at runtime `impg query -r <anchor>:<range>`
  returns viewport-bounded reconstructed CIGAR with *any sequence* as the
  target. The static artifact is one TPA file, not n. This is the impg
  design center — its `query` flag takes any target, and `-x` transitive
  closure compensates for missing direct alignments (which is what makes
  HPRC's "subset-not-true-all-vs-all" direction tractable).

The third option is the only one that scales gracefully *and* matches HPRC's
forward direction (subset alignments + transitive closure → near-all-vs-all
queryability). It does require:

- An all-vs-all-ish source PAF — generated ourselves (wfmash with `-X` for
  segment-mapping subset), since HPRC won't publish one.
- A runtime path for `impg query` (graph-server endpoint, or impg compiled
  to WASM long-term).
- A UI for picking the anchor — new model state on `MultiLGVSyntenyDisplay`,
  refetch on change.

### Why `vg deconstruct` doesn't trivially generalize

`vg deconstruct -p <ref>` accepts any path as the reference. To support n
anchors you'd run n times → n VCFs. Each VCF is a complete restatement of
the variation; this duplicates data quadratically. Unlike impg, vg
deconstruct has no equivalent to "one index, query with any target."

That said: `vg deconstruct` **could** stay as the per-anchor variant track
(spawned on demand server-side), with impg as the synteny display backend.
Same two-artifact story, just both are anchor-parametric.

### Implications for v1

- **Don't paint v1 into a reference-bound corner.** The cs-PAF format and
  `MultiLGVSyntenyDisplay`'s data model are reference-agnostic on their face
  — a PAF is just (query, target) and the display plots queries against a
  target. The model doesn't need to know which path "is the reference." Keep
  it that way; don't hardcode GRCh38 anywhere.
- **Defer the impg+tracepoints prototype, but stop calling it "deferred
  forever."** It is the v2 path. Workstream A's "deferred" upgrade should
  call out multi-anchor as the use case that brings it forward.
- **The "no-server" deployment story bends, but doesn't break.** v1 ships
  static cs-PAF + VCF, reference-anchored, no server. v2 (multi-anchor)
  needs `graph-server` *or* a WASM impg. That's a deliberate deployment
  tradeoff users opt into when they want multi-anchor.

### What's missing to scope v2

- A direct comparison of the same locus linearized against different anchors
  (eyeballed first, then formalized). This is the demo that proves the
  feature is worth the architectural cost. The HPRC chr20 graph has the
  segdups for an interesting case; pick a known segdup region, untangle
  with `-R GRCh38` vs `-R CHM13` vs `-R HG002#1`, compare visually.
- A wfmash-`-X` cost benchmark on HPRC chr20 (FASTAs → subset PAF).
  Determines whether the all-vs-all-ish input is buildable in reasonable
  time on a workstation.
- A WASM-compilation feasibility check on impg + lib_wfa2. If WASM works,
  the runtime story is fully static (no server). If not, multi-anchor
  always needs `graph-server`.

## Cross-reference: impg + tracepoints (2026-05-14)

Audited the per-base derivation plan against `impg`
(github.com/pangenome/impg, vendored at `~/src/vendor/impg`) and the
`tracepoints` crate (github.com/AndreaGuarracino/tracepoints). Both directly
solve pieces we were about to hand-roll:

| Piece we needed | What we'd have built | What already exists |
|---|---|---|
| Compact per-block alignment store | bake `cs:` into PAF; one string per block | `tracepoints` (sparse coordinate-pair anchors) + TPA file format |
| Lazy per-window CIGAR reconstruction | run `minimap2 --cs` per block at bake time | `impg query` reconstructs `=`/`X` CIGAR for the queried range only via BiWFA, score-lossless |
| Range projection across haplotypes | per-block subprocess loop | `impg query -r ref:s-e -x` (transitive closure across the panel) |
| Indexed alignment access | tabix on cs-PAF | TPA + impg's coitree index, O(1) random access |

**What impg/tracepoints does *not* do:** preserve graph node IDs (purely
sequence-coordinate). For node-ID-anchored variants the standalone
`vg deconstruct -a -u` VCF track stays. impg replaces the *re-alignment*
step, not the *graph-derived variant* step.

**Source-data fit:** impg input is all-vs-all PAF (wfmash or `minimap2
--eqx`), 1ALN, or TPA. HPRC publishes wfmash all-vs-all PAFs alongside the
graph — exactly the format impg expects. The HPRC `.gbz` is bypassed for the
per-base layer only; block structure still comes from `odgi untangle` on the
`.og`. See `CS_ENRICHED_PAF_PLAN.md` "tracepoints / impg integration" for the
two integration shapes (bake-time vs runtime adapter).

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

## Working demos (verified 2026-05-14 / 2026-05-15)

### chr20 block-only (untangle PAF)

```
chr20.gfa.og (919 paths, 90 genomes, 1.86 M nodes)
  → odgi untangle -r GRCh38#0#chr20:0-64444167 -j 0.1 -m 1000 -n 1 -p   (~1 m 40 s)
  → strip trailing tab | sort -k6,6 -k8,8n | prepend #genomes= | bgzip   (580 KB)
  → tabix -0 -s6 -b8 -e9
  → TabixPAFAdapter  (jaccardFilter: 0.5 in the track config — files baked
                      permissive at -j 0.1, filtered up at runtime)
```

### chr20 cs-enriched (untangle PAF + vg deconstruct AP/AT projection)

End-to-end on the HPRC chr20 graph; per-base SNP/indel detail visible at zoom:

```
chr20.gfa (1.86 M nodes)
  → vg convert -g chr20.gfa -p > chr20.pg                                (~3 min)
  → vg deconstruct -P 'GRCh38#' -a -u chr20.pg | bgzip > variants.vcf.gz  (~5 min)
    [or, for the demo, the published S3 VCF — same shape]

  → tools/enrich-untangle-paf/project-vcf-to-cs-paf.py \
      --paf chr20.untangle.paf --vcf variants.vcf.gz --out chr20.cs.paf  (~50 s)
    [536k variants × 26.8k blocks; bisect-based start lookup]
  → sort -k6,6 -k8,8n | prepend #genomes= | bgzip                        (54 MB)
  → tabix -0 -s6 -b8 -e9
  → existing TabixPAFAdapter / MultiLGVSyntenyDisplay — zero new runtime code
```

Render confirmed: `chr20:100,000-120,000` view returned 16,475 mismatches and
7 insertion indicators across 88 haplotype rows, allele-colored ticks visible.
Track id `hprc_chr20_untangle_cs_paf` in
`test_data/hprc/config_hprc_chr20_untangle.json`.

The cs-enriched chr20 PAF is **not committed** (54 MB — too large for the
repo). Regenerate it with the recipe above and place at
`test_data/hprc/hprc-v1.1-mc-grch38-chr20.synteny.cs.paf.gz` (the gitignore
already covers `*.cs.paf.gz` via the `*.paf.gz` rule; the track config
points at the local path).

### volvox cs-enriched

Same pipeline on `volvox_pangenome_50.gfa` (51 paths, single contig, haploid):

- 384 variants from `vg deconstruct -a -u`
- 707 blocks from `odgi untangle`, 707 cs-tagged in 0.16s by the projection
- Render confirmed via diagnostic suite: 50 haplotype rows with allele-colored
  SNP ticks (T=red, A=green, G=orange, C=blue), insertion indicators, SNP
  coverage row. Track id `volvox_untangle_cs_paf` in
  `test_data/volvox/config.json`.

### Stats from the projection script (all artifacts above)

Beyond `n_blocks` / `n_with_cs`, the script logs:

- `fwd` / `rev` — block strand distribution (from untangle's column; see
  `[[feedback-untangle-strand-is-graph-internal]]` for why this isn't biology)
- `unmapped_sample` — PanSN sample names not present in the VCF GT header
- `overlap_skipped` — variants whose ref-anchor falls before the cs cursor
  (overlapping snarls, kept monotonic by dropping the later one — counted
  honestly, not silenced)
- `cross_block_clipped` — variants whose op extends past the block's tend
  (deletion / complex variants on block boundaries)

chr20 stats: 26.8k blocks (13.3k fwd / 13.3k rev), 26.5k with cs, 331
unmapped, 282k overlapping snarls dropped, 1.7k cross-block clips. The
overlap count is the visible cost of flattening a snarl-nested decomposition
into a flat cs string — see "Scope" section above.

### Multi-vantage-point demo (volvox, sample01 as anchor)

Validates that the architecture is anchor-agnostic — the same display, same
adapter, same renderer work with any haplotype as the reference, not just
GRCh38/`ref`. Recipe is identical, just swap the `-R` / `-P` arg:

```
echo 'sample01#0#ctgA' > sample01-ref.txt
odgi paths -i graph.og -L | grep -v '^sample01#' > sample01-queries.txt
odgi untangle -i graph.og -R sample01-ref.txt -Q sample01-queries.txt ...
vg deconstruct -P 'sample01#' -a -u graph.pg | bgzip > sample01.variants.vcf.gz
project-vcf-to-cs-paf.py --paf ... --vcf ... --out ...
```

Committed: `volvox.sample01.untangle.cs.paf.gz` + `volvox.sample01.variants.vcf.gz`,
new assembly `volvox-sample01-anchor` (regions-only, no refseq) and track
`volvox_untangle_cs_paf_sample01_anchor` in volvox config. Render confirmed:
50 haplotype rows including `ref#0` as one of them (no longer privileged),
all anchored on sample01's coordinate axis.

Production multi-anchor needs either pre-baking n cs-PAFs (one per anchor —
linear file count) or a runtime path via `impg query` (one TPA index, any
anchor as the query target — see "Beyond reference-bound" above). The volvox
demo uses pre-baking. The architecture supports either.

### AF filtering for visual scale (`--min-af`)

The projection script accepts `--min-af <threshold>` to drop ALTs below an
allele-frequency threshold (read from VCF INFO/AF, recomputed from GTs if
absent). On chr20 with `--min-af 0.05`: 608,775 of ~862k allele calls are
below 5% frequency — filtered out; output size drops from 52 MB to 29 MB.
Visual benefit is larger: ticks at zoom now show population-level common
variation instead of one-haplotype-only noise. Per-track choice; ship
multiple variants (`*.cs.paf.gz`, `*.cs.maf05.paf.gz`) and let users pick.

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
