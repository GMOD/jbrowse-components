# ADR-030: `cs:`-enriched synteny PAF replaces the runtime `variantsAdapter` join (VCF artifact retained)

## Status

Accepted (2026-05-14), revised (2026-05-14). Supersedes adr-025's per-base
*runtime mechanism* (the `variantsAdapter` overlay design), **not** the
`vg deconstruct` VCF artifact itself — the VCF ships as a standalone standard
JBrowse variant track. adr-025's removal of the `bubbles.bed.gz` overlay still
stands. adr-024 (`odgi untangle` for block structure) still stands.

### Revision note (2026-05-14)

The original draft framed this as "remove the VCF concept" and prescribed
`minimap2 --cs` per block as the cs-derivation method. Both were too broad:

- **The VCF artifact is kept**, as a *separate* standard variant track.
  `vg deconstruct -a -u` carries `AT` (allele-traversal node IDs), `AP`
  (reference-relative positions of allele-traversal steps), and `LV/PS`
  (snarl nesting) — graph-derived data that minimap2 cannot reproduce, and
  the standard JBrowse variant-track UX (feature widget, genotype matrix,
  filtering) is preserved for free.
- **`minimap2 --cs` is fallback only.** Two better derivations exist:
  - **impg + tracepoints** (preferred). `impg query` over a TPA-indexed
    all-vs-all alignment reconstructs exact `=`/`X` CIGAR for the requested
    range, with reconstruction bounded to the viewport. Tracepoint round-trip
    is alignment-score lossless. Subsumes the per-block re-alignment problem
    we were about to hand-roll. See `CS_ENRICHED_PAF_PLAN.md` "tracepoints /
    impg integration".
  - **`vg deconstruct -a -u` AP/AT projection** (when node-ID provenance is
    needed end-to-end on the synteny display). Graph-derived, snarl-aware,
    node-ID-preserving.

What's removed is only the *runtime join*: the `variantsAdapter` config slot,
the `sampleNameMap` that bridges PanSN haplotype rows to VCF GT-header sample
names per render, and the second-fetch-and-merge in the RPC. The same join is
done **once, offline**, while building the cs-PAF — or sidestepped entirely
if the synteny display moves to a runtime `ImpgTpaAdapter` (longer-term).

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

**Per-base SNP/indel detail on the synteny display comes from the `cs:` tag in
the synteny PAF, derived offline from `vg deconstruct -a -u`. The same
`vg deconstruct` VCF ships separately as a standalone standard JBrowse variant
track.** Drop the runtime `variantsAdapter` config slot, the `sampleNameMap`,
and the second-fetch-merge in the RPC.

- The synteny PAF is **`cs:`-enriched**: `odgi untangle` produces the
  graph-aware block structure; the offline prep step projects
  `vg deconstruct -a -u` AP-positioned variants for each block's
  `(haplotype, ref-range)` window into a `cs:Z:` tag (block-target-relative).
  Block structure and per-base detail in one PAF, rendered by the existing
  `TabixPAFAdapter` → `MultiPairGetFeatures` → `GpuMultiSyntenyRenderer` path.
- The `vg deconstruct -a -u` VCF is **also shipped**, as a separate variant
  track in the same config. Users get the full standard variant UX (feature
  widget, genotype matrix, filtering); the synteny display does not depend on
  it.
- **No new runtime code** for the synteny display — no config slot, no new
  RPC, no new shaders. The variant track is the existing JBrowse variant
  pipeline.
- **The fragile sample-name join is eliminated *at runtime***. The same
  PanSN-↔-GT-sample-name mapping happens once, offline, while building the
  cs-PAF. It is then validated against a known-good fixture; users never see
  it.
- The cs derivation is **graph-derived**: `vg deconstruct` knows the snarls,
  knows the node IDs, and is the standard tool for "linearize the pangenome
  variants." `minimap2 --cs` is kept only as a fallback for graphs without
  `vg deconstruct` output.
- All remaining work is **offline data prep**. The plan lives in
  `CS_ENRICHED_PAF_PLAN.md`.

## Consequences

- **Synteny display is self-contained**: one PAF, one display, no runtime
  join. Per-base detail rides in the same file as block structure.
- **Variant track is independent**: the `vg deconstruct -a -u` VCF is a
  standard variant track in the same config. Two artifacts, no shared runtime
  surface, no shared config slot.
- **Preprocessing gains an AP/AT-projection step** (cheap — single in-memory
  join on `(haplotype, ref-position)` keyed off untangle blocks). Falls back
  to `minimap2 --cs` per block where `vg deconstruct` is unavailable.
- **CI stand-ins migrate.** The suites that pair an untangle PAF with a
  separate VCF track (`multi-lgv-pangenome-vcf.ts`,
  `MultiLGVSyntenyPangenome.test.tsx`) split: the synteny side moves to the
  `cs:`-enriched PAF; the variant-track side stays as the standalone variant
  track. The committed `volvox.untangle.paf.gz` is regenerated `cs:`-enriched
  so `multi-lgv-tabix-paf.ts` exercises per-base rendering.
- **adr-025's "unresolved questions" partially carry over.** "Reference-allele
  positions" has no analogue on the synteny display — a block region with no
  `cs:` edit *is* the ref match. The variant-track side keeps standard VCF
  semantics, including those questions. Indel-glyph design at varying zoom
  remains real renderer work but is largely handled in the proven runtime
  path.
- **Linearization limits** (haplotype-novel insertions, segdup multi-mapping,
  inversions, nested bubbles) are real and not fixed by either artifact;
  surface them in the renderer (see `CS_ENRICHED_PAF_PLAN.md` "Linearization
  caveats to surface in the renderer"). The graph view answers what
  linearization cannot.
- adr-025 is **not** fully superseded: its removal of the `bubbles.bed.gz`
  overlay and the X-CIGAR contract stands. Only the *runtime overlay* design
  for the per-base mechanism is replaced here; the VCF artifact ships as
  adr-025 originally proposed.

## Rejected alternatives

- **The runtime `variantsAdapter` overlay design** (GRAPH_PLAN.md "Per-base
  variant integration"). Rejected for the brittle PanSN-↔-GT-sample-name join
  every render and the second-fetch-and-merge in the RPC. The same join, done
  *once offline* into the cs-PAF, is fine.
- **Removing the VCF artifact entirely** (this ADR's original draft). Rejected
  on user pushback: `AT/AP/LV/PS` carry node IDs, snarl nesting, and
  reference-relative allele positions — graph-derived data we want preserved.
  The standard variant-track UX is also lost. Keeping the VCF as a separate
  track costs nothing.
- **`minimap2 --cs` as primary cs-derivation**. Rejected: minimap2 doesn't see
  the graph, discards node IDs, and re-derives from sequence (possible
  divergence from the graph's own decomposition). Demoted to fallback for
  graphs lacking both impg/TPA input and `vg deconstruct` output.
- **"Graph-walk within blocks" hand-rolled derivation** (proposed mid-debate).
  Rejected: this is re-implementing snarl-aware path comparison, which is what
  `vg deconstruct -u` already does correctly.
- **Hand-rolling viewport-bounded CIGAR reconstruction.** Rejected on the same
  principle as "don't reinvent vg deconstruct" — the `tracepoints` crate
  (github.com/AndreaGuarracino/tracepoints) and `impg`
  (github.com/pangenome/impg) implement compact alignment storage with lazy
  per-window WFA reconstruction. Building our own would duplicate
  `process_subset_tracepoints` (`~/src/vendor/impg/src/impg.rs:923`), the TPA
  format, and an indexed alignment store.

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
