# Plan: per-base variants via a `cs:`-enriched synteny PAF

> Agent handoff doc, written 2026-05-14. Self-contained — read this instead of
> re-investigating. Supersedes the "runtime `variantsAdapter` overlay" idea in
> `GRAPH_PLAN.md` "Per-base variant integration (target architecture)".

## Goal

Show per-base SNP/indel detail per haplotype row in `MultiLGVSyntenyDisplay`,
for HPRC-style graph pangenomes. The user wants the integration done as **an
offline data-prep step that JBrowse consumes trivially at runtime** — not a
fragile runtime join.

## Why NOT the runtime `variantsAdapter` overlay (but VCF still ships)

`GRAPH_PLAN.md` originally described a target architecture: a
`variantsAdapter` config slot on the display + `sampleNameMap`, fetching the
`vg deconstruct` VCF at runtime and overlaying ticks. **Don't build this** —
it forces a fragile join every render between PanSN haplotype rows
(`HG00438#1`) and VCF per-individual GTs (`HG00438` → `0|1`).

What we **do** want from the VCF — node IDs (`AT`), reference-relative allele
positions (`AP` from `-u`), snarl nesting (`LV/PS`) — is preserved by doing the
join **offline** (preprocess `AP/AT` into the cs-PAF) and by **also shipping
the VCF as a standalone variant track**. Two artifacts, two displays, no
runtime join.

## What is PROVEN (do not re-verify)

A `cs:`-tagged synteny PAF renders per-base SNPs (allele-colored) + indels on
the haplotype rows through the **existing** runtime path — **zero new runtime
code** (no config slot, no RPC, no shaders).

Original proof (2026-05-14, hand-crafted fixture): synthetic 5-block PAF with
known cs strings, mismatch counts and SNP-tick colors verified exact.

End-to-end pipeline proof (2026-05-14): real volvox graph, real tools, real
projection, rendered. See "Working demo" below.

## Working demo (2026-05-14)

End-to-end on `volvox_pangenome_50.gfa` (51 PanSN paths, ref + sample01..50):

```
odgi untangle -i volvox_pangenome_50.gfa.og -R ref-paths.txt \
  -Q query-paths.txt -n 1 -j 0 -m 0 -p > volvox.untangle.paf
                                                    # 707 blocks
vg convert -g volvox_pangenome_50.gfa -p > volvox.pg
vg deconstruct -P 'ref#' -a -u volvox.pg | bgzip > volvox.variants.vcf.gz
tabix -p vcf volvox.variants.vcf.gz                 # 384 variants

tools/enrich-untangle-paf/project-vcf-to-cs-paf.py \
  --paf volvox.untangle.paf \
  --vcf volvox.variants.vcf.gz \
  --out volvox.untangle.cs.paf
( echo "#genomes=..."; sort -k6,6 -k8,8n volvox.untangle.cs.paf ) \
  | bgzip > volvox.untangle.cs.paf.gz
tabix -0 -s6 -b8 -e9 volvox.untangle.cs.paf.gz
```

Committed artifacts:
- `test_data/volvox/volvox.untangle.cs.paf.gz` + `.tbi`
- `test_data/volvox/volvox.variants.vcf.gz` + `.tbi`
- New tracks `volvox_untangle_cs_paf` (synteny) and `volvox_variants_vcf`
  (standalone variant track) in `test_data/volvox/config.json`.
- `tools/enrich-untangle-paf/project-vcf-to-cs-paf.py` — sibling of the
  minimap2-based `enrich-untangle-paf.py`; documented as the preferred
  derivation backend for graph inputs.

Render confirmed via temporary diagnostic suite (since deleted): 50 haplotype
rows, allele-colored SNP ticks (T=red, A=green, G=orange, C=blue), insertion
indicator triangles, SNP coverage row. Model state showed mismatch counts and
positions populated from the cs strings flowing through the existing
`TabixPAFAdapter` → `MultiPairGetFeatures` → `GpuMultiSyntenyRenderer` path
with zero new runtime code.

Known artifact: dense substitution runs in `-` strand blocks reflect
vg deconstruct's reference-orientation allele decomposition rather than the
haplotype's actual divergence in alignment orientation. Listed as a known
limitation in the script docstring; treat strand-flipped blocks as a separate
display concern.

## Runtime path (already wired, for reference)

- `plugins/comparative-adapters/src/util.ts` `parsePAFLine` — parses PAF tags;
  `cs:Z::50*ag...` → `extra.cs = ':50*ag...'` (slices `colonIndex + 3`, so a
  cs value with a leading `:` round-trips correctly).
- `plugins/comparative-adapters/src/TabixPAFAdapter/TabixPAFAdapter.ts` ~line
  178 — `getMultiPairFeatures` sets `feature.cs = extra.cs`.
- `plugins/linear-comparative-view/src/LinearSyntenyRPC/MultiPairGetFeatures.ts`
  — RPC; for each feature with `f.cs` calls `extractMismatchesFromCs` /
  `extractIndelsFromCs`, then `computeSNPCoverage` /
  `computeInsertionIndicators`. Emits `snpPositions`, `mismatchPositions`,
  `mismatchBases`, `indicatorPositions` in `SyntenyRegionData`.
- `plugins/linear-comparative-view/src/LinearSyntenyRPC/syntenyRegionTypes.ts` —
  `SyntenyRegionData` type.
- `packages/alignments-core/src/labelConstants.ts` — `extractMismatchesFromCs`
  (~line 166), `extractIndelsFromCs` (~220), `parseCsSeqLen`, `isCsOpChar`.
- `.../MultiLGVSyntenyDisplay/components/GpuMultiSyntenyRenderer.ts` +
  `Canvas2DMultiSyntenyRenderer.ts` — consume `snpPositions` /
  `indicatorPositions`.
- `.../MultiLGVSyntenyDisplay/features/{mismatch,insertion,deletion,snpCoverage,indicator}/`
  — the per-feature renderers.
- `.../MultiLGVSyntenyDisplay/components/syntenyTestHelpers.ts` — test
  scaffolding that builds the cs-derived arrays; use for a jest-level test.

### `cs:` format (minimap2 short cs — what the extractors expect)

- `:N` — N matches (advances ref by N)
- `*XY` — substitution, X = ref base, Y = query base (recorded at current ref
  pos, with query base)
- `+seq` — insertion (does NOT advance ref)
- `-seq` — deletion (advances ref by len)

`extractMismatchesFromCs(cs, featureStart, out[])` records positions as
`featureStart + refPos`. In the RPC `featureStart = f.start = r.tstart` (the
block's **target/reference** start), so **`cs:` is relative to the block's
target start**, walks in target/reference orientation.

## Approach

There are three orthogonal axes the prep step touches; pick a tool per axis.

### Axis 1 — block structure (synteny rows)

`odgi untangle -R <ref>` on the `.og` graph. Graph-aware, projects path
ordinals against the reference. **Or** `impg query` over an all-vs-all PAF /
TPA / 1ALN: also reference-relative segments, but sequence-coordinate (no
graph). Untangle is the current default because it operates on the existing
`.og` artifact and stays in the graph world. impg is a viable swap if the
project moves to an all-vs-all-PAF source.

### Axis 2 — per-base detail (the `cs:` content)

Three candidates:

- **`vg deconstruct -a -u` AP/AT projection** (preferred for HPRC v1). The
  graph already encodes each haplotype's path against the reference;
  deconstruct walks it and emits AP-positioned variants directly. Preserves
  node IDs (`AT`), snarl nesting (`LV`/`PS`), reference-relative allele-step
  positions (`AP`). No new alignment step. No external alignment-source
  dependency. See "Source-data reality check" below for why this beats
  impg-from-all-vs-all.
- **`impg query` over a haplotype-vs-reference TPA** (deferred — runtime
  laziness upgrade path). impg+tracepoints reconstructs viewport-bounded
  exact `=`/`X` CIGAR; this becomes valuable if the synteny display ever
  wants per-window dynamism rather than baked-in `cs:` strings. Input
  source needs producing (HPRC does not publish all-vs-all PAF and is
  unlikely to in future — see below); the natural source is one
  haplotype-vs-reference alignment per haplotype, not n² all-vs-all.
- **`minimap2 --cs` per block** (fallback). Sequence-only re-derivation,
  discards node IDs, possible divergence from the graph's decomposition. Kept
  for graphs where neither path is workable.

### Axis 3 — node-ID-preserving variant track (separate, not on the synteny display)

Ship the `vg deconstruct -a -u` VCF as a **standalone standard JBrowse
variant track**. Standard variant feature widget, genotype matrix, filter UX.
Independent of the synteny display; no runtime join.

## tracepoints / impg integration

`impg` (`~/src/vendor/impg`) and the `tracepoints` crate
(github.com/AndreaGuarracino/tracepoints) together solve the problem we were
about to reinvent:

- **tracepoints** is a compact CIGAR representation: sparse coordinate-pair
  anchors, with the per-base alignment for each segment reconstructed on
  demand by re-running BiWFA on the underlying sequences. Adaptive (variable
  spacing — finer in divergent regions) or fixed spacing. Reconstruction
  score-identical or better than the original.
- **TPA** is the on-disk container: BGZF-compatible binary, varint-encoded
  tracepoint pairs, deduplicated sequence-name table, O(1) random access via
  external indexing.
- **impg** loads PAF / 1ALN / TPA, lifts a target range through the
  alignment network, optionally takes a transitive closure, and emits BED /
  BEDPE / **PAF with reconstructed `=`/`X` CIGAR** for the requested slice.
  Reconstruction is bounded to the queried window —
  `process_subset_tracepoints` at `~/src/vendor/impg/src/impg.rs:923` only
  reconstructs the segments overlapping the query. Cost scales with viewport,
  not whole-block.

What we'd be reinventing without these:
- lazy CIGAR reconstruction over genomic windows
- an indexed compact alignment store
- transitive closure across a haplotype panel
- range-restricted WFA realignment

What impg/tracepoints does *not* give us:
- **node-ID provenance** (impg is sequence-coordinate; `vg deconstruct`
  remains the path for node-ID-anchored variant queries).
- **graph-aware decomposition** (impg sees the alignment graph, not the
  pangenome graph).

### Source-data reality check (2026-05-14)

The original sketch assumed "HPRC ships wfmash all-vs-all PAF; just point
impg at it." Both halves are wrong:

- **HPRC does not publish all-vs-all PAF.** The published artifacts are the
  graph (`.gbz` / GFA / `.og`) and the source FASTAs. The all-vs-all
  intermediates are not part of the release.
- **HPRC will not produce true all-vs-all going forward.** The quadratic
  explosion (n haplotypes → n² alignments) is intractable at HPRC year-2+
  scale. The community direction is *subset alignments + transitive closure
  to recover the missing pairs* (the theoretical claim being that
  near-all-vs-all coverage is enough). impg's `-x` transitive flag is
  designed for exactly this case.

**For our use case, all-vs-all isn't needed in the first place.** The
synteny display is reference-anchored: one haplotype-row per haplotype,
laid out against a single reference path. We need haplotype-vs-reference
alignments — a *star topology*, n alignments not n² — exactly the topology
`odgi untangle -R <ref>` already produces from the graph. impg's transitive
closure is irrelevant when every alignment shares the reference as one end.

This re-frames the per-base derivation choice:

- **`vg deconstruct -a -u` becomes the cheapest path.** The graph already
  encodes each haplotype's path against the reference; deconstruct walks it
  and emits AP-positioned variants directly. No new alignment step. No
  external alignment-source dependency. Node IDs preserved.
- **impg + tracepoints is still attractive *if* we want viewport-bounded
  runtime reconstruction or a non-graph source.** But the input would be
  haplotype-vs-reference PAF we generate ourselves (n alignments via wfmash
  or `minimap2 -c --eqx -x asm5` per haplotype), not a downloaded
  all-vs-all corpus. That re-alignment cost is the price for the lazy
  runtime story.
- **minimap2 per block stays as fallback** for the "no graph available"
  case (e.g., users with their own collection of pairwise alignments).

For HPRC v1: **`vg deconstruct -a -u` is the default**. impg+tracepoints is
the runtime-laziness upgrade path, deferred until the bake-time path is
proven and someone actually wants per-window dynamism on the synteny
display.

### Two integration shapes — decide in prototype

- **Bake-time** (smallest runtime change): run `impg query` offline per
  untangle block to produce `cs:` strings; bake into the existing cs-PAF
  shape. Same runtime path; impg replaces minimap2/vg-deconstruct as the
  derivation backend. Lowest risk; loses impg's viewport-bounded laziness.
- **Runtime** (longer-term, more powerful): ship the TPA artifact directly,
  add an `ImpgTpaAdapter` (or `graph-server` endpoint wrapping `impg query`)
  that returns viewport-bounded `=`/`X` CIGAR on demand. Per-base detail
  scales with view, not with chromosome size. This is the SequenceTubeMap-style
  service path applied to per-base detail; the static cs-PAF becomes
  unnecessary.

### Why not minimap2 as primary

minimap2 doesn't see the graph. For pangenome data the graph *is* the source
of truth — node identity is the exact "same allele across haplotypes" test
(homoplasy: same sequence, different path). Sequence-only re-alignment can
diverge from the graph's own per-base decomposition, and the resulting `cs:`
loses the only join key (node IDs) that lets a SNP tick on the synteny display
link back to the graph view.

### Why not the runtime VCF overlay (still rejected)

The runtime `variantsAdapter` overlay in `GRAPH_PLAN.md` forces a fragile
PanSN-↔-GT-sample-name join *every render*. The fix is to do the join **once,
offline**, while preprocessing AP/AT into the cs-PAF — not to drop the VCF
content but to drop the runtime join.

### What the VCF artifact still does (separate track, not removed)

Ship the same `vg deconstruct -a -u` VCF as a **standalone standard JBrowse
variant track**, alongside the cs-PAF. Users get the standard variant feature
widget, genotype matrix, and filtering UX for free. The synteny display does
not depend on it. Two artifacts, no runtime join, no shared config slot.

## Key facts for the prep step

### `odgi untangle` PAF format (the input)

- Columns: `q qlen qs qe strand t tlen ts te matches alnlen mapq` + tags
  `id:f: jc:f: sc:f: nb:i:`. A `cs:Z:` tag would become column 17.
- **Has a `#genomes=...` header line** — CRITICAL. `TabixPAFAdapter.getSources()`
  reads it; without it `allGenomeNames` is empty and the display hangs on a
  loading overlay forever. (First proof attempt failed exactly this way after a
  `grep -v '^#'` stripped it.)
- tabix-indexed `-0 -s6 -b8 -e9` (0-based, seqname col 6, begin 8, end 9).
- Query names are PanSN, possibly subwalk-suffixed: `hap1#1#ctg1`,
  `CHM13#0#chr20:100864-26386516`. Target names likewise: `volvox#0#ctgA`,
  `volvox#0#ctgB:0-6079`. `parsePanSN` / the subwalk regexes in
  `comparative-adapters/src/util.ts` handle both colon and bracket forms.
- `odgi untangle` has **no** cigar/cs output flag (confirmed via
  `odgi untangle --help`) — enrichment is mandatory, can't just re-run untangle.

### Tools (all available)

- `odgi` at `~/.local/bin/odgi`, `vg` at `~/.local/bin/vg`, `minimap2` at
  `/usr/bin/minimap2`. `impg` vendored at `~/src/vendor/impg` (all-vs-all PAF
  projection — possible input source, not guaranteed).
- `odgi paths -i graph.og -f` extracts path sequences as FASTA (one record per
  PanSN path) — likely the sequence source.

### Existing data

- chr20 untangle PAF committed: `test_data/hprc/hprc-v1.1-mc-grch38-chr20.synteny.paf.gz`
  (580 KB, gitignore exception). 26,862 blocks.
- volvox fixture: `test_data/volvox/volvox.untangle.paf.gz` — 5 blocks, has both
  plain (`hap1#1#ctg1`) and subwalk-suffixed (`volvox#0#ctgB:0-6079`) names —
  good coordinate-handling test. Used by the `multi-lgv-tabix-paf` browser
  suite.

## Steps

**Prototype the prep on volvox (correctness)**
- `vg deconstruct -a -u -P <ref-prefix> volvox.gbz | bgzip > volvox.variants.vcf.gz; tabix -p vcf …`.
- Bake-time integration script: read untangle PAF + the deconstruct VCF →
  for each block, walk the AP-positioned variants whose reference span
  falls in `[tstart, tend)` and whose haplotype matches the block's query
  (PanSN match, derived from `-P`-driven sample names) → emit a `cs:Z:`
  string in block-target-relative coordinates → append to the PAF row →
  bgzip + tabix (`-0 -s6 -b8 -e9`), keep the `#genomes=` header.
- Validate it renders (diagnostic harness below).
- Emit the VCF as a standalone variant track in the same config — verify
  the two read independently with no runtime join.
- (Optional) cross-check by running `minimap2 --cs` per block on the
  extracted subsequences and diffing against the AP-projected `cs:`. Any
  divergence points to either (a) a coordinate bug in the projection, or
  (b) a real graph-vs-sequence-alignment difference worth understanding.

**Scale to chr20 (performance)**
- `vg deconstruct -a -u` on the chr20 graph produces one VCF; the
  AP/AT-to-block projection is a single in-memory join keyed on
  `(haplotype, ref-position)` — no per-block subprocess.
- Produce `hprc-v1.1-mc-grch38-chr20.synteny.cs.paf.gz` and
  `hprc-v1.1-mc-grch38-chr20.variants.vcf.gz`.

**Productionize**
- Commit the projection as a script under `tools/`; Rust port into
  `tools/gfa-to-tabix` only if perf demands. Document the recipe.

**CI coverage**
- Regenerate the committed `volvox.untangle.paf.gz` as the `cs:`-enriched
  version so `multi-lgv-tabix-paf` exercises per-base rendering.
- Commit the matching `volvox.variants.vcf.gz` and add a separate variant
  track to the volvox config to exercise the standalone-VCF path.
- Add an explicit jest test via `syntenyTestHelpers` asserting mismatch/indel
  data flows through.
- Enrich the committed chr20 PAF so the `hprc-pangenome` smoke test shows
  per-base detail; add the chr20 VCF as a separate variant track.

**Deferred — impg+tracepoints upgrade path** (only if a concrete need
appears: per-window runtime dynamism, non-graph inputs, or non-reference-
anchored views)
- Produce one haplotype-vs-reference PAF per haplotype (`wfmash -X` or
  `minimap2 -c --eqx -x asm5`).
- `impg index` over those PAFs; ship as TPA.
- Build an `ImpgTpaAdapter` (or `graph-server` endpoint wrapping `impg
  query`) returning viewport-bounded `=`/`X` CIGAR. Static cs-PAF becomes
  redundant for that deployment.

## Linearization caveats to surface in the renderer

Linearization fundamentally cannot represent some pangenome content; the
display should be honest about it rather than silently dropping data:

- **Haplotype-novel insertions** have no reference coordinate. Render as a
  glyph (arrow / triangle indicator) at the insertion point on the haplotype
  row, not absence.
- **Multi-mapping (segdups, paralogy)** — `odgi untangle -n 1` picks one best
  match. If the source data carries `n.th > 1` mappings (or if we ever bake
  `-n > 1`), surface this in the block tooltip / a distinct visual treatment.
  Today users see one mapping with no signal that a second exists.
- **Inversions** — currently rendered as negative-strand blocks. Distinguish
  visually from substitutions so users don't read "different sequence" when
  it's "same sequence flipped."
- **Nested bubbles** — `vg deconstruct -a` carries `LV/PS` nesting in the VCF.
  The cs-PAF flattens this. Note in the variant-track widget that the
  one-row-per-haplotype synteny view collapses nesting; full nesting lives in
  the variant track and the graph view.

These are renderer concerns, not data-prep concerns, but the prep step should
preserve the underlying signal (`n.th`, strand, `LV/PS` references) so the
renderer has something to surface.

## Settled decisions

- **VCF artifact** — kept and shipped as a standalone standard JBrowse
  variant track, not a runtime overlay on the synteny display.
- **No runtime PanSN-↔-VCF sample-name join** — same join, once, offline.
- **HPRC v1 derivation** — `vg deconstruct -a -u` AP/AT projection. Uses
  the existing `.og`/`.gbz` artifact, no new alignment step, preserves node
  IDs end-to-end.
- **`minimap2 --cs` is fallback only.**
- **Block structure stays from `odgi untangle`** — graph-aware, operates on
  the existing `.og`.
- **Don't depend on all-vs-all PAF.** HPRC doesn't publish it and won't
  going forward (n² explosion is intractable; the field is shifting toward
  subset alignments + transitive closure). For our reference-anchored
  synteny display, all-vs-all isn't even needed — every alignment shares
  the reference as one end.

## Remaining open decisions

- **Snarl-on-block-boundary correctness.** Untangle blocks and deconstruct
  snarls are different decompositions of the same graph and don't align at
  boundaries: a snarl can straddle two blocks, or a block can contain many
  snarls. Need a clear rule for variants on snarl boundaries (assign to the
  block containing the snarl's reference-path anchor).
- **Per-block coverage of variants.** Does every untangle block's per-base
  divergence appear in `vg deconstruct -a -u` output? Spot-check on volvox.
  If gaps exist (graph regions deconstruct doesn't visit), minimap2
  fallback fills them per block.
- **(v2 path) impg+tracepoints for multi-vantage-point linearization.**
  The headline v2 use case is **user-pickable anchor** — view the
  linearization against CHM13, HG002#1, or any haplotype, not just GRCh38.
  Reference-bound v1 is a star topology (n alignments); multi-anchor is
  many-to-many (O(n²) views). Pre-baking n cs-PAFs scales linearly but
  combines awkwardly with vg deconstruct; on-demand `odgi untangle`
  requires a server; **only impg's "one index, query with any target"
  model scales gracefully**. Source data: an all-vs-all-ish PAF generated
  with `wfmash -X` (HPRC won't publish one), indexed as TPA. Runtime:
  `graph-server` endpoint wrapping `impg query`, or impg-as-WASM. See
  GRAPH_PLAN.md "Beyond reference-bound: multi-vantage-point linearization".
- **Keep v1 reference-agnostic in the data model.** Don't hardcode "GRCh38"
  anywhere in `MultiLGVSyntenyDisplay`. A cs-PAF is just (query, target);
  the display plots queries against a target. Future multi-anchor swaps
  the target without touching the model.

## Risks

- Coordinate/offset bugs in the AP-to-block projection (PanSN subwalk offsets,
  strand, target subwalk-suffixed names, snarl-on-block-boundary cases). The
  volvox fixture covers both name forms — validates the first three; the
  boundary case needs a hand-crafted nested-snarl test.
- `vg deconstruct -a -u` runtime on the chr20 graph — unmeasured. If
  prohibitive, fall back to minimap2 per block.
- The canvas density gate: `maxFeatureScreenDensity` default 1 feature/px → at
  wide zoom, dense data goes `regionTooLarge` ("Too many features") and the
  display never reaches `-done`. Test per-base rendering at a zoomed window
  (this is why `hprc-pangenome.ts` chr20 tests use `chr20:100000-120000`).
- Other agents are actively editing `plugins/graph/*`, `GRAPH_PLAN.md`,
  `adr-028`, `plugins/gwas/` — stay out of their files.

## Diagnostic harness (reuse this)

Puppeteer script in `products/jbrowse-web/` (needs `node_modules` resolution;
delete after — do NOT leave in `browser-tests/suites/`, the runner
auto-discovers that dir):

```ts
import { launch } from 'puppeteer'
import { startServer } from './browser-tests/server.ts'
const server = await startServer(3333)
// navigate: http://localhost:3333/?config=<cfg>&session=spec-<encoded spec>
// spec: { views: [{ type:'LinearGenomeView', assembly, loc,
//   tracks:[{ trackId, displaySnapshot:{ type:'MultiLGVSyntenyDisplay' } }] }] }
// read model state via window.JBrowseSession:
//   session.views[0].tracks.find(t => t.configuration?.trackId === id)
//     .displays[0]  → .canvasDrawn, .rpcDataMap (entries have numMismatches,
//     snpCount, numIndicators, mismatchPositions), .error, .regionTooLarge
// screenshot: el.screenshot({ path }) on [data-testid="multi_synteny_canvas_done"]
```

Build first: `pnpm --filter @jbrowse/web build` (runner loads `build/`).
`server.ts` serves `/test_data/` from repo root via the
`products/jbrowse-web/test_data` symlink.

## Repo state at handoff

- Committed `401f64cf22` — `--smoke` browser-test flag, chr20 pangenome test
  fix, committed chr20 PAF, `findByText`/`assertCanvasHasContent` fixes.
- The runtime-`variantsAdapter` feature is NOT started (and should not be — see
  above).
- **Volvox prep prototype is done and committed** — see "Working demo" above.
  Next is workstream A step 2 (scale to chr20).
