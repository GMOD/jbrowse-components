# ADR-030: `cs:`-enriched synteny PAF replaces the `vg deconstruct` VCF for per-base variants

## Status

Accepted (2026-05-14). Supersedes adr-025's per-base-detail *mechanism* (the
`vg deconstruct` VCF track); adr-025's removal of the `bubbles.bed.gz` overlay
still stands. adr-024 (`odgi untangle` for block structure) still stands.

## Context

adr-025 removed the `bubbles.bed.gz` overlay and designated a separate
`vg deconstruct` VCF track as the per-base SNP/indel detail mechanism for
`MultiLGVSyntenyDisplay`. GRAPH_PLAN.md then designed the integration: a
`variantsAdapter` config slot on the display plus a `sampleNameMap` to join
PanSN haplotype names to the VCF's GT-header sample names — the display would
fetch the synteny PAF and the VCF and merge them in the RPC.

That design had real costs:

- **A brittle join.** `vg deconstruct` and `bcftools merge` write sample headers
  inconsistently; the PanSN-↔-VCF-sample-name join (`sampleNameMap`) fails
  per-sample and is easy to get subtly wrong. The whole reason adr-025 existed
  was to escape an implicit producer-side contract (X-CIGAR); a sample-name
  join is a new implicit contract in its place.
- **A second data source.** The VCF must be kept aligned with the synteny PAF —
  same reference, same region semantics, same sample set — by the pipeline and
  the config.
- **New runtime surface.** A display config slot, a second adapter fetch in the
  RPC, the merge pass.

Meanwhile the runtime already renders per-base detail from a **`cs:`-tagged
synteny PAF**. A `cs:`-tagged PAF flows through the *existing*
`TabixPAFAdapter` → `MultiPairGetFeatures` → `GpuMultiSyntenyRenderer` path and
renders allele-colored SNP ticks and indel glyphs on the haplotype rows. This
was verified with a crafted fixture — correct extraction of mismatch/indel
counts and positions, correct render.

## Decision

**Per-base SNP/indel detail comes from the `cs:` tag in the synteny PAF, not a
separate VCF track.** Drop the `variantsAdapter` config slot, the
`sampleNameMap`, and the `vg deconstruct` VCF track from the per-base-detail
design.

- The synteny PAF becomes **`cs:`-enriched**: `odgi untangle` produces the
  graph-aware block structure, then `minimap2 --cs` per block adds the
  base-level `cs:` tag. Block structure and per-base detail in **one track, one
  file, one display**.
- **No new runtime code** — no config slot, no new RPC, no new shaders. The
  runtime path already exists and is proven.
- **The fragile sample-name join is eliminated.** A `cs:` string is intrinsic
  to the block it tags, and the block already belongs to a known haplotype
  (PAF query). There is nothing to join.
- All remaining work is **offline data prep** — producing the `cs:`-enriched
  PAF. That plan (prototype on volvox, scale to chr20, productionize the prep
  tool, migrate CI) lives in `GRAPH_PLAN.md` "Next steps".

## Consequences

- **One track, one file, one display** for both block-level and per-base
  detail. No second data source to keep aligned, no sample-name join, no new
  config the user assembles.
- **Preprocessing gains a `minimap2 --cs` per-block step.** The naive per-block
  subprocess is too slow at chr20 scale (~27 k blocks); batching or
  per-haplotype-align-then-slice is required — a data-prep concern, settled by
  the prototype.
- **Open decision, deferred to the prototype:** *enrich* the untangle PAF with
  `cs:` (keeps untangle's graph-aware block structure — recommended) vs.
  *replace* it with a per-haplotype `minimap2 --cs` PAF (simpler, naturally has
  `cs:`, but sequence-aligned not graph-aware — diverges from adr-024).
- **CI stand-ins migrate.** The suites that currently pair an untangle PAF with
  a separate VCF track (`multi-lgv-pangenome-vcf.ts`,
  `MultiLGVSyntenyPangenome.test.tsx`) move to the single `cs:`-enriched PAF;
  the committed `volvox.untangle.paf.gz` fixture is regenerated `cs:`-enriched
  so the existing `multi-lgv-tabix-paf.ts` suite exercises per-base rendering.
- **adr-025's "unresolved questions" are largely moot.** "Reference-allele-only
  positions" has no analogue — a block region with no `cs:` edit *is* the ref
  match, and "VCF coverage vs. variant absence" collapses to "block present vs.
  absent". Indel-glyph design at varying zoom remains real renderer work, but
  it is already largely handled in the proven runtime path.
- adr-025 is **not** fully superseded: its removal of the `bubbles.bed.gz`
  overlay and the X-CIGAR contract stands. Only its choice of *VCF as the
  per-base mechanism* is replaced here.

## Rejected alternatives

- **The `variantsAdapter` + `vg deconstruct` VCF design** (adr-025 +
  GRAPH_PLAN.md "Per-base variant integration"). Rejected for the brittle
  sample-name join, the second data source, and the new runtime surface — all
  avoided by a `cs:` tag the runtime already renders.

## Cross-references

- `agent-docs/architecture-decision-records/adr-024-untangle-replaces-synteny-build.md`
  — `odgi untangle` block structure; the `cs:` enrichment layers on top of it.
- `agent-docs/architecture-decision-records/adr-025-vg-deconstruct-vcf-replaces-bubbles.md`
  — its bubble-overlay removal stands; its VCF per-base mechanism is superseded
  here.
- `agent-docs/GRAPH_PLAN.md` — the data-prep plan and the (removed)
  `variantsAdapter` design.
- Runtime path: `plugins/comparative-adapters/src/TabixPAFAdapter`,
  `MultiPairGetFeatures`, `GpuMultiSyntenyRenderer` — render `cs:`-tagged PAFs
  with no change.
