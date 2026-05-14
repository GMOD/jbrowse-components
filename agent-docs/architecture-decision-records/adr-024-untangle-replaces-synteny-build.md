# ADR-024: `odgi untangle` replaces the GfaTabix `synteny_build` pipeline

## Status

Accepted (2026-05-14)

## Context

`MultiLGVSyntenyDisplay` needs, per haplotype, a set of synteny blocks against
a reference path. The GfaTabix design produced these with `synteny_build` in
`tools/gfa-to-tabix/src/main.rs`: for every (reference path, haplotype path)
pair, `align_pair` walked shared graph ordinals and emitted co-linear blocks
with a CIGAR string.

This was the central pain point of the whole graph effort:

- **Slow.** O(ref paths × hap paths) over per-step ordinal joins — ~1 h on
  HPRC chr20 (90 haplotypes, 1.86 M segments).
- **Large.** `synteny.bed.gz` + `synteny.rev.bed.gz` were 167–890 MB depending
  on build.
- **Fragile.** Correctness depended on the `X`-CIGAR contract between
  `segmentFeatureBuilder.ts` and `bubbleOverlay.ts` (silent SNP loss when
  broken), and on a `bubbles.bed.gz` side index. The C3 cross-path-symmetry
  claim had to be narrowed twice (adr-015).
- **Unaudited against a real oracle.** Its only correctness claim was "matches
  the previous internal implementation."

`odgi untangle` performs the same fundamental operation — projecting graph
paths into reference-relative linear segments — as a standard, maintained tool
from the pangenome toolkit. The graph already encodes the alignment; untangle
reads it out rather than re-deriving it.

## Decision

**Replace `synteny_build` with whole-graph `odgi untangle`.** The preprocessing
step becomes:

```
odgi untangle -i graph.og -R <ref-paths> -Q <query-paths> -n 1 -p \
  | sort | bgzip > <ref>.synteny.paf.gz ; tabix <ref>.synteny.paf.gz
```

`MultiLGVSyntenyDisplay` reads the tabix-indexed PAF via range query at every
zoom level.

### Benchmark that justified this (HPRC chr20, 919 paths, 2026-05-14)

| Metric | `synteny_build` | `odgi untangle` |
|---|---|---|
| Wall time | ~1 h | **1 m 39 s** |
| Peak RSS | 7.9 GB | **2.1 GB** |
| Output | 167–890 MB | **11 MB** (24 k blocks at `-j 0.5 -m 1000`) |
| Crashes | — | 0 / 4 runs |

Full numbers, parameter-variant comparison, and the segdup / segfault
investigations are in `GRAPH_PERF.md`.

### Parameter handling — bake permissive, filter at runtime

untangle parameters are frozen into the static PAF, so the precompute bakes
*permissive* values and the runtime adapter filters *up*:

- `-n 1` — n-best > 1 produced only noise (secondary mappings mean jaccard
  ~0.02, 0 % above 0.5, validated in and out of chr20 segdup regions). Never
  use `-n > 1`.
- `-j` (jaccard floor) — bake low to kill degenerate `id:f:0` artifacts;
  carry the `jc:f:` tag into the PAF so the adapter can filter further.
- `-m` (merge-distance) — bake low/0; merge adjacent collinear blocks
  visually at render time.
- `-e/--cut-every` — leave off; it changes segment boundaries irreversibly.

The one genuinely unrecoverable choice is `-R` (the reference anchor): one
untangle run per reference path.

## Consequences

- `tools/gfa-to-tabix`'s `synteny_build`, `align_pair`, and the
  `synteny.bed.gz` / `synteny.rev.bed.gz` / `synteny.coarse.bed.gz` outputs
  are removed. The Rust preprocessor shrinks to little more than tool-wrapping.
- `segmentFeatureBuilder.ts` and the `X`-CIGAR contract are removed
  (the contract only existed to feed the bubble overlay — see adr-025).
- `odgi` becomes a pinned build-time dependency for the linearization
  pipeline. The vendored build is unstable (broken `unchop`/`view`, segfaults
  on unsorted graphs) — a known-good version pin is required.
- untangle output is **block-level only** (no per-base CIGAR). Per-base detail
  moves to a `vg deconstruct` VCF track (adr-025).
- untangle output is currently **unaudited** for correctness — a check
  against `vg deconstruct` or the source alignment is owed before publication.
- The `AllVsAllPAFAdapter` stub (PR #4985) becomes the basis for an *indexed*
  tabix-PAF adapter that consumes `synteny.paf.gz`.
- Region-based untangle (`vg find → odgi build → odgi sort → odgi untangle`)
  remains a viable *service*-model alternative; see `GRAPH_PLAN.md` "static
  vs service".
