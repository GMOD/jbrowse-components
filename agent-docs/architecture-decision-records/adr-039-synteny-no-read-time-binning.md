# ADR-039: Synteny perf — no read-time binning; the N→M lever is a deferred make-pif tier

## Status

Accepted (reject read-time binning). The precomputed **binned make-pif tier** is
**Deferred** until a genuinely slow dense dataset or a user complaint exists. A
`parsePifLine` micro-optimization is **Rejected** as not worth its noise.

## Context

A profiling note framed synteny/PIF fetch cost as roughly tabix-fetch +
`parsePifLine` (~66% combined, parse alone the single largest slice) + feature
construction. A prior note ranked **read-time binning** — accumulating adjacent
rows into fewer features inside the adapter — as the recommended first perf step,
because it "works on existing files" (no re-generation).

The stated constraint inverts that ranking: **end-user perf matters, dataset
creation time does not.** With that fixed, we re-evaluated whether read-time
binning should be built.

The relevant existing machinery (see ADR-033 for the LOD/tier taxonomy):

- `make-pif` (`products/jbrowse-cli/src/commands/make-pif/pif-generator.ts`)
  emits a **fine tier** (`t`/`q` seqids, full `cg:Z` CIGAR) and an optional
  **coarse tier** (`T`/`Q` seqids, no CIGAR).
- `PairwiseIndexedPAFAdapter.getFeatures` fetches with `pif.getLines(...)` and
  runs `parsePifLine` in the per-line `lineCallback`, then builds a
  `SyntenyFeature`. Tier selection is `resolveCoarseTier` /
  `hasCoarseTierPrefix` / `coarseBpPerPxThreshold`.
- Synteny **deliberately has no `regionTooLarge` gate** — explicit comments at
  `LinearSyntenyDisplay/model.ts` and `DotplotDisplay/stateModelFactory.tsx`.
  Whole-genome overview is the point; LOD tiers exist instead of a gate.

## Decision

1. **Do not build read-time (adapter-side) binning.** Under the stated
   constraint it optimizes the wrong end of the pipeline.

2. **Do not add a cap+warn / `regionTooLarge` floor to synteny.** It contradicts
   a deliberate design decision recorded in the code.

3. **The only real end-user perf lever is a precomputed binned tier in
   `make-pif`** — a third rung that reduces row *count* (N→M), served by another
   prefix in the existing tier machinery. It is **deferred**: build it against a
   real slow file, not a synthetic benchmark.

## Reasoning

### Read-time binning cannot touch the cost users wait on

In `getFeatures`, `pif.getLines` has already fetched every line and
`parsePifLine` has already parsed each one *before* any feature exists — fetch
and parse, the ~66%, are strictly upstream of anything the adapter could bin.
Read-time binning only shrinks `SyntenyFeature`/geometry construction (the ~1.5×
tail), while adding runtime config + accumulation state. Under "end-user perf
matters, creation time doesn't," it is the dominated option: it pays complexity
to speed up the part users don't feel and leaves the part they do feel untouched.

### The coarse tier is gap-split, not row-reduced — so no reduced-count rung exists yet

`pif-generator.ts` splits coarse rows on large CIGAR gaps
(`splitCigarOnLargeGaps`), so for indel-heavy alignments the coarse tier emits
**≥** the fine row count. Its entire win is CIGAR-elision (the fat column),
not fewer rows. The ladder today is therefore fine (CIGAR) → coarse (no-CIGAR,
≥ count) with **no N→M rung**. That absence is exactly what a binned tier would
fill, and it confirms the binned tier — not read binning — is the coherent
completion of the tier system. Because it runs at generation time it reads M
lines instead of N at the wire, cutting fetch *and* parse — the costs read-time
binning can't reach.

### Why defer the binned tier rather than build it now

There is no slow dataset and no complaint in hand. The coarse tier already drops
the CIGAR past the threshold, which is the dominant per-row weight. Building a
format-level feature (bin size, cap) against a synthetic benchmark tunes its
parameters to fiction — the same failure mode that produced the removed
`minFeaturePx` knob. When a real sluggish dense case appears (a real
human-vs-mouse, or a pangenome all-vs-all a user is waiting on), build and tune
against *that* file.

### The parse micro-opt is below the noise floor

`parsePifLine` wraps `parsePAFLine`'s result in a second shallow 8-field object
that merely *references* the same `extra` map — one small allocation per line.
The real parse cost is `line.split('\t')` plus the tag loop, and in the coarse
tier that loop is already short (no `cg`). The double-wrap is a low-single-digit
win at best, not the "10–15%" a prior note claimed; not worth touching without a
profiler open on a real regression.

## Consequences

- The synteny perf backlog carries exactly one real item — the binned make-pif
  tier — and it is explicitly deferred, not dropped. A future agent should not
  re-propose read-time binning or a region gate.
- If the binned tier is built, it should reuse the uppercase-prefix seqid +
  `resolveCoarseTier` mechanism rather than introduce a parallel path.
- The coarse-tier correctness fix and the corrected cost note are the shipped
  deliverable of this investigation.

## Related

- ADR-033 (synteny/dotplot LOD — the tier taxonomy this builds on)
- ADR-012 (synteny worker output split)
- ADR-018 (synteny cumulative-bp storage)
