# ADR-013: Bubbles index stores one row per allele pair, not per allele or per site

## Status

Accepted

## Context

The bubbles index (`prefix.bubbles.bed.gz`, see
`agent-docs/GRAPH_INDEX_FORMAT.md` "Bubbles index") supplies per-base
edits used by the synteny display when zoomed in. Each VCF site
("bubble") in the source `vg deconstruct` output has:

- A locus span on the reference path (`start`, `end`).
- An allele inventory: which 0-based allele each genome carries.
- For each pair of distinct alleles `(alleleA, alleleB)`, a CS string
  describing the edits between them, plus an identity score.

The runtime needs, for any feature spanning a site, the CS that
describes `(refGenome's allele) → (queryGenome's allele)` — an
arbitrary genome pair selectable at view time. The runtime must
also flip the CS when the ref allele's index is greater than the
query allele's, because CS is directional.

There are three plausible on-disk shapes for this data:

- **A. Per allele.** One BED row per `(locus, allele)`, carrying the
  raw allele sequence. The runtime computes CS by aligning the two
  relevant alleles at query time. Storage: `O(numAlleles)` rows per
  site (`= 2` for a biallelic SNV).
- **B. Per allele pair (current).** One BED row per
  `(locus, alleleA, alleleB)`, carrying the precomputed CS between
  those two alleles plus their identity. Storage:
  `O(C(numAlleles, 2))` rows per site (`= 1` for a biallelic SNV).
- **C. Per genome pair.** One BED row per
  `(locus, queryGenome, refGenome)`, carrying CS already routed for a
  specific reference choice. Storage:
  `O(numGenomes²)` rows per site (`= 4 005` for HPRC's 90 samples).

Shape **C** is dead-on-arrival at HPRC scale: `O(numGenomes²)`
explodes to billions of rows for a chr20-sized graph, with most rows
duplicating allele-pair edits because most genomes share alleles at
each site.

Shapes **A** and **B** both scale linearly in graph variation. The
choice between them is between *runtime alignment work* (A) and
*on-disk redundancy on multi-allelic loci* (B).

## Decision

Use shape **B**: one row per `(locus, alleleA, alleleB)`, with CS
and identity precomputed at preprocessor time. The runtime parser
groups rows sharing `(start, end)` into one `BubbleSite` per locus
(`bubbleOverlay.ts:fetchBubbleSites`).

## Consequences

**Storage.** For typical pangenome data, ~95%+ of variation is
biallelic. At biallelic loci shapes A and B are equivalent in row
count (`B = 1` row, `A = 2` rows). Multi-allelic loci pay an
`O(k(k-1)/2)` row count instead of `O(k)` — for a 4-allelic site,
that's 6 rows vs 4. The on-disk overhead in practice is on the order
of a few percent.

**Runtime cost.** Shape B avoids any sequence alignment at query
time. `findBubblePair` does two `Map.get()` calls (genome → allele,
allele-pair → CS) and a possible `flipCs` — total work is constant
per site. Shape A would require a Smith-Waterman or similar align
inside the hot path, which is ruled out by the per-base render budget.

**Multi-allelic correctness.** Shape B requires the preprocessor to
compute and store every allele pair, including pairs no genome
currently carries (some allele combinations may exist in the graph
but not be sampled). The Rust preprocessor (`tools/gfa-to-tabix`)
already enumerates all pairs from the VCF; this is not new work.

**Schema mutation cost.** Switching to shape A later would invalidate
every existing `bubbles.bed.gz` fixture and require a runtime
sequence-fetch path. Switching to shape C is rejected outright.
Shape B is forward-compatible with both: shape A can be added as a
new sidecar tier (e.g. `bubbles-alleles.bed.gz`) keyed off a magic
header, and shape C is never going to be the right answer.

**The runtime grouping pass is preprocessable.** The runtime
re-groups per-pair rows into per-site `BubbleSite` records on every
region query. Shape A and a hypothetical "shape B′" (one row per
site, with all pairs and alleles inline) would both eliminate this
pass. The benefit is small (sub-millisecond at HPRC chr20 scale)
and not worth a schema bump pre-publication, but the next time the
bubbles schema changes for any reason, emitting per-site-grouped
rows is the right way to go.

## Alternatives considered

- **Shape C, per genome pair.** Rejected: storage explodes
  quadratically in genome count.
- **Shape A, per allele.** Rejected for the publication path because
  runtime sequence alignment is too expensive on the per-base render
  budget. Worth revisiting if we add a sequence-cache tier and have
  spare CPU per render.
- **Shape B grouped per site (one row, all pairs inline).** Rejected
  *only because of the schema-bump cost*. Cleaner than current; do
  this on the next bubbles-schema change.

## Cross-references

- `plugins/comparative-adapters/src/GfaTabixAdapter/bubbleOverlay.ts`
  — `BubbleSite`, `findBubblePair`, `fetchBubbleSites`,
  `parseBubbleLine`.
- `agent-docs/GRAPH_INDEX_FORMAT.md` "Bubbles index" — the BED row
  schema this ADR justifies.
- `agent-docs/GRAPH_ARCHITECTURE.md` "Why a runtime overlay, not
  preprocessing?" — companion explanation framed for the runtime
  reader.
- `tools/gfa-to-tabix/src/main.rs:generate_bubbles_from_vcf` — the
  preprocessor side that emits this shape.
