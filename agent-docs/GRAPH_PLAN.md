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

- **Per-base SNP/indel detail** is the separate `variants.vcf.gz` VCF track
  (standard JBrowse variant track). Not overlaid on the synteny display in v1;
  see "Per-base variant integration" below for the design space.
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

## Per-base variant integration (target architecture)

adr-025 closed by saying overlay-at-zoom is a possible later enhancement, and
the user wants the v2 to deliver "as much detail as possible." The target end
state — derived backwards from the user experience, not forwards from the v1
code — is **one track, one display, continuous zoom-driven detail**.

### End-state UX

A single `MultiLGVSyntenyDisplay` row per haplotype. Identity-colored synteny
blocks at any zoom; per-base SNP/indel markers that fade in continuously as
each variant position reaches ≥~1 px wide — same pattern as how alignments
tracks render reads as blocks with base-level mismatches at zoom-in. No tier,
no mode switch, no second track for the user to align by hand.

### Architecture

Two adapters, both owned by the display config (not reached across the
session):

```json
{
  "type": "MultiSyntenyTrack",
  "adapter": { "type": "TabixPAFAdapter", "pafGzLocation": "..." },
  "displays": [
    {
      "type": "MultiLGVSyntenyDisplay",
      "variantsAdapter": {
        "type": "VcfTabixAdapter",
        "vcfGzLocation": "...variants.vcf.gz",
        "index": { ... }
      },
      "sampleNameMap": { "HG002.1": "HG002#1" }
    }
  ]
}
```

- **Synteny adapter** stays on the track, unchanged.
- **Variants adapter** is a config slot on the display — the display owns it
  as a dependency, the same way `LinearAlignmentsDisplay` sub-displays own
  their per-display configs. *Not* a `variantOverlayTrackId` borrow from a
  sibling track.
- **`sampleNameMap`** sits at the one place the PanSN-↔-VCF-GT-header join
  happens. Explicit, consumer-side, fails loudly when a sample is unmatched
  (`vg deconstruct` and `bcftools merge` write sample headers inconsistently).
- **Optional.** Omit `variantsAdapter` and the display behaves exactly like
  v1. Adding it doesn't change the synteny code path, it adds a second pass.

### Data flow

Worker:
1. `getMultiPairFeatures` returns synteny blocks from the PAF as today.
2. If `variantsAdapter` is configured, the same RPC call additionally fetches
   VCF features for the region and emits a `Map<sample, VariantTick[]>`
   keyed by the post-`sampleNameMap` PanSN name.
3. Worker returns both in one `rpcDataMap`, so the main thread gets a
   consolidated payload (same pattern as the existing synteny RPC).

Main thread:
1. Render synteny blocks per row (unchanged).
2. For each row, look up that row's `queryGenome` in the variant tick map and
   draw markers at variant positions where the sample carries alt. SNPs as
   colored ticks, indels as wedges sized by length.
3. Visibility is bpPerPx-continuous via the alignments pattern — no mode
   switch.

### Why this is the right shape, not a step toward it

The four-ADR simplification arc (024–027) was about removing legacy
abstractions and reaching the natural design. Stopping at "two row-locked
tracks the user must assemble themselves" because it requires no new code
isn't reaching the natural design; it's offloading the integration onto the
user. The display is the right integration point because it's where the join
becomes visible.

The three concerns that defeated a naïve overlay design (`bpPerPx` mode,
sample-name brittleness, cross-track coupling) all dissolve under this
architecture:

- **No mode.** Continuous render-time density, same as the alignments tracks
  that already exist. Users don't learn a new behavior.
- **Sample-name join is explicit and local.** `sampleNameMap` config slot,
  unmatched samples logged. The X-CIGAR failure mode was producer-side and
  implicit; this is consumer-side and explicit.
- **No cross-track reach.** The variants adapter is declared as part of the
  display config. Self-contained track, session-snapshot-safe.

### Known unresolved questions (for a follow-up ADR)

- **Reference-allele-only positions.** VCF semantics: no record at a variant
  site means "ref allele." Should the display show ticks for *every*
  variant site (gray for ref-match) or only alt-carrying positions? Affects
  both renderer cost and visual readability.
- **Indel glyph at varying zooms.** A 500 bp deletion vs. a 1 bp SNP need
  different glyphs at the same screen density. Probably resolved by length
  thresholds, but real design work.
- **VCF coverage vs. variant absence.** A block colored `id:0.97` with no
  ticks could mean "no variants in VCF for these samples" or "VCF doesn't
  cover this region." Block-level "VCF coverage exists for this region"
  rendering would disambiguate.
- **Server-backed path.** `GfaServerAdapter` is a parallel synteny adapter
  for graph-server. If the display takes a `variantsAdapter` independent of
  the synteny adapter, the server path gets variant overlay for free —
  worth verifying.

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
- Confirm `vg find` / `graph-server` path for GraphGenomeView.
- Static-vs-service browser comparison; pick the delivery model.
- Version-pin odgi + vg; verify untangle thread-determinism.

### `TabixPAFAdapter` preprocessing requirement

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

### chr20 proof-of-concept (verified 2026-05-14)

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
- `products/jbrowse-web/browser-tests/suites/hprc-pangenome.ts` — the chr20
  PoC, `requiresRemote` (config `test_data/hprc/config_hprc_chr20_untangle.json`,
  data is the gitignored `test_data/hprc/*.synteny.paf.gz`).
- `products/jbrowse-web/browser-tests/suites/graph-genome-tabix.ts` — the
  large-mode removal: the over-cap region now asserts the "zoom in to view
  graph" message instead of a rectangle canvas.

## What was removed (see ADRs)

| Removed | Replacement | ADR |
|---|---|---|
| GfaTabix `synteny_build` O(ref×hap) pipeline, `synteny.bed.gz` / `.rev` / `.coarse` | whole-graph `odgi untangle` → tabix PAF | adr-024 |
| `bubbles.bed.gz` overlay, X-CIGAR contract, `bubbleOverlay.ts` | `vg deconstruct` VCF track | adr-025 |
| Graph coarsening tier (tile + snarl, `graph.coarse.bed.gz`, `GRAPH_COARSE_*`) | resolution-independent untangle blocks + render-time merge | adr-026 (supersedes adr-014) |
| GraphGenomeView "large mode" (coloured rectangles > 100 kb) | one mode — `vg find` subgraph extraction, "zoom in" past a size cap | adr-027 |

## See also

- `GRAPH_PERF.md` — untangle benchmark, segfault and segdup investigations.
- `GRAPH_SERVER_PLAN.md` — graph-server's role under the new design.
- `architecture-decision-records/adr-024..027` — rationale for what was
  removed; the retired GfaTabix static-index docs were deleted, the ADRs are
  the record of that design.
- `GRAPH_AUDIT.md` — read-only archive of the retired GfaTabix Phase 0 audit.
