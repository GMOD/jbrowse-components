# ADR-015: C3 cross-path symmetry claim narrowed to per-path correctness

## Status

Accepted

## Context

The publication's C3 correctness claim was originally stated as: "querying the
same genomic locus from any of N reference paths yields the same canonical
subgraph." This would mean the GFA-tabix index is path-symmetric — the
structure you see doesn't depend on which assembly you start from.

The claim was tested on HPRC chrM (44 paths). All 44 paths produce the same
structural fingerprint (WL canonical form `3d0e925d0f33b04a`), confirming the
strong form of C3 for that chromosome.

During chr20 testing, an "intersection-restricted" reframing was tried: restrict
each extraction to ordinals present in both paths, compare the restricted
subgraphs. This appeared to pass at all scales tested.

## Decision

**The intersection test was a tautology.** Both extractions read the same
`segments.bin` and `edges.bin`. Restricting to the same segment subset and
emitting canonical GFA from the same data necessarily produces identical output —
this is "reading the same file twice," not a structural symmetry property.

The script (`tools/graph-truth-extractor/intersection-symmetry.ts`) was deleted.

**The broad C3 claim does not hold for chr20.** Direct testing showed per-path
fingerprints diverge at all tested regions and contexts:
- HPRC chr20 haplotype contigs are fragmented (most < 500 kb); bounding-box
  extraction clips at contig boundaries per haplotype.
- Segment density varies per path: a path with a 50-bp deletion traverses far
  fewer segments than one that shares the reference allele.
- This is biological, not a bug.

## Replacement claim

The publishable C3 claim is narrower:

> **Per-path correctness against `vg find`**: for any reference path, `getSubgraph`
> returns a GFA that is structurally isomorphic to the `vg find` oracle on the
> same path and region.

This is verified by `auditConcordance.test.ts` on volvox, chrM, and chr20 across
7 sampled regions, all structurally isomorphic to `vg find` truth.

The stronger "all paths agree" property holds for chrM (effectively haploid,
conserved non-control-region sequence) and is demonstrated by
`tools/graph-truth-extractor/test-path-symmetry.sh`. The publication presents
chrM as the clean symmetric example and chr20 as the realistic pangenome case.

For chr20-scale cross-path symmetry, a snarl-aware comparison would be needed:
the seed region must be expanded to enclose all haplotype alleles within the
same snarl, and the fingerprint must ignore which path is primary. This requires
Phase 4 (snarl-aware expansion) and is deferred.

## Consequences

- The broad C3 invariant is removed from `GRAPH_PLAN.md` "Claims".
- `intersection-symmetry.ts` is deleted.
- chr20 path-symmetry finding is documented in `GRAPH_PERF.md` as a known
  biological property, not a bug.
- The audit harness (`auditConcordance.test.ts`) is the correctness gate; it
  passes on all current fixtures.
