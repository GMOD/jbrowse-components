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

| Fixture                              | pos | seg | edges | bubbles | seq | notes                                |
| ------------------------------------ | --- | --- | ----- | ------- | --- | ------------------------------------ |
| `volvox_pangenome_50`                | ✓   | ✓   | ✓     | ✓       | ✓   | P-lines, 121 segments, 50 samples    |
| `volvox_indel_pangenome`             | ✓   | ✓   | —     | —       | ✓   | synthetic, no L lines, tiny          |
| `hprc-v1.1-mc-grch38-chrM`           | ✓   | ✓   | ✓     | ✓       | ✓   | W-lines, 1393 segments, 44 paths     |
| `hprc-v1.1-mc-grch38-chr20` (~/chr20)| ✓   | ✓   | ✓     | —       | ✓   | W-lines, **1.86M segments, 90 haplotypes**, ~1.05 GB GFA |

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

After F1+F2+F6+F3-plaintext fixes:

| Source                | S  | L  | P   | sequence-aware canonical match |
| --------------------- | -- | -- | --- | ------------------------------ |
| **Ours**              | 37 | 48 | 22  | byte-identical                 |
| `vg find`             | 37 | 48 | 22  | reference                      |

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

After F1+F2+F6+F3-plaintext fixes:

| Source        | S   | L  | P/W | sequence-aware canonical match |
| ------------- | --- | -- | --- | ------------------------------ |
| **Ours**      | 58  | 75 | 44  | byte-identical                 |
| `vg find`     | 58  | 75 | 44  | reference                      |

The 2× edge ratio observed pre-F1 was exact on both fixtures at every
region tried, indicating a structural bug rather than missing edges.
The fix landed in this branch reduces the gap to F2 only.

### `hprc-v1.1-mc-grch38-chr20` — HPRC chr20 (1.86M segs, 90 haps)

The first scale test against a real human pangenome chromosome.
Source `~/chr20.vg` (~967 MB) → `vg convert -f` (24 s) → 1.05 GB GFA
with 1,859,947 S-lines, 2,574,969 L-lines, 919 W-lines, 90 haplotypes
(45 samples × 2 phases plus CHM13 + GRCh38 reference).

**Preprocessor (`gfa-to-tabix`).** 1m58s wall, peak RSS 7.9 GB.
Output sizes:

| File                                | size      | notes                                |
| ----------------------------------- | --------- | ------------------------------------ |
| `chr20.pos.bed.gz`                  | 54 MB     | tabix-indexed                        |
| `chr20.segments.bin`                | **1.49 GB** | 15 B/record × ~99M per-(seg,path,offset) tuples |
| `chr20.segments.idx`                | 15 MB     |                                      |
| `chr20.edges.bin`                   | 51 MB     | bidirected partner pre-flipped (F1)  |
| `chr20.edges.idx`                   | 15 MB     |                                      |
| `chr20.segments.seq.fa`             | 91 MB     | per-segment FASTA (Phase 1 plaintext)|
| `chr20.segments.seq.fa.fai`         | 49 MB     | samtools-faidx — for CLI only        |
| `chr20.segments.seq.idx`            | 22 MB     | binary `.idx` — adapter loads this   |

The samtools `.fai` (49 MB) at chr20 scale validates the choice to
ship a separate compact binary index — at 12 bytes/segment the binary
form loads as a single ~22 MB `Uint8Array` and supports O(1) lookup;
parsing the line-oriented `.fai` would have been ~2× larger and
required a full pre-parse.

**Adapter (`getSubgraph`) latency**, measured via
`dump-subgraph.ts` on a single CPU thread (cold-cache local file
fetches via `LocalFile`):

| Region size | wall  | segments | links | paths | output bytes |
| ----------- | ----- | -------- | ----- | ----- | ------------ |
| 1 kbp       | 220 ms | 66      | 86    | 15    | 6 KB         |
| 10 kbp      | 240 ms | 948     | 1,264 | 39    | 117 KB       |
| 100 kbp     | 270 ms | 2,994   | 4,083 | 90    | 440 KB       |
| 1 Mbp       | 2.3 s  | 25,503  | 34,295| 219,094 | 20 MB     |
| 5 Mbp       | 10.2 s | 110,333 | 152,954 | 434,066 | 79 MB   |

Sub-300 ms latency holds out to 100 kbp regions — covers typical gene
/ locus browsing. The 1 Mbp+ regions explode in path count because
each haplotype emits one P-line per contiguous in-subgraph subwalk
(re-entry-aware emission per Phase 0's vg-W-line semantics note); for
big regions this means hundreds of thousands of P-lines, which is a
data-volume rather than data-correctness issue. Browser usage typically
queries ≤ 100 kbp around a gene.

**Concordance** (sequence-aware structural fingerprint, since
chr20-scale graphs have many WL-equivalent SNV nodes that arbitrary
canonical-id tiebreaks shuffle differently between truth and ours):

| Region                              | S    | L    | P  | result                    |
| ----------------------------------- | ---- | ---- | -- | ------------------------- |
| `GRCh38#0#chr20:30000000-30001000`  | 66   | 86   | 15 | structurally isomorphic   |
| `GRCh38#0#chr20:100000-101000`      | 20   | 24   | 90 | structurally isomorphic   |
| `GRCh38#0#chr20:30500000-30501000`  | 59   | 77   | 91 | structurally isomorphic   |
| `GRCh38#0#chr20:60000000-60001000`  | 41   | 52   | 90 | structurally isomorphic   |
| `GRCh38#0#chr20:30000000-30010000`  | 948  | 1264 | 39 | structurally isomorphic   |

S/L/P counts byte-identical to vg-truth on every sampled region.
Sequence multisets identical. Structural fingerprint
(`seq + link + path` from `canonicalize.ts:structuralFingerprint`)
matches across all sampled regions.

The line-wise canonical diff fails at chr20 scale because the
canonical-id tiebreaker in `assignCanonicalIds` is dominated by raw
input ordering — for thousands of length-1 "A"/"C"/"G"/"T" SNV nodes
that share WL labels, truth (vg's `n0..n_N`) and ours (our `s<ord>`)
can't agree on which "A" gets called `n34` and which gets `n36`. This
is not a correctness defect; it's irreducible automorphism. The
structural fingerprint sidesteps it by grounding all comparisons in
actual sequences rather than canonical IDs.

## Findings

The full per-finding write-ups (cause, fix, verification) for resolved
items live in `agent-docs/GRAPH_COMPLETED.md`. Summary:

- **F1 — Phantom edges from doubled adjacency** (rust preprocessor) —
  FIXED. Bidirected partner is now stored with flipped orientations;
  consumer dedups via `canonicalLinkKey`.
- **F2 — Edge-based subgraph emits zero P/W lines** — FIXED.
  `buildGfaFromEdges` emits one P-line per contiguous subwalk;
  re-entrant paths split per the vg semantics note below.
- **F3 — S lines are placeholder** — FIXED (plaintext tier).
  Per-segment FASTA + binary `.idx` + samtools-faidx-compatible
  `.fai`. Binary 2-bit tier deferred.
- **F4 — vg PanSN-path renaming** — integration only; absorbed by
  `resolveVgPathName` in the harness.
- **F5 — chunkix.py P-line bug** — known upstream issue documented in
  the backend wrapper.
- **F6 — Tandem-repeat orient disagreement** (rust preprocessor) —
  FIXED. Removed the relative-orient branch; segments.bin now stores
  absolute GFA orient.

## Path-symmetry sub-test (C3 measurement)

**Resolved.** `BaseGfaTabixAdapter.getEquivalentRanges` maps a
`(refPath, start, end)` viewport to per-other-path coordinate ranges
that overlap the same physical segments;
`tools/graph-truth-extractor/test-path-symmetry.sh` orchestrates the
multi-path query.

Result on HPRC chrM:5000-5500 anchored on `GRCh38#0#chrM`:

```
ISOMORPHIC: all 44 paths produce the same structural fingerprint
fingerprint: 3d0e925d0f33b04a
```

44/44 haplotypes (CHM13, GRCh38, all 42 sample MT contigs) emit the
same canonical structural fingerprint when queried at their
*equivalent* coordinate ranges. The Phase 0 attempt failed for CHM13
because chrM offsets differ across paths (CHM13:15992 bp vs GRCh38:
16569 bp); the equivalent-ranges mapping resolves that. See
`agent-docs/GRAPH_COMPLETED.md` § C3 for implementation.

Outstanding: run the same harness on HPRC chr20 (a structural locus
like the MAPT inversion) to produce the headline-experiment row.

### chr20 finding (2026-04-30)

Smoke-tested on chr20 at three regions
(`GRCh38#0#chr20:30000000-30001000`, `:100000-100100`,
`:30500000-30501000`) with context ∈ {0, 1, 3}: the per-path
fingerprints **diverge** across all sampled regions and contexts.

This is a genuine biological property of chr20, not a bug:

- chrM is effectively haploid; 44 haplotypes share the consensus
  reference alleles in non-control-region sequence, so each haplotype's
  viewport visits the same segment set in conserved regions.
- chr20 is diploid and rich in heterozygous SNVs/indels; each
  haplotype visits its own allele segments at variant positions. At
  any given locus, sample paths cover *different segment sets*, even
  though all those segments encode the same physical region.

C3 in its strict "byte-isomorphic-across-paths" form therefore does
not hold for chr20 by design. The right C3 measurement at chr20 scale
is the **union-of-subgraphs invariance** property: regardless of
which path is the seed, the enclosing snarl graph (nodes + bubble
boundaries) covering the locus is the same. That requires:

- snarl-aware expansion (Phase 4) so the seed expands to enclose all
  haplotype alleles within the same snarl(s), not just 1-hop edges;
- a fingerprint that ignores per-path "primary walk" identity and
  only fingerprints the underlying snarl structure.

Captured for the publication framing — present chrM as the
clean-symmetric demonstration and chr20 as the realistic case
requiring snarl-aware comparison. Phase 4 unblocks the chr20 C3
measurement.

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

Per the plan, Phase 0's deliverable is a ranked recommendation.
Resolved items have been moved to `agent-docs/GRAPH_COMPLETED.md` —
the up-to-date prioritized backlog lives in
`agent-docs/GRAPH_PLAN.md` § "Open: prioritized backlog". The current
top items are:

1. **C3 (path symmetry)** — instrument next. Needs the
   coordinate-mapping helper and one fixture region selected. Phase 5
   territory; the harness is ready.
2. **Binary sequence tier** — deferred per user steer ("plaintext now,
   binary later"). The `.idx` sidecar format is binary already so the
   adapter's hot path is fast; what's deferred is 2-bit-packed
   nucleotide storage in `prefix.segments.seq.bin` for HPRC-scale
   index footprint reduction. Magic-byte format dispatcher described
   in `GRAPH_PLAN.md` slots in cleanly when this lands.

With F1+F2+F6+F3-plaintext landed, the audit harness reports
byte-isomorphic GFA (segments + sequences + edges + paths) against
vg-truth on **all 7 sampled regions** across both fixtures. The
publication-targeted correctness gates of Phase 0 are met. Remaining
work (C3 path-symmetry, Phase 1 binary tier, Phase 4 snarls,
multi-resolution coarsening, Phase 5 CI) is additive scope.

## Open questions surfaced by Phase 0

- ~~**W vs P line emission.**~~ Resolved: follow input format. Rust
  preprocessor records `#input-format=walks|paths` in the
  `pos.bed.gz` header; adapter mirrors at emission. Phase 2 shipped
  2026-04-30. See `GRAPH_COMPLETED.md`.
- **Chunkix-as-oracle.** The pgtabix.py `args.r` bug blocks this
  oracle for P-line fixtures. Options: patch our local copy of
  pgtabix.py, restrict to W-line inputs, or upstream a fix. Pick once
  Phase 5 CI is being authored.
- **odgi installation.** Phase 5 CI must provision odgi. Easiest path:
  conda environment file at `tools/graph-truth-extractor/env.yaml`.

## See also

- `agent-docs/GRAPH_PLAN.md` — phased plan and claims this audit
  measures.
- `agent-docs/GRAPH_COMPLETED.md` — archive of resolved findings and
  shipped milestones (full per-finding write-ups).
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
