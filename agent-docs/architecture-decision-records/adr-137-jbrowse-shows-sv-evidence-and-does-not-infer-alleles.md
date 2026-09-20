---
status: Accepted
summary: "The in-app \"Reconstruct derivative allele\" workflow is removed: it proposed routes at 28–40% of ordinary ONT loci, its segment map took copy counts from where the longest read stopped, and it carried no mapping quality. JBrowse shows SV evidence (arcs, SV channels, split view, the breakend walk, read vs ref) and views an allele an offline tool, an assembly or a paper built; tutorials carry the interpretation and name its source"
---

# ADR-137: JBrowse shows SV evidence and does not infer alleles

## Status

Accepted (2026-09-18). Removes the derivative-allele picker, its lettering and
segment map, and the derive-command button. Makes
[ideas/route-as-a-launch-input](../ideas/waiting-on-a-call/route-as-a-launch-input.md) the only
in-app path to drawing an allele.

## Context

The picker grouped the split reads in view by the junctions they cross and
offered each group as a derivative allele: a ranked row, a lettered string
(`A B C D E′ B′`), a synteny view against a synthetic axis, and a saved segment
map with copy counts. It was right on the case it was built on, COLO829's der(3)
with 29 reads spanning the whole event, and it misled everywhere else in ways a
reader could not see from inside the dialog.

- **Routes where there is no event.** It proposed routes at 28–40% of ordinary
  loci on ONT data, matched normal included, and read count alone did not
  separate them from real ones
  ([reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md), batch study). A
  short-read test pinned "returns confidently ranked candidates that are all
  mapping artefacts".
- **Copy numbers from read length.** The segment map cut the reference at every
  segment edge, including where the longest read stopped. The shipped cancer_sv
  figure's "B ×2, 6.43 kb" was the longest returning read. On a public MECP2
  DUP-TRP/INV-DUP (Grochowski et al. 2024; SRA PRJNA953021, GEO GSE250451) it
  drew 278 kb as "not in derivative" where the patient's array shows two
  copies.
- **No mapping quality.** A route through segmental duplication drew and ranked
  like a unique one: two reads at MAPQ 0–7 came out as a confident three-segment
  route.
- **Out of reach for the hard cases.** No read spans a Carvalho-type event, and
  its repeat-mediated junction is unresolvable by reads, so the picker returned
  one junction dressed as an allele.

Each review had patched a symptom (the mechanism doc grew to eleven rules)
rather than deciding.

## Decision

- **Remove the in-app reconstruction.** The track-menu item and dialog, the
  route grouping (`computeDerivativePaths`), the lettering and segment map, the
  synteny display's contig variant, and the figures, video and tutorial sections
  that taught them.
- **Evidence views stay:** read arcs, SV channels, read cloud, chain layout, the
  breakpoint split view, the breakend walk over a callset, and single-read
  "Linear read vs ref". Each shows what the reads or the caller say, without
  concluding what the allele is.
- **An allele is drawn only when something outside JBrowse built it** — an
  offline tool (`sv_multihop.py derive`), an assembly contig, a caller's own
  interpretation (a GATK-SV `CPX_INTERVALS` record), or a paper — and the
  figure names that source. The route input is
  [ideas/route-as-a-launch-input](../ideas/waiting-on-a-call/route-as-a-launch-input.md).
- **Tutorials carry the interpretation**, reproducing a published result and
  showing the offline workflow that got there; an AI agent driving JBrowse is
  one such workflow (`scripts/agent-demos/takes/derivative.md`).

## Consequences

- A user with long reads and no pipeline loses the one-click route list. The
  case it served well, reads spanning the whole event, is the case `derive`
  also serves.
- The arc band keeps the chain-building code it shares (`unpairedReadChain`,
  `collectPendingArcs`); the SA-tag walk stays ungated because linked reads and
  the curved connectors read the same tags.
- The COLO829 read fixtures and the batch-study harness are gone with the
  feature; git holds them.

## Rejected alternatives

- **Fix it in place**: junction-cut lettering, per-segment MAPQ, dashed
  inferred copies, pattern names such as `DUP-TRP/INV-DUP`. Prototyped on
  2026-09-18 (branch `worktree-sv-hand-annotated-figures`). It made the drawing
  more authoritative without making the inference more correct: two MAPQ 0–7
  reads became a confident `DEL-NML-DUP`.
- **Move it to a store plugin.** The problem is the inference, not where it
  lives; a plugin ships the same routes with less oversight.

## Revisit if

A route source JBrowse does not compute (a caller cluster, an assembly, a
published structure) needs a drawing the evidence views cannot give. That is
route input, not a return of in-app inference.
