# Graph Subgraph Index — Completed Work Log

This is the archive of shipped items extracted from `GRAPH_PLAN.md`
("Shipped" section) and the resolved findings from `GRAPH_AUDIT.md`
("Findings"). Live planning, open backlog, and outstanding judgment
calls remain in those files; this file keeps the historical record so
those documents stay focused on what's next.

Update this file whenever an item moves from open to shipped. Source
of truth for the *current* state of the work is still
`GRAPH_PLAN.md` § "Status & next steps".

## Shipped

- ✅ **Phase 0 audit harness** (`tools/graph-truth-extractor/`,
  vg/naive backends, canonicalize, dump-subgraph, bash wrapper, Jest
  contract test).
- ✅ **F1 — rust phantom edges** (orientation flip on
  reverse-direction adjacency push + consumer-side dedup in
  `buildGfaFromEdges`).
- ✅ **F2 — P-line emission** with re-entry-aware contiguous-subwalk
  splitting; matches `vg find` semantics described in the
  re-entrant-path note.
- ✅ **F6 — rust relative-orient bug** for tandem repeats (removed the
  "store +/- relative to ref's last orient" branch; segments.bin now
  stores absolute GFA orient).
- ✅ **F3 plaintext tier** — rust emits
  `prefix.segments.seq.{fa,fa.fai,idx}`; adapter loads the binary
  `.idx` for O(1) ordinal→byte-offset lookup, keeps `.fai` for
  samtools/CLI use only. Per-segment FASTA records are single-line.
- ✅ **`structuralFingerprint`** in `canonicalize.ts` —
  automorphism-tolerant comparison (sequence-grounded, not WL-derived)
  needed at chr20 scale where thousands of length-1 SNV nodes share
  WL labels and arbitrary tiebreaks shuffle canonical IDs differently
  between truth and ours. The bash harness falls back to it when the
  line-wise canonical diff fails.
- ✅ **HPRC chr20 verification** — 1.86M segments, 2.57M edges, 90
  haplotypes. Preprocessor: 1m58s wall, 7.9 GB RSS. Adapter: <300 ms
  for queries up to 100 kbp. All sampled regions structurally
  isomorphic to vg-truth.
- ✅ **Cross-plugin tests** — Jest unit tests for `gfaSeqIO`, Jest
  integration tests for `getSubgraph` placeholder vs sequence modes,
  Jest cross-plugin contract test in `plugins/graph` (subprocess-spawns
  dump-subgraph, parses output via plugins/graph's `parseGFA`),
  puppeteer suite for both launch entry points (MultiLGV track menu →
  Graph view + import-form Track mode).
- ✅ **`maxPathsEmitted` opt** on `getSubgraph` — when computed
  subwalk count exceeds the threshold, drops all P-line emission and
  appends a `# truncated paths: N (max emitted: M)` comment. Default
  applied by `GraphGenomeView.loadFromTabixSubgraph` and
  `MultiLGVSyntenyDisplay launchSubgraphView` is `50000`. Dump-subgraph
  CLI exposes `--max-paths`. The immediate tactical patch for
  megabase regions ahead of the multi-resolution work.
- ✅ **Phase 3 fixed-k context expansion** — `getSubgraph(region, {
  context: k })` does k-hop BFS from seed segments. `context=1`
  matches the previous implicit 1-hop behavior; `context=0` is
  seed-only; higher values include more bubble context. Plumbed
  through RPC, `GraphGenomeView.loadFromTabixSubgraph`, and the
  dump-subgraph CLI (`--context K`). Snarl-boundary expansion still
  gated on Phase 4.
- ✅ **chr20 indexes uploaded to S3** —
  `s3://jbrowse.org/demos/gfadata/hprc-v1.1-mc-grch38/hprc-v1.1-mc-grch38-chr20.*`
  refreshed with the F1/F6 fixes. New files added: `edges.bin/.idx`
  (51 MB / 15 MB), `segments.seq.fa/.fa.fai/.idx` (91 / 49 / 22 MB).
  Total chr20 footprint on S3 ≈ 1.79 GB. Unblocks the puppeteer
  launch suite from running against the remote
  `config_hprc_chr20.json` without local fixtures.
- ✅ **chr20 `pos.bed.gz` re-indexed with `#input-format=walks`
  header** — re-ran the rust preprocessor, confirmed
  `segments.bin/.idx`, `edges.bin/.idx`, and `segments.seq.*` are
  byte-identical to the previous index (ordinal assignment is
  deterministic across runs). Only `pos.bed.gz` (+ `.tbi`) needed
  refresh. chr20 now emits W-lines on subgraph extraction. Verified
  with `dump-subgraph.ts /home/cdiesh/chr20-test/chr20 GRCh38#0#chr20
  30000000 30000100`: emits `W GRCh38 0 chr20 ...` rows with
  `<>` orient walks.
- ✅ **Phase 2 W-line emission** — when source GFA used W-lines, the
  adapter now emits W-lines on extraction (`W sample hap contig start
  end walk` with `>`/`<` orient). Detection: rust preprocessor writes
  `#input-format=walks|paths` into the `pos.bed.gz` header; adapter
  reads it in `setupPre()` and threads `emitFormat` through the
  builders. `getSubgraph` accepts an explicit `emitFormat` opt for
  testing / power users; defaults to the header value. Older indexes
  without the format header default to `paths` (backward compatible).
  Re-indexing with the new rust binary lights up W-line emission for
  W-line input fixtures.
- ✅ **C3 path-symmetry harness** — `BaseGfaTabixAdapter.getEquivalentRanges`
  maps a `(refPath, start, end)` viewport to per-other-path coordinate
  ranges that overlap the same physical segments. Standalone TS
  helper at `plugins/comparative-adapters/scripts/equivalent-ranges.ts`
  exposes this to bash; `tools/graph-truth-extractor/test-path-symmetry.sh`
  iterates each equivalent range, dumps + canonicalizes a subgraph,
  and asserts all structural fingerprints match. Passes on HPRC
  chrM:5000-5500 across all 44 haplotypes (one fingerprint:
  `3d0e925d0f33b04a`). The earlier Phase 0 attempt with literal
  coordinate ranges across paths failed for CHM13 because chrM offsets
  differ; the equivalent-ranges mapping fixes that.
- ✅ **Refactor: extract `bubbleCs.ts` and `bubbleAnnotator.ts`** —
  pulled `buildCsFromCigarAndBubbles`, `findBubblePairRecord`, and
  `BubbleEntry` out to `bubbleCs.ts`; lifted `annotateFeaturesWithBubbleCs`
  to a free function in `bubbleAnnotator.ts`. `gfaTabixUtils.ts`
  shrunk from 797 → 508 lines.
- ✅ **Refactor: shared GFA emitter** — both `buildGfaFromEdges` and
  `buildGfaFromPathInference` now route through a single `assembleGfa`
  that emits H/S/L lines plus P-or-W lines with truncation. Subwalk
  type unified across builders; `canonicalLinkKey` now used in both
  paths so the path-inference fallback emits canonical-form L lines.
- ✅ **Phase 5 CI Jest concordance + path-symmetry tests** —
  `auditConcordance.test.ts`. Drives `dump-subgraph` + `vg find` for 3
  fixture regions (volvox simple bubble, indel span, tandem repeat)
  and asserts structural fingerprints match. Skips gracefully when
  `vg` is missing from PATH (CI must provision); on dev laptops with
  vg ≥ 1.59.0 the suite runs in ~15 s. Also adds a path-symmetry test
  that drives the equivalent-ranges helper across all paths sharing a
  viewport. 167 tests / 4 skipped / all green.
- ✅ **F3 binary-tier spike** — scanned HPRC chr20.gfa (67.66 Mbp of
  S-line sequence). Char distribution: A 27.73 / T 28.06 / G 21.86 /
  C 21.61 / N 0.74%. No IUPAC ambiguity codes, no soft-mask. Format
  decision pinned in `agent-docs/GRAPH_INDEX_FORMAT.md`: 2-bit ACGT +
  per-segment N-bitmap (Option A). Predicted chr20 binary footprint
  ~25 MB vs 91 MB plaintext (73% reduction). Implementation deferred
  per user steer; format spec is now ready for a future agent to
  ship.

## Resolved Findings (from GRAPH_AUDIT.md)

### F1 — Phantom edges from doubled adjacency (rust preprocessor) — FIXED

**Status:** fixed. Both the rust-side root cause and the
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
on volvox reports `S=37 L=48 P=0` for ours vs `S=37 L=48 P=22` for
truth, with the L-topology byte-set byte-identical (only diff was the
P-lines, F2). HPRC chrM matches the same way (`S=58 L=75`). The
`canonicalize.ts` diff also normalizes `0M` ≡ `*` since vg emits the
former and the adapter the latter.

### F2 — Edge-based subgraph emits zero P/W lines — FIXED

**Status:** fixed. `buildGfaFromEdges` emits one P-line per
contiguous haplotype subwalk through the subgraph; for re-entrant paths
(offset gaps along the path), it splits the walk and emits multiple
P-lines per sample (matching vg's W-line behavior). Counts match truth
on every region tried; topology and path-set are byte-identical on 7
of 7 sampled regions (after F6 also landed).

**Cause.** `buildGfaFromEdges` previously emitted only `H` + `S` + `L`
lines. The edge-based path was preferred when `edges.bin` exists; the
path-inference fallback (`buildGfaFromPathInference`) emitted `P` lines
but only for paths that share at least one ref segment, and
under-counted re-entrant subwalks.

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

**Verification.** 7 regions sampled across both fixtures; **all 7
produce byte-identical canonical GFA** after F6 also landed (the 7th
was originally divergent due to F6's relative-orient bug).

### F6 — Tandem-repeat orient disagreement (rust preprocessor) — FIXED

**Status:** fixed.

**Cause.** `tools/gfa-to-tabix/src/main.rs` `emit_path_records` had a
"relative orient" branch for non-ref non-flipped paths whose segments
were also visited by the ref path:

```rust
} else if let Some(&ref_is_plus) = ref_orients.get(&step.ord) {
    if step.is_plus == ref_is_plus { "+" } else { "-" }
}
```

This stored the orient as `+` when the path's GFA orient agreed with
the ref's *last-seen* orient at that segment, and `-` when they
disagreed. Two failure modes:

1. **Ref re-visits a segment with conflicting orient.** `ref_orients`
   is a `HashMap<u64, bool>` and only retains the *last* orient seen
   for each ord. In tandem repeats the same segment is visited twice
   (e.g. `206+, 207+, 206-` along ref); only `-` survives in
   `ref_orients[91]`. Then any non-ref path that visits seg 206 in
   `+` gets stored as `-`, and vice versa.
2. **Reference frame mismatch.** L-lines are emitted in absolute GFA
   coordinates. Storing relative orients in segments.bin means the
   path-walks reconstructed from segments.bin reference *non-existent*
   L-lines (e.g. `L 91 - 92 +` when the actual L-line set is
   `{L 91 + 92 +, L 92 + 91 -}`).

**Fix.** Removed the relative-orient branch; non-flipped paths now
always store absolute GFA orient. The `need_flip` whole-contig
rev-comp normalization is preserved — it correctly handles haplotypes
uploaded as reverse-complement of the ref.

**Verification.** Concordance harness reports `ISOMORPHIC: canonical
forms match exactly` on **all 7 sampled regions** across both
fixtures (volvox 0-500, 1000-2000, 5000-6000, 10000-11000; HPRC chrM
0-300, 5000-5500, 10000-11000). Pre-fix the tandem-repeat region
5000-6000 was the lone divergent region.

**Downstream impact.** `segmentFeatureBuilder.ts:64` computes synteny
strand as `seg.orient === refSeg.orient ? 1 : -1`. With absolute
orients this gives the correct synteny direction in all cases,
including tandem-repeat tracts where ref's orient flips between
visits. Existing Jest tests still pass.

### F3 — S lines are placeholder (no sequence) — FIXED (plaintext tier)

**Status:** plaintext tier landed. Binary 2-bit-packed tier remains
future Phase 1 work per the plan.

**Cause.** `gfaSubgraphBuilders.ts` previously emitted
`S\ts<ord>\t*\tLN:i:<len>` regardless of source-GFA contents because
`segments.bin` carries no nucleotides.

**Fix.** Three components:

1. **Rust tool** — added `--no-emit-seq-plaintext` flag (default = emit).
   During the GFA pass, accumulates per-segment sequences in memory.
   After path processing assigns ordinals, writes three files:
   - `prefix.segments.seq.fa` — FASTA, one record per ordinal
     (`>seg<ord>\n<seq>\n`), single-line per record (no wrapping).
   - `prefix.segments.seq.fa.fai` — samtools-faidx-compatible sidecar.
     Kept for `samtools faidx` / grep workflows but the adapter never
     parses it.
   - `prefix.segments.seq.idx` — compact binary sidecar, 12 bytes per
     ordinal: `u64` LE byte offset + `u32` LE length. Missing
     ordinals (source S-line had `*` placeholder) emit `(0, 0)`. At
     12 bytes/segment this is ~12 MB per million segments — small
     enough to load whole into the browser, structured for O(1)
     lookup. Designed to address the .fai-size-at-HPRC-scale concern
     surfaced during this work (per-line ASCII .fai for 1M+
     segments grows into the tens-of-MB range and parsing it is
     wasted work for a per-viewport query that touches only a few
     hundred ordinals).
2. **Adapter** — new `gfaSeqIO.ts` with
   `getSequencesForOrdinals(shard, ordinals)`. Mirrors the
   range-merging pattern in `getSegmentsForOrdinalsFromShard`:
   adjacent ordinals collapse into one HTTP range fetch over the
   FASTA. New config slots `seqFastaLocation` and `seqIdxLocation`
   on `BaseGfaTabixAdapter`; `getSubgraph` plumbs an optional
   `fetchSequences` callback through to both subgraph builders.
3. **Subgraph builders** — `buildGfaFromEdges` and
   `buildGfaFromPathInference` batch-fetch sequences for every
   in-subgraph ordinal once, then emit `S\ts<ord>\t<seq>` instead of
   `S\ts<ord>\t*\tLN:i:<len>` whenever a sequence is available.
   Falls back to the placeholder S-line when `fetchSequences` is not
   wired (no `seqFastaLocation` configured) or when an ordinal has no
   recorded sequence.

**Verification.** Concordance harness re-run with
`canonicalize.ts useSequence: true` (sequence-hash WL initialization
instead of `(length, neighbor-set)`). All 7 sampled regions across
both fixtures report `ISOMORPHIC: canonical forms match exactly` —
sequences in our S-lines hash-match vg-truth's. Existing Jest tests
still pass; tsgo clean for the comparative-adapters package.

**Deferred binary tier.** The 2-bit-packed binary FASTA tier
described in `agent-docs/GRAPH_PLAN.md` Phase 1 is intentionally not
built here — user steered: "focus on plaintext mode now, binary is
later." The format-tier dispatcher (magic-byte registry) the plan
describes is also deferred; today the adapter unconditionally treats
`seqFastaLocation` as plaintext FASTA. When the binary tier lands it
gets a separate config slot and the dispatcher can be a thin
extension point.

### F3-historical — S lines were placeholder (pre-Phase-1)

Pre-Phase-1 baseline preserved for reference; superseded by F3 above.

**Severity:** correctness; precluded round-tripping through `vg view`,
`vg snarls`, or any sequence-aware downstream.

**Cause.** `gfaSubgraphBuilders.ts` emitted

```ts
lines.push(`S\ts${ord}\t*\tLN:i:${len}`)
```

`segments.bin` carries no nucleotides, so the adapter could not supply
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

## See also

- `agent-docs/GRAPH_PLAN.md` — current state of the work, open
  backlog, design sketches.
- `agent-docs/GRAPH_AUDIT.md` — Phase 0 deliverables (concordance
  table, fixture status, re-entrant-path semantics, path-symmetry
  measurement, judgment about which gap to attack next).
- `agent-docs/GRAPH_INDEX_FORMAT.md` — file-format spec.
- `agent-docs/GRAPH_PERF.md` — Phase 8 perf inputs.
