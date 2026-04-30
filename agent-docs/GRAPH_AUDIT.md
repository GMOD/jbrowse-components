# Graph Subgraph Index — Phase 0 Audit

This document captures the Phase 0 deliverables called for in
`agent-docs/GRAPH_PLAN.md`: a concordance audit of the GfaTabixAdapter's
`getSubgraph` against `vg find` (and other oracles) on each fixture, a
path-symmetry check for the C3 claim, the re-entrant-path semantics note
needed before Phase 2, and a judgment about which gap to attack first.

The audit is reproducible: re-run via

```bash
bash tools/gfa-to-tabix/prepare-fixtures.sh
bash tools/graph-truth-extractor/test-subgraph-concordance.sh
```

## Pinned tool versions

- vg `v1.69.0` ("Bologna"). `tools/graph-truth-extractor/backends/vg.ts`
  caches the version string; CI fails loudly if older than this pin.
- odgi: not installed locally; tests that require odgi skip with a clear
  message. Phase 5 CI must provision odgi explicitly.
- sequencetubemap @ `~/src/sequencetubemap` (tabix branch). The `chunkix`
  backend depends on `scripts/chunkix.py`. The companion `pgtabix.py`
  references an `args.r` argument that is not defined (P-line filter), so
  P-line-only inputs (e.g. `volvox_pangenome_50.gfa`) crash on chunkix
  index construction. W-line inputs (HPRC chrM after `vg view`) work.
  Captured in the `chunkix` backend wrapper as a known upstream issue.
- Node `>=24` for `--experimental-strip-types`.

## Fixture status

After running `prepare-fixtures.sh` on the local checkout:

| Fixture                              | pos | seg | edges | bubbles | notes                                |
| ------------------------------------ | --- | --- | ----- | ------- | ------------------------------------ |
| `volvox_pangenome_50`                | ✓   | ✓   | ✓     | ✓       | P-lines, 121 segments, 50 samples    |
| `volvox_indel_pangenome`             | ✓   | ✓   | —     | —       | synthetic, no L lines, tiny          |
| `hprc-v1.1-mc-grch38-chrM`           | ✓   | ✓   | ✓     | ✓       | W-lines, 1393 segments, 44 paths     |

The indel fixture has no `L` lines, which exposes a separate issue
(no edge index → only the path-inference subgraph builder runs). It is
not the primary Phase 0 fixture; left as a regression check for the
path-inference fallback.

## Concordance results

The harness canonicalizes both sides through the same
`tools/graph-truth-extractor/canonicalize.ts` (Weisfeiler-Lehman label
refinement on `(length, sorted-neighbor-set)`; bidirected-edge and
reverse-walk normalization; W-line `:offset` suffix stripped to match
P-line names). A divergence in any category means the canonical forms
disagree.

### `volvox_pangenome_50` — `ref#0#ctgA:0-1000` context=1

Initial run (Phase 0 baseline):

| Source                | S  | L   | P   | canonical match |
| --------------------- | -- | --- | --- | --------------- |
| **Ours** (getSubgraph)| 37 | **96** | **0** | —               |
| `vg find`             | 37 | 48  | 22  | reference       |
| `naive` (ref oracle)  | 37 | 48  | 22  | matches `vg`    |
| `odgi` extract        | —  | —   | —   | not installed   |
| `chunkix`             | —  | —   | —   | upstream `pgtabix.py` crashes on P-line GFAs |

After F1 fix (rust preprocessor + consumer-side dedup):

| Source                | S  | L  | P   | L topology vs truth |
| --------------------- | -- | -- | --- | ------------------- |
| **Ours**              | 37 | 48 | 0   | byte-identical      |
| `vg find`             | 37 | 48 | 22  | reference           |

`vg` and `naive` agree byte-for-byte after canonicalization; this
establishes the truth side. Post-F1, segment count, edge count, and
edge topology are byte-identical to truth; the remaining gap is F2
(zero P/W lines emitted).

### `hprc-v1.1-mc-grch38-chrM` — `GRCh38#0#chrM:5000-5500` context=1

Initial run:

| Source        | S   | L    | P/W | canonical match |
| ------------- | --- | ---- | --- | --------------- |
| **Ours**      | 58  | **150** | **0**  | —             |
| `vg find`     | 58  | 75   | 44  | reference       |
| `naive`       | 58  | 75   | 44  | matches `vg`    |

After F1 fix:

| Source        | S   | L  | P/W | L topology vs truth |
| ------------- | --- | -- | --- | ------------------- |
| **Ours**      | 58  | 75 | 0   | byte-identical      |
| `vg find`     | 58  | 75 | 44  | reference           |

The 2× edge ratio observed pre-F1 was exact on both fixtures at every
region tried, indicating a structural bug rather than missing edges.
The fix landed in this branch reduces the gap to F2 only.

## Findings

### F1 — Phantom edges from doubled adjacency (rust preprocessor) — FIXED

**Status:** fixed in this branch. Both the rust-side root cause and the
consumer-side dedup landed; concordance harness reports byte-identical L
topology against vg-truth on both fixtures.

**Cause.** `tools/gfa-to-tabix/src/main.rs` `build_edge_index` stored
each L-line's reverse-direction adjacency without flipping orientations:

```rust
// Forward direction: src → tgt
adj.entry(src_ord).or_default().push((tgt_ord, src_o, tgt_o, tgt_len));
// Reverse direction: tgt → src
adj.entry(tgt_ord).or_default().push((src_ord, tgt_o, src_o, src_len));
```

The reverse-direction record at `tgt` produces, on read, an L-line that
GFA semantics treats as a *different* edge from the forward edge. The
bidirected partner of `L a + b +` is `L b - a -` (reversed
orientations), not `L b + a +`.

**Fix.** Two complementary changes:

1. `tools/gfa-to-tabix/src/main.rs` — flip both orientations on the
   reverse-direction adjacency push, so the stored bidirected partner is
   `(src_ord, ~tgt_o, ~src_o, src_len)` instead of
   `(src_ord, tgt_o, src_o, src_len)`.
2. `plugins/comparative-adapters/src/GfaTabixAdapter/gfaSubgraphBuilders.ts`
   `buildGfaFromEdges` now canonicalizes each L-line as
   `min(forward, reverse-partner)` before insertion into the dedup `Set`,
   so the consumer collapses bidirected partners to one emission even
   though `edges.bin` still stores both directions for fast adjacency
   lookups from either endpoint.

**Symptoms pre-fix (preserved for reference).**

- `L` count exactly 2× truth on every fixture (96/48 on volvox; 150/75
  on chrM).
- Canonical IDs in the WL refinement diverged because
  `(length, neighbor-set)` partitions were perturbed by phantom edges.

**Verification.** `bash tools/graph-truth-extractor/test-subgraph-concordance.sh`
on volvox now reports `S=37 L=48 P=0` for ours vs `S=37 L=48 P=22` for
truth, with the L-topology byte-set byte-identical (only diff is the
P-lines, F2). HPRC chrM matches the same way (`S=58 L=75`). The
`canonicalize.ts` diff also normalizes `0M` ≡ `*` since vg emits the
former and the adapter the latter.

### F2 — Edge-based subgraph emits zero P/W lines — FIXED

**Status:** fixed in this branch. `buildGfaFromEdges` now emits one
P-line per contiguous haplotype subwalk through the subgraph; for
re-entrant paths (offset gaps along the path), it splits the walk and
emits multiple P-lines per sample (matching vg's W-line behavior).
Counts match truth on every region tried; topology and path-set are
byte-identical on 6 of 7 sampled regions (the 7th is a known
walk-direction edge case described below).

**Cause.** `buildGfaFromEdges` previously emitted only `H` + `S` + `L`
lines. The edge-based path was preferred when `edges.bin` exists; the
path-inference fallback (`buildGfaFromPathInference`) does emit `P`
lines but only for paths that share at least one ref segment, and
under-counts re-entrant subwalks.

**Fix.** Two complementary changes:

1. `gfaSubgraphBuilders.ts` — extended `buildGfaFromEdges` signature to
   accept a `fetchSegments` callback and `seedSegments`. After expanding
   the subgraph via edges, fetch segments.bin records for any alt-node
   ordinals not already covered by the seed range, group records by
   `pathNameIdx`, sort by offset, and split at each offset gap
   (`next.offset !== prev.offset + prev.segLen`) — each contiguous run
   becomes one P-line.
2. `canonicalize.ts` — added a path-context label to WL initialization.
   With placeholder S lines (no sequences yet — Phase 1 work), twin SNP
   nodes (e.g. `n32`/`n33` with identical (length, neighbor-set)
   signatures) were getting different canonical-id assignments between
   truth and ours due to raw-id lex tiebreak. Path membership
   distinguishes them where structure alone cannot.

**Truth behavior reference.** vg emits `W` lines for both P-line and
W-line inputs (xg's internal representation always uses walks). Sample
of vg output for HPRC chrM:5000-5500:

```
W	GRCh38	0	chrM	0	214	>77761600>77761601>77761603>...
W	HG00438	2	MT	0	214	>77761600>77761601>77761603>...
```

Each W line records a fully-qualified haplotype walk through the
subgraph, with the path's *original* offset (here `0`) and length
(here `214`). Our adapter emits P-lines whose *canonicalized* form
matches vg's W-lines after `canonicalize.ts`.

**Verification.** 7 regions sampled across both fixtures; 6 produce
byte-identical canonical GFA, the 7th has matching counts but a
walk-direction divergence (see "F6" below).

### F6 — Walk-direction disagreement on tandem-repeat region

**Severity:** edge case, single observed region.
**Status:** open; not blocking F1/F2 verification.

**Behavior.** On `volvox_pangenome_50` `ref#0#ctgA:5000-6000` (a
tandem-repeat region near the high-coordinate end of the sample
contigs), counts match (`S=2 L=2 P=51` on both sides), but the
canonicalized walks differ in direction: truth's haplotype walks read
`n0+,n1+,n0-` and ours reads `n0-,n1+,n0+`. These are not bidirected
partners of each other — they describe traversals starting from
different ends of the repeat. canonicalize.ts's
`canonicalPathSteps` already chooses the lex-smaller of (forward,
reverse-with-flipped-orient), so this is not a canonicalization bug;
the underlying offset+orient encoding genuinely differs.

**Hypothesis.** vg's xg path representation may renormalize the walk
direction (e.g. start from a fixed origin or smallest-id endpoint),
while our preprocessor preserves the source GFA's natural P-line offset
order. For circular / tandem-repeat segments this can produce
direction-flipped walks that are physically different traversals
through the bidirected graph.

**Triage.** Investigate during Phase 2 hardening or Phase 5 CI work.
Need to compare per-segment offset/orient records in our segments.bin
against vg's `vg find -p PATH:start-end --paths` output to determine
which side normalizes and how. May require a coordinate-mapping helper
similar to the one needed for C3.

### F3 — S lines are placeholder (no sequence)

**Severity:** correctness; precludes round-tripping through `vg view`,
`vg snarls`, or any sequence-aware downstream.

**Cause.** `gfaSubgraphBuilders.ts:42` and `:142`:

```ts
lines.push(`S\ts${ord}\t*\tLN:i:${len}`)
```

`segments.bin` carries no nucleotides, so the adapter cannot supply
them. Phase 1 territory.

### F4 — vg PanSN-path renaming

**Severity:** integration only; absorbed by the harness.

**Behavior.** `vg convert -g <gfa> -x` rewrites a 3-field PanSN P-line
name like `ref#0#ctgA` into a 4-field walk-style name with offset:
`ref#0#ctgA#0`. `vg find -p PATH:start-end` requires the rewritten
name. Some HPRC samples additionally use `MT` (not `chrM`) on the
same graph because that's the contig name of the sample's mitochondrial
assembly.

**Mitigation.** `tools/graph-truth-extractor/backends/vg.ts`
implements `resolveVgPathName` that lists `vg find -I` paths and picks
the matching one (exact, then `<name>#0` prefix). No caller change.

### F5 — chunkix.py P-line bug

**Severity:** prior-art comparison only.

**Behavior.** `~/src/sequencetubemap/scripts/pgtabix.py:149` checks
`line[1].startswith(args.r)` for the P-line branch but `args` doesn't
declare `-r` — argparse only registers `-g`, `-o`, `-s`. Crashes on any
P-line GFA. W-line GFAs (e.g. HPRC chrM after `vg view`) take a
different branch and work.

**Mitigation.** Documented in
`tools/graph-truth-extractor/backends/chunkix.ts`. Phase 5 CI either
patches pgtabix.py locally or restricts the chunkix backend to W-line
inputs. Filed as known upstream.

## Path-symmetry sub-test (C3 measurement)

The plan asks for: "pick one structural locus, query it from N≥3
different reference paths, all canonicalized subgraphs must be
byte-identical." Phase 0 attempted this on HPRC chrM:5000-5100 from
`GRCh38#0#chrM`, `CHM13#0#chrM`, `HG00438#2#MT`. Result:

| Path             | canonical md5 (vg backend)             | match |
| ---------------- | -------------------------------------- | ----- |
| `GRCh38#0#chrM`  | `bfbcd7ad003f1b73bd71f001cea2bdcd`     | A     |
| `CHM13#0#chrM`   | `bb64f3f834dcb30ea7779f12dd1e7b93`     | B     |
| `HG00438#2#MT`   | `bfbcd7ad003f1b73bd71f001cea2bdcd`     | A     |

GRCh38 and HG00438 agree; CHM13 differs. **This does not invalidate
C3** — querying the *same coordinate range* in different paths picks up
the *physical region those coordinates map to*, which is genuinely
different graph regions when the reference paths have different
coordinate systems. CHM13's chrM assembly differs from GRCh38's by a
small offset. The proper C3 measurement is "query the same physical
locus from N paths," which requires a coordinate-mapping step (e.g.
`vg surject` or our own path-coord lookup). Captured as a Phase 5
follow-up; the harness is in place and re-runs trivially once the
mapping helper exists.

## Re-entrant-path semantics (Phase 2 unblock)

`GRAPH_PLAN.md` requires this note before Phase 2 starts. Findings
from the Phase 0 vg samples:

- vg's `vg find ... | vg view -g` always emits **W lines** (not P
  lines) because the xg index represents paths internally as walks.
  This is independent of whether the source GFA used P or W. Output
  format from a P-line GFA matches output format from a W-line GFA —
  always W in subgraph extraction.
- Each W line records a single contiguous traversal:
  `W sample hap contig start end walk`.
- For paths that **enter, leave, and re-enter the subgraph** (cycles in
  HPRC chrM control region; structural variants in chr20), vg emits
  **multiple W lines for the same haplotype**, each describing a
  distinct subwalk. The `start`/`end` columns track the path's
  original-haplotype coordinates of that subwalk; the pieces don't
  overlap in path coordinates and don't span the gap.
- Naming: the same `sample#hap#contig` may appear repeatedly in the
  output, distinguished by `start`. Downstream tools should not assume
  one W per haplotype.
- Implication for Phase 2: when emitting paths, group by
  `pathNameIdx`, sort by `offset`, scan for offset gaps (a gap means a
  re-entry), and emit one W per contiguous subwalk. Don't try to emit
  one W per haplotype with a discontinuous walk — vg doesn't and `vg
  view` would reject it.

## Judgment: which gap to attack first

Per the plan, Phase 0's deliverable is a ranked recommendation. Items
already landed are struck through.

1. ~~**F1 (phantom edges)**~~ — done. Rust-side orientation flip plus
   consumer-side dedup; L topology byte-identical to vg-truth on every
   fixture and region tried.
2. ~~**F2 (path emission)**~~ — done. P-line emission per contiguous
   subwalk; canonicalize.ts uses path-context labels for WL tiebreak.
   Counts match truth on every region; topology + path-set
   byte-identical on 6 of 7 sampled regions. Remaining edge case is
   F6.
3. **F6 (tandem-repeat walk direction)** — investigate next. Single
   region observed; need to compare offset/orient encoding against vg's
   xg-path representation. Diagnostic; may surface a per-path
   normalization step.
4. **F3 (real sequences)** — fix after F6. Phase 1 work. Largest dev
   effort (file format, tier strategy, decode path), but smaller
   correctness contribution per unit work because the *graph topology*
   is already correct — F3 adds nucleotide content, not structure.
5. **C3 (path symmetry)** — instrument fifth. Needs the
   coordinate-mapping helper and one fixture region selected. Phase 5
   territory; the harness is ready.
6. **Context expansion** (Phase 3): orthogonal; can be parameterized
   on the API and run in parallel with F3/F6.

With F1+F2 landed, the audit harness reports byte-isomorphic GFA
against vg-truth on the headline fixtures; only an edge-case
walk-direction disagreement (F6) and the structural placeholder for
sequences (F3) remain.

## Open questions surfaced by Phase 0

- **W vs P line emission.** Should the adapter follow the input GFA's
  format (W in, W out) or always emit W (matching vg's behavior)?
  Plan defaults to "follow input." Decision pending Phase 2 spike.
- **Chunkix-as-oracle.** The pgtabix.py `args.r` bug blocks this
  oracle for P-line fixtures. Options: patch our local copy of
  pgtabix.py, restrict to W-line inputs, or upstream a fix. Pick once
  Phase 5 CI is being authored.
- **odgi installation.** Phase 5 CI must provision odgi. Easiest path:
  conda environment file at `tools/graph-truth-extractor/env.yaml`.

## See also

- `agent-docs/GRAPH_PLAN.md` — phased plan and claims this audit
  measures.
- `agent-docs/GRAPH_INDEX_FORMAT.md` — file-format spec; F3 will
  introduce `segments.seq.{bin,fa.gz}` per Phase 1.
- `agent-docs/GRAPH_PERF.md` — Phase 8 inputs.
- `tools/graph-truth-extractor/README.md` — oracle backend
  installation pins and known disagreements.
- `tools/gfa-to-tabix/README.md` — preprocessor CLI reference.
- `plugins/comparative-adapters/scripts/dump-subgraph.ts` — wrapper
  invoked by the harness to dump our `getSubgraph` output as raw GFA;
  lives inside the comparative-adapters package so it resolves
  `@gmod/tabix` and `generic-filehandle2` from that package's deps.
