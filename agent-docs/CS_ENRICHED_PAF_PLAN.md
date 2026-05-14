# Plan: per-base variants via a `cs:`-enriched synteny PAF

> Agent handoff doc, written 2026-05-14. Self-contained — read this instead of
> re-investigating. Supersedes the "runtime `variantsAdapter` overlay" idea in
> `GRAPH_PLAN.md` "Per-base variant integration (target architecture)".

## Goal

Show per-base SNP/indel detail per haplotype row in `MultiLGVSyntenyDisplay`,
for HPRC-style graph pangenomes. The user wants the integration done as **an
offline data-prep step that JBrowse consumes trivially at runtime** — not a
fragile runtime join.

## Why NOT the runtime `variantsAdapter` overlay

`GRAPH_PLAN.md` describes a target architecture: a `variantsAdapter` config slot
on the display + `sampleNameMap`, fetching the `vg deconstruct` VCF at runtime
and overlaying ticks. **Don't build this.** It forces a fragile join every
render: the VCF is per-*individual* with phased GTs (`HG00438` → `0|1`) but the
synteny rows are per-*haplotype* PanSN (`HG00438#1`). The haplotype-naming
mismatch is the signal that this is against the grain.

## What is PROVEN (do not re-verify)

A `cs:`-tagged synteny PAF renders per-base SNPs (allele-colored) + indels on
the haplotype rows through the **existing** runtime path — **zero new runtime
code** (no config slot, no RPC, no shaders).

Proof method: hand-crafted a `cs:`-tagged volvox PAF, loaded it via a temp
config, confirmed both:
- model state: `MultiPairGetFeatures` produced `numMismatches: 4,
  numIndicators: 1`, `mismatchPositions: [50,101,152,203]` (exact)
- render: zoomed screenshot showed 4 SNP ticks colored correctly by query base
  (`*ag`→G→orange, `*ct`→T→red, `*ga`→A→green, `*tc`→C→blue), a deletion bar,
  an insertion line, an indicator triangle, and a matching SNP-coverage row.

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

`odgi untangle` for block **structure**, then `minimap2 --cs` per block for the
base-level `cs:` → emit a `cs:`-tagged PAF. Rationale: `minimap2 --cs` is the
most battle-tested aligner; per-block it is a tiny well-constrained alignment
(the untangle block already *is* the syntenic constraint); needs only
sequences, so it is flexible to input source; preserves untangle's graph-aware
structure rather than replacing it.

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

**1 — Prototype the prep on volvox (correctness)**
- Find the volvox source graph / path sequences (`.og` is gitignored; check for
  a GFA, or whatever produced `volvox.untangle.paf.gz`).
- Script: read untangle PAF → per block, extract query + target subsequences
  (handle PanSN names, subwalk-suffix offsets, strand) → `minimap2 --cs` →
  append `cs:Z:` → bgzip + tabix (`-0 -s6 -b8 -e9`), keep the `#genomes=`
  header.
- Validate it renders (diagnostic harness below).

**2 — Scale to chr20 (performance)**
- 26,862 blocks → naive per-block `minimap2` subprocess is too slow. Batch (all
  block query-subseqs as one FASTA, matched back by record name) or
  per-haplotype-align-then-slice-cs. Benchmark; pick correct + fast.
- Produce `hprc-v1.1-mc-grch38-chr20.synteny.cs.paf.gz`.

**3 — Productionize**
- Commit the prep as a script under `tools/`; Rust port into
  `tools/gfa-to-tabix` only if perf demands. Document the recipe (coordinate
  with the in-progress `GRAPH_PLAN.md` rewrite — another agent owns it).

**4 — CI coverage**
- Regenerate the committed `volvox.untangle.paf.gz` as the `cs:`-enriched
  version (or alongside) so `multi-lgv-tabix-paf` exercises per-base rendering;
  refresh that suite's snapshots.
- Add an explicit jest test via `syntenyTestHelpers` asserting mismatch/indel
  data flows through — not just "canvas non-blank".
- Enrich the committed chr20 PAF so the `hprc-pangenome` smoke test shows
  per-base detail.

## Open decisions (prototype settles them)

- **Enrich vs replace**: enrich the untangle PAF (recommended — keeps untangle's
  structure, aligns with adr-024) vs. replace with a per-haplotype
  `minimap2 --cs` PAF (simpler, naturally carries `cs:`, but sequence-aligned
  not graph-aware). Prototype both on volvox, compare.
- **Graph-walk fallback**: if per-block `minimap2` is unreliable on complex
  regions, derive `cs:` from the graph's node structure directly (exact, but no
  turnkey tool — hand-rolled graph walking).

## Risks

- Coordinate/offset bugs in subsequence extraction (PanSN subwalk offsets,
  strand, target subwalk-suffixed names). The volvox fixture covers both name
  forms — validates this.
- Per-block `minimap2` perf at chr20 scale (step 2).
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
- Nothing for this plan is committed yet; start at step 1.
