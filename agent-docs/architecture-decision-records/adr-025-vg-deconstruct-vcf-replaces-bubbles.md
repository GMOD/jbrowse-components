# ADR-025: `vg deconstruct` VCF replaces the `bubbles.bed.gz` overlay

## Status

Accepted (2026-05-14)

## Context

`MultiLGVSyntenyDisplay`'s block-level synteny shows *where* haplotypes
differ, not *what* the per-base edits are. The GfaTabix design supplied that
per-base detail through a custom side index, `bubbles.bed.gz`:

- The preprocessor (`generate_bubbles_from_vcf` in `tools/gfa-to-tabix`) read a
  `vg deconstruct` VCF and re-packaged it as BED — one row per
  `(locus, alleleA, alleleB)` with a precomputed CS string and identity score
  (the shape adr-013 justified).
- At runtime, `bubbleOverlay.ts` (`fetchBubbleSites`, `findBubblePair`,
  `annotateFeaturesWithBubbleCs`) fetched those rows, grouped them into
  `BubbleSite` records, picked the CS for the view-time genome pair, and
  interleaved it into the structural CIGAR produced by
  `segmentFeatureBuilder.ts`.

This was fragile in a specific, recurring way: the **X-CIGAR contract**.
`segmentFeatureBuilder` had to emit `X` (not `D`+`I`) for equal-length
substitutions, or `bubbleOverlay` silently dropped the bubble's edits. The C3
cross-path-symmetry claim also leaned on this machinery and had to be narrowed
twice.

Two facts make the custom index unnecessary:

- The `vg deconstruct` VCF was already an *input* to the pipeline. The bubbles
  index was a derived re-packaging of a file we already had.
- adr-024 removed `synteny_build` and with it `segmentFeatureBuilder.ts` and
  the structural CIGAR. There is no longer a CIGAR for the bubble CS to
  interleave *into* — the overlay lost its host.

## Decision

**Ship the `vg deconstruct` VCF directly as a standard JBrowse variant
track.** Drop the `bubbles.bed.gz` index and the runtime overlay entirely.

```
vg deconstruct -P <ref> graph.gfa | bgzip > <ref>.variants.vcf.gz
tabix -p vcf <ref>.variants.vcf.gz
```

Division of detail:

- **`MultiLGVSyntenyDisplay`** — block-level untangle blocks (adr-024), colored
  by identity. Shows *where* divergence is.
- **`variants.vcf.gz` VCF track** — per-base SNP/indel detail, rendered by the
  standard JBrowse variant track. Shows *what* the divergence is.

The two are separate tracks in v1. Overlaying the VCF onto the synteny display
at zoom is a possible later enhancement, not part of this decision.

## Consequences

- Removed from `tools/gfa-to-tabix`: the `--bubbles` flag,
  `generate_bubbles_from_vcf`, `rewrite_vcf_strip_pansn` / `strip_pansn_contig`,
  the `encode_bubble_cs` / `encode_indel` / `compute_binary_cs_from_bytes` /
  `compute_identity_from_binary_cs` / `binary_cs_to_text` /
  `pack_bases` / `unpack_bases` / `base_to_2bit` / `write_varint` /
  `read_varint_slice` helpers, the `BCS_*` opcode constants, the
  `bubbles_bed` / `bubbles_tbi` emission in `write_jbrowse_config`, and the
  `test-bubbles.sh` test script.
- Removed from the runtime: `bubbleOverlay.ts`
  (`BubbleSite`, `findBubblePair`, `fetchBubbleSites`, `parseBubbleLine`,
  `annotateFeaturesWithBubbleCs`, `flipCs`) and its two unit-test files; the
  `bubblesFile` field, `bubblesRefNames` / `bubblesGenomeNames` setup result,
  and the `bpPerPx < 50` overlay branch in `GfaTabixAdapter.getMultiPairFeatures`;
  the `bubblesLocation` / `bubblesIndex` config slots (with their
  preProcessSnapshot mapping); the `bubbles.bed.gz` URLs in
  `test_data/config_*.json`.
- Removed from `tools/graph-server`: the bubble-CS chaining
  (`collapseRunsWithBubbleCs`, `finalizeRun`, `countCsMatches`, `buildCs`,
  `csFromSameLength`, `orientedSeq`, `concatOrientedSeq`, `complement`,
  `revcomp`) and the `segSeqs` / `cs?` fields they fed; the
  `test/compare-vs-tabix.ts` server-vs-tabix oracle and `test/debug-snp.ts`
  probe.
- The X-CIGAR contract is gone. adr-024 already removed
  `segmentFeatureBuilder.ts` (the producing side); this removes the consuming
  side. The `buildCsFromCigarAndSites` tests that guarded the contract are
  removed with it.
- **adr-013 is moot.** Its per-allele-pair vs. per-allele vs. per-genome-pair
  storage analysis described a file that no longer exists. It is kept as a
  historical record of why per-genome-pair storage was rejected, should a
  future overlay revisit the question.
- Users gain the full standard variant experience for free — the variant
  feature detail widget, genotype matrix, filtering — instead of a bespoke,
  display-specific overlay.
- Correctness improves: `vg deconstruct` is the standard, maintained primitive.
  The bubbles index was an unaudited re-derivation of its output.
- Tradeoff: per-base detail is a separate track the user toggles on, not an
  overlay that appears automatically when the synteny display is zoomed in.
  This is the "simple, intuitive track behavior" the user asked for — one file
  per track, standard JBrowse semantics — at the cost of the integrated
  zoomed-in view the overlay provided.

## Cross-references

- `agent-docs/architecture-decision-records/adr-024-untangle-replaces-synteny-build.md`
  — removed `synteny_build` and `segmentFeatureBuilder.ts`, the producing side
  of the X-CIGAR contract.
- `agent-docs/architecture-decision-records/adr-013-bubble-shape-per-pair.md`
  — the now-moot storage-shape decision for the retired index.
- `agent-docs/GRAPH_PLAN.md` — the two-display, two-standard-tool architecture.
